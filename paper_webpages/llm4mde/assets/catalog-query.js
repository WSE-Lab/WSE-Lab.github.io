/* Independent search, field filters and column selection for the study catalog. */
(function () {
  'use strict';
  const {el, safeUrl, authorText} = window.Site;
  const missing = '__missing__';
  const fold = value => String(value ?? '').trim().toLocaleLowerCase();
  const unique = values => [...new Map(values.map(value => [fold(value), value])).values()];
  const metricDimensions = [
    ['scope', 'Scope', {Sem:'Semantic', Syn:'Syntactic', 'Sem+Syn':'Semantic-syntactic'}],
    ['aspect', 'Aspect', {'Correctness+Completeness':'Correctness + Completeness'}],
    ['reference', 'Reference', {True:'Reference-based', False:'Reference-free'}],
    ['measurement', 'Measurement', {Quant:'Quantitative', Qual:'Qualitative'}],
    ['perspective', 'Perspective', {obj:'Objective', subj:'Subjective'}]
  ];
  function metricEntries(value) {
    return [...String(value).matchAll(/([^;\[\]]+)\[([^\[\]]+)\]/g)]
      .map(match => ({name:match[1].trim(), dimensions:match[2].split(';').map(term => term.trim())}));
  }
  function tokens(value, display) {
    let text = String(value ?? '').trim();
    // Remove only brackets enclosing the whole list, preserving nested attributes.
    while (text.startsWith('[') && text.endsWith(']')) {
      let depth = 0, enclosing = true;
      for (let i = 0; i < text.length - 1; i++) {
        if (text[i] === '[') depth++;
        if (text[i] === ']') depth--;
        if (depth === 0) { enclosing = false; break; }
      }
      if (!enclosing) break;
      text = text.slice(1, -1).trim();
    }
    let depth = 0, start = 0;
    const result = [];
    for (let i = 0; i <= text.length; i++) {
      if (text[i] === '[') depth++;
      if (text[i] === ']') depth--;
      if (i === text.length || (text[i] === ';' && depth === 0)) {
        const term = display(text.slice(start, i)).trim();
        if (term && !/^(no|none|n\/a)$/i.test(term)) result.push(term);
        start = i + 1;
      }
    }
    return unique(result);
  }
  function create({data, fields, groups, names, display, onChange}) {
    const $ = id => document.getElementById(id);
    const basics = ['ID', 'RQ1 Year', 'Title'];
    const facets = {
      'RQ4 SEActivity':'activities', 'RQ4 SETask':'seTasks', 'RQ5 MDETask':'tasks',
      'RQ6 ModelingLanguage':'languages', 'RQ6 ModelType':'modelTypes', 'RQ7 ApplicationDomain':'domains',
      'RQ8 FoundationLLMFamiliy':'llms', 'RQ8 LLMAccessMode':'access', 'RQ8 PipelineLLMComposition':'pipeline',
      'RQ10 EnhancementTechnique':'enhancement', 'RQ12 InteractionPattern':'interaction', 'RQ15 Baseline':'baselines'
    };
    const fieldGroups = [
      {key:'identity', name:'Study information', fields:['ID', 'Title', 'BibTex']},
      ...Object.entries(groups).map(([key, group]) => ({key, name:group.name, fields:group.fields.filter(field => fields.includes(field))}))
    ];
    const specs = fields.map(field => ({field, name:names[field],
      type:field === 'RQ1 Year' ? 'year' : field.endsWith('Link') ? 'link' : ['ID','Title','BibTex'].includes(field) ? 'text' : 'category',
      multi:!['ID','Title','BibTex','RQ1 Year','RQ2 Venue','RQ3 VenueType','RQ3 PaperType'].includes(field),
      values:study => {
        if (field === 'RQ14 EffectivenessMetric') return unique(metricEntries(study.raw[field]).map(metric => metric.name));
        if (facets[field]) return unique(study.facets[facets[field]].map(value => value.trim()));
        if (['ID','Title','BibTex','RQ1 Year','RQ2 Venue','RQ3 VenueType','RQ3 PaperType'].includes(field)) return [display(study.raw[field])].filter(Boolean);
        return tokens(study.raw[field], display);
      }
    }));
    specs.push({field:'@category', name:'Model type category', type:'category', multi:true, values:study => study.facets.categories});
    fieldGroups.find(group => group.key === 'scope').fields.splice(fieldGroups.find(group => group.key === 'scope').fields.indexOf('RQ6 ModelType'), 0, '@category');
    metricDimensions.forEach(([key, name, aliases], index) => {
      specs.push({field:'@metric-'+key, name:'Metric '+name.toLowerCase(), type:'category', multi:true,
        values:study => unique(metricEntries(study.raw['RQ14 EffectivenessMetric']).map(metric => aliases[metric.dimensions[index]] || metric.dimensions[index]).filter(Boolean))});
    });
    const evaluationFields = fieldGroups.find(group => group.key === 'evaluation').fields;
    evaluationFields.splice(evaluationFields.indexOf('RQ14 EffectivenessMetric') + 1, 0, ...metricDimensions.map(([key]) => '@metric-'+key));
    // Keep existing artifact-filter links usable without exposing the removed data column.
    specs.push({field:'@artifact', name:'Available material', type:'category', multi:true, values:study => study.facets.components});
    fieldGroups.find(group => group.key === 'artifacts').fields.push('@artifact');
    const byField = new Map(specs.map(spec => [spec.field, spec]));
    const valueCache = new Map(specs.map(spec => [spec.field, new Map(data.studies.map(study => [study.id, spec.values(study)]))]));
    const options = new Map(specs.map(spec => [spec.field, unique(data.studies.flatMap(study => valueCache.get(spec.field).get(study.id)))
      .sort(spec.type === 'year' ? (a,b) => Number(b)-Number(a) : (a,b) => a.localeCompare(b))]));
    options.set('RQ7 ApplicationDomain', unique([...options.get('RQ7 ApplicationDomain'), ...window.LLM4MDE_DEFINITIONS.applicationDomains.map(category => category.name)]).sort((a,b) => a.localeCompare(b)));
    const searchCache = new Map(data.studies.map(study => [study.id, [study.authors, authorText(study.authors), study.key, ...fields.flatMap(field => [study.raw[field], display(study.raw[field])])].join(' ').toLocaleLowerCase()]));
    const defaults = () => ({q:'', searchIn:'all', filters:[], columns:[...fields]});
    let state = defaults(), debounce;
    const searchScope = $('search-scope');
    const filterPicker = $('filter-picker');
    const filterRefs = new Map();
    const columnInputs = new Map();
    const allowedSearch = new Set(['all', ...fields.map(field => 'field:'+field), ...Object.keys(groups).map(key => 'group:'+key)]);
    const baseColumnSet = new Set(basics);

    function option(value, label) { return el('option', {value, text:label}); }
    function notify() { clearTimeout(debounce); onChange(); }
    function operators(spec) {
      if (spec.type === 'link') return [['present','Has a link'], ['missing','No link'], ['contains','Contains'], ['not_contains','Does not contain']];
      if (spec.type === 'text') return [['contains','Contains'], ['not_contains','Does not contain'], ['equals','Equals'], ['present','Has a value'], ['missing','No value']];
      return [['in',spec.multi ? 'Choose values' : 'Match any selected value'], ...(spec.type === 'year' ? [['range','Year range']] : []), ['present','Has a value'], ['missing','No value']];
    }
    function defaultFilter(field) {
      const spec = byField.get(field);
      return {field, operator:operators(spec)[0][0], mode:'any', values:[], from:'', to:''};
    }
    function cleanFilter(input) {
      if (!input || !byField.has(input.field)) return null;
      const spec = byField.get(input.field), filter = defaultFilter(input.field);
      if (operators(spec).some(([operator]) => operator === input.operator)) filter.operator = input.operator;
      filter.mode = spec.multi && input.mode === 'all' ? 'all' : 'any';
      if (spec.type === 'text') filter.mode = input.mode === 'all' ? 'all' : 'any';
      const values = Array.isArray(input.values) ? input.values.filter(value => typeof value === 'string').map(value => value.trim()).filter(Boolean) : [];
      filter.values = unique(filter.operator === 'in' ? values.map(value => value === missing ? missing : options.get(input.field).find(candidate => fold(candidate) === fold(display(value)))).filter(Boolean) : values);
      for (const key of ['from','to']) if (/^\d{4}$/.test(String(input[key] ?? ''))) filter[key] = String(input[key]);
      return filter;
    }
    function hasValue(study, spec) {
      if (spec.type === 'link') return (String(study.raw[spec.field] || '').match(/https?:\/\/[^\s\[\];]+/g) || []).some(url => safeUrl(url));
      return valueCache.get(spec.field).get(study.id).length > 0;
    }
    function matchesFilter(study, filter) {
      const spec = byField.get(filter.field);
      if (filter.operator === 'present') return hasValue(study, spec);
      if (filter.operator === 'missing') return !hasValue(study, spec);
      if (filter.operator === 'range') {
        const year = Number(study.raw[filter.field]);
        return (!filter.from || year >= Number(filter.from)) && (!filter.to || year <= Number(filter.to));
      }
      if (!filter.values.length) return true;
      const values = valueCache.get(filter.field).get(study.id).map(fold);
      const text = display(study.raw[filter.field]).toLocaleLowerCase();
      const test = wanted => filter.operator === 'in' ? (wanted === missing ? !values.length : values.includes(fold(wanted)))
        : filter.operator === 'equals' ? fold(text) === fold(wanted) : text.includes(fold(wanted));
      if (filter.operator === 'not_contains') return filter.values.every(value => !test(value));
      return filter.mode === 'all' ? filter.values.every(test) : filter.values.some(test);
    }
    function matchesSearch(study) {
      if (!state.q.trim()) return true;
      if (state.searchIn === 'all' && /^\d+$/.test(state.q.trim())) return study.id === Number(state.q.trim());
      const selected = state.searchIn.startsWith('field:') ? [state.searchIn.slice(6)]
        : state.searchIn.startsWith('group:') ? groups[state.searchIn.slice(6)].fields.filter(field => fields.includes(field)) : null;
      const text = selected ? selected.flatMap(field => [study.raw[field], display(study.raw[field])]).join(' ').toLocaleLowerCase() : searchCache.get(study.id);
      return fold(state.q).split(/\s+/).every(term => text.includes(term));
    }
    function matches(study) { return matchesSearch(study) && state.filters.every(filter => matchesFilter(study, filter)); }

    searchScope.append(option('all','All metadata'));
    fieldGroups.forEach(group => {
      const optgroup = el('optgroup', {label:group.name});
      group.fields.filter(field => fields.includes(field)).forEach(field => optgroup.append(option('field:'+field, names[field])));
      searchScope.append(optgroup);
    });
    const searchGroups = el('optgroup', {label:'Search an aspect'});
    Object.entries(groups).forEach(([key, group]) => searchGroups.append(option('group:'+key,group.name)));
    searchScope.append(searchGroups);
    function columnsForSearch() {
      if (state.searchIn === 'all') return [...fields];
      const selected = state.searchIn.startsWith('field:') ? [state.searchIn.slice(6)] : groups[state.searchIn.slice(6)].fields.filter(field => fields.includes(field));
      return unique([...basics, ...selected]);
    }
    searchScope.addEventListener('change', () => {
      state.searchIn = searchScope.value; state.columns = columnsForSearch();
      presets.value = state.searchIn === 'all' ? 'all' : state.columns.every(field => baseColumnSet.has(field)) ? 'basic' : state.searchIn.startsWith('group:') ? state.searchIn : 'custom';
      notify();
    });
    $('search-input').addEventListener('input', () => { state.q = $('search-input').value; clearTimeout(debounce); debounce = setTimeout(onChange, 160); });

    const pickerGroups = [];
    fieldGroups.forEach(group => {
      const block = el('div', {class:'filter-picker-group'}, [el('h4', {text:group.name})]);
      group.fields.forEach(field => {
        const button = el('button', {type:'button', class:'filter-field-choice', text:byField.get(field).name, 'data-field':field});
        button.addEventListener('click', () => {
          if (!state.filters.some(filter => filter.field === field)) state.filters.push(defaultFilter(field));
          filterPicker.open = false; $('filter-field-search').value = ''; filterPickerSearch();
          renderFilters(); notify();
          filterRefs.get(field).operator.focus();
        });
        block.append(button);
      });
      pickerGroups.push(block); $('filter-field-options').append(block);
    });
    function filterPickerSearch() {
      const query = fold($('filter-field-search').value);
      pickerGroups.forEach(block => {
        const buttons = [...block.querySelectorAll('button')];
        buttons.forEach(button => { button.hidden = !fold(button.textContent).includes(query); });
        block.hidden = buttons.every(button => button.hidden);
      });
      $('filter-picker-empty').hidden = pickerGroups.some(block => !block.hidden);
    }
    $('filter-field-search').addEventListener('input', filterPickerSearch);
    filterPicker.addEventListener('toggle', () => { if (filterPicker.open) $('filter-field-search').focus(); });
    filterPicker.addEventListener('keydown', event => { if (event.key === 'Escape') { filterPicker.open = false; filterPicker.querySelector('summary').focus(); } });
    function renderFilters() {
      filterRefs.clear(); $('filter-conditions').replaceChildren();
      state.filters.forEach((filter, index) => {
        const spec = byField.get(filter.field);
        const card = el('fieldset', {class:'query-filter', 'data-field':filter.field}, [el('legend', {text:spec.name})]);
        const remove = el('button', {type:'button', class:'filter-remove', text:'Remove', 'aria-label':'Remove '+spec.name+' filter'});
        remove.addEventListener('click', () => { state.filters = state.filters.filter(item => item !== filter); renderFilters(); notify(); $('filter-picker').querySelector('summary').focus(); });
        const operator = el('select', {'aria-label':spec.name+' condition'});
        operators(spec).forEach(([value, label]) => operator.append(option(value,label)));
        operator.value = filter.operator;
        operator.addEventListener('change', () => { filter.operator = operator.value; renderFilters(); notify(); filterRefs.get(filter.field).operator.focus(); });
        const header = el('div', {class:'filter-condition-header'}, [operator]);
        if (['in','contains','equals'].includes(filter.operator) && (spec.multi || spec.type === 'text')) {
          const mode = el('select', {'aria-label':spec.name+' matching mode'}, [option('any','Match any'),option('all','Match all')]);
          mode.value = filter.mode; mode.addEventListener('change', () => { filter.mode = mode.value; notify(); }); header.append(mode);
        }
        header.append(remove); card.append(header);
        const selected = el('div', {class:'filter-selected', 'aria-label':'Selected '+spec.name+' values'});
        card.append(selected);
        const refs = {card, operator, selected, options:[], filter, spec};
        filterRefs.set(filter.field, refs);
        if (filter.operator === 'in') {
          const details = el('details', {class:'filter-values'});
          // Keep newly added filters open until values have been selected.
          details.open = !filter.values.length;
          const summary = el('summary'); details.append(summary); refs.summary = summary;
          const search = el('input', {type:'search', placeholder:'Find a value…', 'aria-label':'Search '+spec.name+' values'});
          const list = el('div', {class:'filter-value-list'});
          const empty = el('p', {class:'filter-value-empty', text:'No matching values.'}); empty.hidden = true;
          [...options.get(filter.field), missing].forEach((value, valueIndex) => {
            const id = 'query-value-'+index+'-'+valueIndex;
            const checkbox = el('input', {id, type:'checkbox', value});
            const count = el('span', {class:'filter-option-count'});
            const label = value === missing ? 'Missing (/)' : value;
            const row = el('label', {class:'filter-value-option', for:id}, [checkbox, el('span', {text:label}), count]);
            checkbox.addEventListener('change', () => {
              filter.values = checkbox.checked ? unique([...filter.values,value]) : filter.values.filter(item => item !== value);
              notify();
            });
            refs.options.push({checkbox, count, row, value, label}); list.append(row);
          });
          search.addEventListener('input', () => {
            refs.options.forEach(item => { item.row.hidden = !fold(item.label).includes(fold(search.value)); });
            empty.hidden = refs.options.some(item => !item.row.hidden);
          });
          details.append(search,list,empty); card.append(details);
        } else if (filter.operator === 'range') {
          const range = el('div', {class:'filter-range'});
          ['from','to'].forEach(key => {
            const input = el('input', {type:'number', min:'1900', max:'2100', placeholder:key === 'from' ? 'From year' : 'To year', 'aria-label':key === 'from' ? 'From year' : 'To year'});
            input.value = filter[key]; input.addEventListener('input', () => { filter[key] = input.value; notify(); }); range.append(input);
          });
          card.append(range);
        } else if (['contains','not_contains','equals'].includes(filter.operator)) {
          const input = el('input', {type:'text', placeholder:'Enter a value, then add', 'aria-label':spec.name+' value'});
          const add = el('button', {type:'button', class:'button small', text:'Add value'});
          const addValue = () => { const value = input.value.trim(); if (!value) return; filter.values = unique([...filter.values,value]); input.value = ''; notify(); input.focus(); };
          add.addEventListener('click',addValue); input.addEventListener('keydown',event => { if (event.key === 'Enter') { event.preventDefault(); addValue(); } });
          card.append(el('div', {class:'filter-text-input'}, [input,add]));
        }
        $('filter-conditions').append(card);
      });
    }
    function refresh() {
      $('clear-filters').hidden = !state.filters.length;
      $('filter-logic').hidden = !state.filters.length;
      filterRefs.forEach(({filter, spec, selected, options:items, summary}) => {
        selected.replaceChildren();
        if (['in','contains','not_contains','equals'].includes(filter.operator)) filter.values.forEach(value => {
          const name = value === missing ? 'Missing (/)' : value;
          const chip = el('button', {type:'button', class:'filter-tag', text:name+' ×', 'aria-label':'Remove '+name+' from '+spec.name});
          chip.addEventListener('click', () => { filter.values = filter.values.filter(item => item !== value); notify(); }); selected.append(chip);
        });
        selected.hidden = !selected.children.length;
        if (summary) summary.textContent = filter.values.length ? filter.values.length+' selected · Edit values' : 'Choose values';
        if (items.length) {
          const counts = new Map();
          data.studies.filter(study => matchesSearch(study) && state.filters.every(other => other === filter || matchesFilter(study, other))).forEach(study => {
            const values = valueCache.get(filter.field).get(study.id);
            (values.length ? unique(values) : [missing]).forEach(value => counts.set(fold(value), (counts.get(fold(value)) || 0)+1));
          });
          items.forEach(item => { const count = counts.get(fold(item.value)) || 0; item.checkbox.checked = filter.values.includes(item.value); item.count.textContent = String(count); item.checkbox.disabled = !count && !item.checkbox.checked; });
          const list = items[0].row.parentElement;
          const focused = list.contains(document.activeElement) ? document.activeElement : null;
          const scrollTop = list.scrollTop;
          [...items].sort((a,b) => Number(b.count.textContent)-Number(a.count.textContent) || a.label.localeCompare(b.label)).forEach((item,index) => {
            if (list.children[index] !== item.row) list.insertBefore(item.row, list.children[index]);
          });
          if (focused && document.activeElement !== focused) focused.focus({preventScroll:true});
          list.scrollTop = scrollTop;
        }
      });
      columnInputs.forEach((input, field) => { input.checked = baseColumnSet.has(field) || state.columns.includes(field); });
      $('columns-summary').textContent = 'Columns ('+columns().length+')';
    }
    $('clear-filters').addEventListener('click', () => { state.filters = []; renderFilters(); notify(); });

    const presets = $('column-preset');
    $('columns-summary').addEventListener('click', () => {
      const panel = $('columns-picker'); panel.hidden = !panel.hidden;
      $('columns-summary').setAttribute('aria-expanded', String(!panel.hidden));
    });
    $('columns-picker').addEventListener('keydown', event => {
      if (event.key === 'Escape') { $('columns-picker').hidden = true; $('columns-summary').setAttribute('aria-expanded','false'); $('columns-summary').focus(); }
    });
    presets.append(option('all','All metadata'),option('basic','ID, Year & Study'));
    Object.entries(groups).forEach(([key,group]) => presets.append(option('group:'+key,group.name)));
    presets.append(option('custom','Custom columns'));
    presets.addEventListener('change', () => {
      if (presets.value === 'custom') return;
      state.columns = presets.value === 'all' ? [...fields] : presets.value === 'basic' ? [...basics] : [...basics, ...groups[presets.value.slice(6)].fields.filter(field => fields.includes(field))];
      state.columns = unique(state.columns); notify();
    });
    fieldGroups.forEach(group => {
      const block = el('fieldset', {class:'column-group'}, [el('legend', {text:group.name})]);
      group.fields.filter(field => fields.includes(field)).forEach(field => {
        const input = el('input', {type:'checkbox', value:field, 'aria-label':'Show '+names[field]});
        input.disabled = baseColumnSet.has(field);
        input.addEventListener('change', () => { state.columns = input.checked ? unique([...state.columns,field]) : state.columns.filter(item => item !== field); presets.value = 'custom'; notify(); });
        columnInputs.set(field,input); block.append(el('label', {}, [input, names[field]]));
      });
      $('column-options').append(block);
    });
    $('column-search').addEventListener('input', () => {
      const query = fold($('column-search').value);
      columnInputs.forEach((input,field) => { input.parentElement.hidden = !fold(names[field]).includes(query); });
      $('column-options').querySelectorAll('fieldset').forEach(block => { block.hidden = [...block.querySelectorAll('label')].every(label => label.hidden); });
    });
    function columns() { return [...basics, ...fields.filter(field => !baseColumnSet.has(field) && state.columns.includes(field))]; }
    const legacyFields = {year:'RQ1 Year', venue:'RQ2 Venue', venueType:'RQ3 VenueType', paperType:'RQ3 PaperType', activity:'RQ4 SEActivity', seTask:'RQ4 SETask', task:'RQ5 MDETask', language:'RQ6 ModelingLanguage', category:'@category', modelType:'RQ6 ModelType', domain:'RQ7 ApplicationDomain', llm:'RQ8 FoundationLLMFamiliy', enhancement:'RQ10 EnhancementTechnique', artifact:'@artifact'};
    function sync() {
      $('search-input').value = state.q; searchScope.value = state.searchIn;
      presets.value = state.columns.length === fields.length ? 'all' : state.columns.every(field => baseColumnSet.has(field)) ? 'basic' : 'custom';
      renderFilters(); refresh();
    }
    function read(params) {
      clearTimeout(debounce); state = defaults(); state.q = params.get('q') || '';
      let legacyColumns = null;
      if (fields.includes(params.get('field'))) { state.searchIn = 'field:'+params.get('field'); legacyColumns = [...basics,params.get('field')]; }
      else if (groups[params.get('group')]) { state.searchIn = 'group:'+params.get('group'); legacyColumns = [...basics,...groups[params.get('group')].fields.filter(field => fields.includes(field))]; }
      else if (params.get('scope') === 'title') { state.searchIn = 'field:Title'; legacyColumns = [...basics]; }
      if (legacyColumns) state.columns = unique(legacyColumns);
      if (allowedSearch.has(params.get('searchIn'))) { state.searchIn = params.get('searchIn'); state.columns = columnsForSearch(); }
      try { const columns = JSON.parse(params.get('columns')); if (Array.isArray(columns)) state.columns = unique([...basics,...columns.filter(field => fields.includes(field))]); } catch (_) { /* Ignore malformed optional view parameters. */ }
      try { const filters = JSON.parse(params.get('filters')); if (Array.isArray(filters)) state.filters = filters.map(cleanFilter).filter(Boolean).filter((filter,index,all) => all.findIndex(other => other.field === filter.field) === index); } catch (_) { /* Existing links may omit structured filters. */ }
      Object.entries(legacyFields).forEach(([key,field]) => {
        if (!params.has(key) || state.filters.some(filter => filter.field === field)) return;
        const values = params.getAll(key).filter(Boolean);
        const filter = cleanFilter({field,operator:key === 'artifact' && values.includes('any') ? 'present' : 'in',values});
        if (filter && (filter.values.length || filter.operator === 'present')) state.filters.push(filter);
      });
      sync();
    }
    function write(params) {
      if (state.q) params.set('q',state.q);
      if (state.searchIn !== 'all') params.set('searchIn',state.searchIn);
      if (state.filters.length) params.set('filters',JSON.stringify(state.filters));
      if (columns().length !== fields.length) params.set('columns',JSON.stringify(columns()));
    }
    return {matches, columns, refresh, read, write, reset:() => {
      clearTimeout(debounce); state = defaults();
      $('filter-field-search').value = ''; filterPickerSearch(); filterPicker.open = false;
      $('column-search').value = ''; $('column-search').dispatchEvent(new Event('input')); $('columns-picker').hidden = true; $('columns-summary').setAttribute('aria-expanded','false');
      sync();
    },
      caption:() => columns().length === fields.length ? 'All metadata' : columns().length === basics.length ? 'ID, Year & Study' : 'Selected columns'};
  }
  window.CatalogQuery = {create};
})();
