(function () {
  'use strict';
  const D = window.LLM4MDE_DATA;
  const {el, link, download, safeUrl, toast, authorText} = window.Site;
  const $ = id => document.getElementById(id);
  const fieldNames = {
    'ID':'ID',
    'Title':'Title', 'RQ1 Year':'Year', 'RQ2 Venue':'Venue', 'RQ3 VenueType':'Venue type', 'RQ3 PaperType':'Paper type',
    'RQ4 SEActivity':'SE activities', 'RQ4 SETask':'SE tasks', 'RQ5 MDETask':'MDE tasks', 'RQ5 SETaskMDETask':'SE task–MDE task mapping',
    'RQ6 ModelingLanguage':'Modeling languages', 'RQ6 ModelType':'Model types', 'RQ6 ModelingLanguageModelType':'Language–model type mapping', 'RQ7 ApplicationDomain':'Application domains',
    'RQ8 FoundationLLMFamiliy':'Foundation LLMs', 'RQ8 VersionParameter':'LLM versions & parameter sizes', 'RQ8 LLMAccessMode':'LLM access mode', 'RQ8 PipelineLLMComposition':'Pipeline composition',
    'RQ9 Prompt-engineering':'Prompt engineering', 'RQ10 EnhancementTechnique':'Enhancement techniques', 'RQ10 EnhancedLLM':'Enhanced LLMs',
    'RQ11 Integration':'MDE tool integration', 'RQ12 InteractionPattern':'Human interaction',
    'RQ14 EffectivenessMetric':'Effectiveness metrics', 'RQ14 MDETaskMetric':'MDE task–metric mapping', 'RQ14 TimeCostMetric':'Time cost metrics', 'RQ14 ResourceCostMetric':'Resource cost metrics',
    'RQ15 Baseline':'Baselines', 'RQ15 MDETaskBaseline':'MDE task–baseline mapping', 'RQ16 EvaluationSubjectType':'Evaluation subject types',
    'RQ16 AvailableComponents':'Available replication materials', 'RQ16 SourceCodeLink':'Source code links', 'RQ16 PromptLink':'Prompt links', 'RQ16 EvaluationSubjectLink':'Evaluation subject links', 'RQ16 EnhancedLLMLink':'Enhanced LLM links'
  };
  const mappingFields = new Set(['RQ5 SETaskMDETask', 'RQ6 ModelingLanguageModelType', 'RQ14 MDETaskMetric', 'RQ15 MDETaskBaseline']);
  const excludedComparisonFields = new Set([...mappingFields, 'RQ16 AvailableComponents', 'BibTex']);
  const comparisonFields = D.fields.filter(field => !excludedComparisonFields.has(field));
  function displayValue(value) {
    const source = String(value ?? '');
    const brackets = [];
    let output = '';
    for (let i = 0; i < source.length; i++) {
      if (source[i] === '[') {
        // Lists lose their wrappers; attributes attached to a name use parentheses.
        const attribute = /[^\s[\];:,]$/.test(source.slice(0, i).trimEnd());
        brackets.push(attribute);
        if (attribute) output += ' (';
      } else if (source[i] === ']') {
        if (brackets.pop()) output += ')';
      } else output += source[i];
    }
    return output.trim().replaceAll('&amp;', '&');
  }
  function tableValue(value) {
    return displayValue(value).replace(/(^|[;:(]\s*)(?:no|n\/a|none)(?=\s*(?:[;)]|$))/gi, '$1/').trim() || '/';
  }
  function metricCards(value) {
    const source = String(value ?? '');
    const pattern = /([^;\[\]]+)\[([^\[\]]+)\]/g;
    const metrics = [...source.matchAll(pattern)];
    if (!metrics.length || source.replace(pattern, '').replace(/[;\s]/g, '') || metrics.some(metric => metric[2].split(';').length !== 5)) {
      return el('span', {text: tableValue(value)});
    }
    const dimensions = [
      {key:'scope', name:'Scope', values:{Sem:'Semantic', Syn:'Syntactic', 'Sem+Syn':'Semantic-syntactic'}},
      {key:'aspect', name:'Aspect', values:{'Correctness+Completeness':'Correctness + Completeness'}},
      {key:'reference', name:'Reference', values:{True:'Reference-based', False:'Reference-free'}},
      {key:'measurement', name:'Measurement', values:{Quant:'Quantitative', Qual:'Qualitative'}},
      {key:'perspective', name:'Perspective', values:{obj:'Objective', subj:'Subjective'}}
    ];
    const list = el('ul', {class:'catalog-metric-list', 'aria-label':'Effectiveness metrics'});
    metrics.forEach(metric => {
      const tags = el('div', {class:'catalog-metric-tags'});
      metric[2].split(';').forEach((term, index) => {
        const dimension = dimensions[index];
        const label = dimension.values[term.trim()] || term.trim();
        tags.append(el('span', {class:'catalog-metric-tag metric-'+dimension.key, title:dimension.name+': '+label, text:label}), ' ');
      });
      list.append(el('li', {class:'catalog-metric-card'}, [el('strong', {class:'catalog-metric-name', text:metric[1].trim()}), tags]));
    });
    return list;
  }
  const groups = {
    bibliographic: {name:'Bibliometric Analysis', fields:D.fields.filter(f => /^RQ[123] /.test(f))},
    scope: {name:'Application Scope', fields:D.fields.filter(f => /^RQ[4567] /.test(f))},
    technical: {name:'Technical Characterization', fields:D.fields.filter(f => /^RQ(?:8|9|10|11|12) /.test(f))},
    evaluation: {name:'Evaluation Practices', fields:D.fields.filter(f => /^RQ1[45] /.test(f) || f === 'RQ16 EvaluationSubjectType')},
    artifacts: {name:'Replication Materials', fields:D.fields.filter(f => f.startsWith('RQ16 ') && f !== 'RQ16 EvaluationSubjectType')}
  };
  const defaultState = () => ({sort:'newest', view:'table', page:1, size:25});
  let state = defaultState(), filtered = [], selectedStudy = null;
  const sizes = {};
  const dialog = $('study-dialog');
  const typeClass = type => type.startsWith('Benchmark') ? 'benchmark' : type.startsWith('New') ? 'vision' : type === 'Tool demo' ? 'demo' : '';
  const query = window.CatalogQuery.create({data:D, fields:comparisonFields, groups, names:fieldNames, display:displayValue,
    onChange:() => { state.page = 1; render(); }});
  function readUrl() {
    const params = new URLSearchParams(location.search); state = defaultState(); query.read(params);
    if (['newest','oldest','title','id'].includes(params.get('sort'))) state.sort = params.get('sort');
    if (params.get('view') === 'cards') state.view = 'cards';
    if ([25,50,100].includes(Number(params.get('size')))) state.size = Number(params.get('size'));
    state.page = Math.max(1, Math.min(1000, Number.parseInt(params.get('page'),10) || 1));
    selectedStudy = D.studies.find(s => s.id === Number(params.get('study'))) || null;
    syncInputs(); render(false);
    if (selectedStudy) openStudy(selectedStudy, false);
    else if (dialog.open) dialog.close();
  }
  function syncInputs() { $('sort-order').value = state.sort; $('page-size').value = state.size; }
  function writeUrl() {
    const params = new URLSearchParams(); query.write(params);
    if (state.sort !== 'newest') params.set('sort', state.sort);
    if (state.view !== 'table') params.set('view', state.view);
    if (state.size !== 25) params.set('size', String(state.size));
    if (state.page !== 1) params.set('page', String(state.page));
    if (selectedStudy) params.set('study', String(selectedStudy.id));
    const search = params.toString();
    try { history.replaceState(null, '', location.pathname + (search ? '?'+search : '') + location.hash); } catch (_) { /* Local-file browsers may restrict history. */ }
  }
  function sortStudies(a,b) {
    if (state.sort === 'id') return a.id-b.id;
    if (state.sort === 'title') return a.title.localeCompare(b.title) || a.id-b.id;
    return (state.sort === 'oldest' ? a.year-b.year : b.year-a.year) || a.id-b.id;
  }
  function reset() { state = defaultState(); selectedStudy = null; query.reset(); syncInputs(); render(); }
  function render(updateUrl = true) {
    filtered = D.studies.filter(query.matches).sort(sortStudies);
    const pages = Math.max(1, Math.ceil(filtered.length/state.size)); state.page = Math.min(state.page, pages);
    const start = (state.page-1)*state.size; const visible = filtered.slice(start,start+state.size);
    $('result-count').textContent = filtered.length + ' of 235 studies' + (filtered.length ? ' · Showing '+(start+1)+'–'+(start+visible.length) : '');
    $('table-view-button').setAttribute('aria-pressed', String(state.view === 'table'));
    $('cards-view-button').setAttribute('aria-pressed', String(state.view === 'cards'));
    $('table-container').hidden = !filtered.length || state.view !== 'table';
    $('table-help').hidden = !filtered.length || state.view !== 'table';
    $('cards-container').hidden = !filtered.length || state.view !== 'cards';
    $('empty-state').hidden = !!filtered.length; $('pagination').hidden = !filtered.length; $('export-results').disabled = !filtered.length;
    $('previous-page').disabled = state.page <= 1; $('next-page').disabled = state.page >= pages; $('page-number').textContent = state.page+' / '+pages;
    query.refresh();
    if (state.view === 'table') renderTable(visible); else renderCards(visible);
    if (updateUrl) writeUrl();
  }
  function studyTitle(s) {
    const button = el('button', {class:'study-title', text:s.title, 'aria-label':'Open study '+s.id+': '+s.title});
    button.addEventListener('click', () => openStudy(s)); return button;
  }
  function shortAuthors(s) { const authors = authorText(s.authors).split(' and '); return authors.slice(0,3).join(' · ') + (authors.length > 3 ? ' · +'+(authors.length-3)+' authors' : ''); }
  function typeBadge(s) { return el('span', {class:'study-type '+typeClass(s.paperType), text:s.paperType}); }
  function renderTable(studies) {
    const selectedFields = query.columns().filter(f => !['ID','Title','RQ1 Year'].includes(f));
    const columns = [
      {key:'ID', name:'ID', width:68}, {key:'RQ1 Year', name:'Year', width:75}, {key:'Title', name:'Study', width:375},
      ...selectedFields.map(f => ({key:f, name:fieldNames[f], width:f === 'RQ14 EffectivenessMetric' ? 390 : /Metric|Mapping|SETaskMDETask|LanguageModelType|VersionParameter|MDETaskBaseline/.test(f) ? 300 : 220}))
    ];
    const table = el('table', {class:'study-table'}); const colgroup = el('colgroup');
    const widths = columns.map(c => sizes[c.key] || c.width);
    const setTableWidth = () => { table.style.width = widths.reduce((a,b) => a+b,0)+'px'; table.style.minWidth = '100%'; };
    widths.forEach(w => { const col = el('col'); col.style.width = w+'px'; colgroup.append(col); }); table.append(colgroup); setTableWidth();
    table.append(el('caption', {text:'Comparing '+query.caption()}));
    const head = el('tr'); columns.forEach((c,index) => {
      const th = el('th', {scope:'col', title:c.name, 'data-field':c.key}, [c.name]);
      const handle = el('span', {class:'resizer', role:'separator', tabindex:'0', 'aria-label':'Resize '+c.name+' column', 'aria-orientation':'vertical', 'aria-valuenow':widths[index], 'aria-valuemin':60, 'aria-valuemax':900});
      const resize = width => { widths[index] = Math.max(60,Math.min(900,width)); sizes[c.key] = widths[index]; colgroup.children[index].style.width = widths[index]+'px'; handle.setAttribute('aria-valuenow',widths[index]); setTableWidth(); };
      handle.addEventListener('pointerdown', e => {
        e.preventDefault(); handle.setPointerCapture(e.pointerId); const x = e.clientX, width = widths[index];
        const move = event => resize(width+event.clientX-x);
        const done = () => { handle.removeEventListener('pointermove',move); handle.removeEventListener('pointerup',done); handle.removeEventListener('pointercancel',done); };
        handle.addEventListener('pointermove',move); handle.addEventListener('pointerup',done); handle.addEventListener('pointercancel',done);
      });
      handle.addEventListener('keydown', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); resize(widths[index]+(e.key === 'ArrowRight' ? 20 : -20)); } });
      th.append(handle); head.append(th);
    }); table.append(el('thead',{},[head])); const body = el('tbody');
    studies.forEach(s => {
      const row = el('tr', {'data-study-id':s.id});
      columns.forEach(c => {
        const cell = el('td');
        if (c.key === 'Title') cell.append(studyTitle(s), el('div',{class:'study-authors',text:shortAuthors(s)}),typeBadge(s),el('div',{class:'study-authors',text:displayValue(s.venue)}));
        else if (c.key === 'ID') cell.append(el('span',{class:'study-id',text:String(s.id).padStart(3,'0')}));
        else if (c.key === 'RQ14 EffectivenessMetric') cell.append(el('div', {class:'cell-content metric-cell', tabindex:'0', role:'region', 'aria-label':'Effectiveness metrics for study '+s.id}, [metricCards(s.raw[c.key])]));
        else cell.append(el('div',{class:'cell-content',text:tableValue(s.raw[c.key]), 'data-field':c.key}));
        row.append(cell);
      }); body.append(row);
    }); table.append(body); $('table-container').replaceChildren(table);
  }
  function renderCards(studies) {
    const container = $('cards-container'); container.replaceChildren();
    studies.forEach(s => {
      const card = el('article',{class:'study-card','data-study-id':s.id});
      card.append(el('div',{class:'card-top'},[el('span',{class:'study-id',text:'ID '+String(s.id).padStart(3,'0')+' · '+s.year}),typeBadge(s)]),studyTitle(s),el('div',{class:'study-authors',text:shortAuthors(s)}),el('div',{class:'study-venue',text:displayValue(s.venue)}));
      const button = el('button',{class:'button small','data-icon':'document',text:'Study details'}); button.addEventListener('click',()=>openStudy(s));card.append(button);container.append(card);
    });
  }
  function openStudy(s, updateUrl = true) {
    selectedStudy = s; const header = el('div',{class:'detail-header'});
    header.append(el('span',{class:'study-id',text:'DATASET ID '+String(s.id).padStart(3,'0')+' · '+s.year}),el('h2',{id:'detail-title',text:s.title}),el('p',{class:'authors-text',text:authorText(s.authors)}),el('p',{class:'study-venue',text:displayValue(s.venue)+' · '+s.venueType.trim()}),typeBadge(s));
    const actions = el('div',{class:'actions'});
    if (safeUrl(s.url)) actions.append(link('Paper',safeUrl(s.url),'button small','document'));
    if (actions.childElementCount) header.append(actions);
    const body = el('div',{class:'detail-body'});
    body.append(el('h3',{text:'Available artifact links'})); const links = el('div',{class:'detail-links'}); let linkCount = 0;
    Object.entries(s.links).forEach(([name,urls]) => urls.forEach((url,i) => { const safe = safeUrl(url); if (safe) { links.append(link(name+(urls.length>1?' '+(i+1):''),safe,'button small','link')); linkCount++; } }));
    body.append(linkCount ? links : el('p',{class:'tab-note',text:'No artifact URL is recorded for this study. Availability labels are shown below as reported.'}));
    Object.entries(groups).forEach(([key,group]) => {
      body.append(el('h3',{text:group.name})); const grid = el('dl',{class:'detail-grid'});
      group.fields.filter(field => !mappingFields.has(field)).forEach(field => {
        const wide = /Metric|Link|SETaskMDETask|LanguageModelType|MDETaskBaseline|VersionParameter/.test(field);
        const value = field === 'RQ14 EffectivenessMetric'
          ? el('dd', {class:'metric-detail'}, [metricCards(s.raw[field])])
          : el('dd', {text:tableValue(s.raw[field])});
        grid.append(el('div',{class:'detail-field'+(wide?' wide':'')},[el('dt',{text:fieldNames[field]}),value]));
      }); body.append(grid);
    });
    $('study-detail').replaceChildren(header,body);
    if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; if (updateUrl) writeUrl();
  }
  dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{ selectedStudy = null; writeUrl(); });
  dialog.addEventListener('click',e=>{if(e.target === dialog){const rect=dialog.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)dialog.close();}});
  $('sort-order').addEventListener('change',()=>{state.sort=$('sort-order').value;state.page=1;render();});
  $('page-size').addEventListener('change',()=>{state.size=Number($('page-size').value);state.page=1;render();});
  $('table-view-button').addEventListener('click',()=>{state.view='table';render();}); $('cards-view-button').addEventListener('click',()=>{state.view='cards';render();});
  $('previous-page').addEventListener('click',()=>{state.page--;render();$('result-count').scrollIntoView({block:'center'});});
  $('next-page').addEventListener('click',()=>{state.page++;render();$('result-count').scrollIntoView({block:'center'});});
  $('reset-filters').addEventListener('click',reset);$('empty-reset').addEventListener('click',reset);
  $('export-results').addEventListener('click',()=>{
    const quote = value => '"'+String(value ?? '').replaceAll('"','""')+'"';
    const csv = [D.fields,...filtered.map(s=>D.fields.map(f=>s.raw[f]))].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
    download('llm4mde-studies-'+filtered.length+'.csv','\ufeff'+csv,'text/csv;charset=utf-8');toast('Exported '+filtered.length+' studies with all 36 source columns');
  });
  window.addEventListener('popstate',readUrl);
  readUrl();
})();
