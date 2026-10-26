(function () {
  'use strict';
  const D = window.LLM4MDE_DATA;
  const definitions = window.LLM4MDE_DEFINITIONS;
  const {el, link, catalog} = window.Site;
  D.criteria.forEach((criterion, index) => {
    const list = document.getElementById(index < 4 ? 'inclusion-list' : 'exclusion-list');
    list.append(el('li', {}, [el('span', {class: 'criterion-number', 'aria-hidden': 'true', text: String(index + 1).padStart(2, '0')}), el('span', {text: criterion})]));
  });
  document.getElementById('search-query').textContent = D.searchQuery;
  const queryGroups = D.searchQuery.split(/\)\s+AND\s+\(/);
  ['mde-terms', 'llm-terms'].forEach((id, index) => {
    const list = document.getElementById(id);
    for (const match of queryGroups[index].matchAll(/"([^"]+)"/g)) {
      list.append(el('li', {text: match[1]}));
    }
  });
  function renderDefinitionCards(items, containerId, queryFor, countFor) {
    items.forEach((item, i) => {
      const titleId = containerId + '-title-' + i;
      const count = countFor(item);
      const card = el('article', {class: 'dimension-card', 'aria-labelledby': titleId});
      card.append(el('div', {class: 'dimension-heading'}, [
        el('span', {class: 'dimension-number', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0')}),
        el('h3', {id: titleId, text: item.name}),
        el('span', {class: 'dimension-count', text: count + (count === 1 ? ' study' : ' studies')})
      ]), el('p', {class: 'dimension-question', text: item.definition}), el('div', {class: 'dimension-actions'}, [
        link('Explore this category', catalog(queryFor(item)), '', 'catalog')
      ]));
      document.getElementById(containerId).append(card);
    });
  }
  renderDefinitionCards(definitions.paperTypes, 'paper-type-list', item => ({paperType: item.name}), item => D.studies.filter(study => study.paperType === item.name).length);
  renderDefinitionCards(definitions.applicationDomains, 'domain-list', item => ({domain: item.name, field: 'RQ7 ApplicationDomain'}), item => D.studies.filter(study => study.facets.domains.includes(item.name)).length);
  const order = D.categories.map(category => category.name);
  order.forEach((name, i) => {
    const category = D.categories.find(c => c.name === name);
    const titleId = 'model-category-title-' + i;
    const card = el('article', {class: 'dimension-card', 'aria-labelledby': titleId});
    card.append(el('div', {class: 'dimension-heading'}, [
      el('span', {class: 'dimension-number', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0')}),
      el('h3', {id: titleId, text: name.replaceAll('/', ' / ')}),
      el('span', {class: 'dimension-count', text: category.count + ' studies'})
    ]), el('p', {class: 'dimension-question', text: category.definition}));
    const types = el('ul', {class: 'dimension-tags', 'aria-label': name + ' model types'});
    category.types.forEach(type => types.append(el('li', {text: type})));
    card.append(types, el('div', {class: 'dimension-actions'}, [link('Explore this category', catalog({category: name, paperType: 'Proposed method'}), '', 'catalog')]));
    document.getElementById('model-categories').append(card);
  });
  const taskList = document.getElementById('task-list');
  D.tasks.forEach((task, i) => {
    const titleId = 'task-title-' + task.number;
    const card = el('article', {class: 'dimension-card', 'aria-labelledby': titleId});
    const count = task.proposedCount || task.count;
    card.append(el('div', {class: 'dimension-heading'}, [
      el('span', {class: 'dimension-number', 'aria-hidden': 'true', text: String(task.number).padStart(2, '0')}),
      el('h3', {id: titleId, text: task.name}),
      el('span', {class: 'dimension-count', text: count + (count === 1 ? ' study' : ' studies')})
    ]), el('p', {class: 'dimension-question', text: task.definition}), el('div', {class: 'dimension-actions'}, [
      link('Explore this category', catalog({task: task.name, paperType: task.proposedCount ? 'Proposed method' : 'Benchmarking and evaluation'}), '', 'catalog')
    ]));
    if (i >= 8) card.hidden = true; taskList.append(card);
  });
  document.getElementById('show-all-tasks').addEventListener('click', function () {
    const expanded = this.getAttribute('aria-expanded') !== 'true';
    Array.from(taskList.children).forEach((c, i) => { c.hidden = !expanded && i >= 8; });
    this.setAttribute('aria-expanded', String(expanded)); this.textContent = expanded ? 'Show fewer task definitions' : 'Show all 25 task definitions'; window.Site.decorateIcon(this, expanded ? 'minus' : 'plus');
  });
  const dimensionQuestions = {
    Scope: 'Does it assess meaning or syntax?',
    Aspect: 'Which quality aspect is assessed?',
    Measurement: 'How is the result expressed?',
    Reference: 'Is an external reference required?',
    Perspective: 'Does the assessment depend on judgment?',
    Type: 'What kind of metric is used?'
  };
  D.dimensions.forEach((dimension, i) => {
    const titleId = 'dimension-title-' + i;
    const card = el('article', {class: 'dimension-card', 'aria-labelledby': titleId});
    const heading = el('div', {class: 'dimension-heading'}, [
      el('span', {class: 'dimension-number', 'aria-hidden': 'true', text: String(i + 1).padStart(2, '0')}),
      el('h3', {id: titleId, text: dimension.name}),
      el('span', {class: 'dimension-count', text: dimension.categories.length + ' categories'})
    ]);
    const categories = el('ul', {class: 'dimension-tags', 'aria-label': dimension.name + ' categories'});
    dimension.categories.forEach(category => categories.append(el('li', {text: category.name})));
    const detail = el('details', {class: 'dimension-definitions'});
    detail.append(el('summary', {text: 'Category definitions'}));
    const definitions = el('dl');
    dimension.categories.forEach(category => definitions.append(el('div', {}, [
      el('dt', {text: category.name}), el('dd', {text: category.definition})
    ])));
    detail.append(definitions);
    card.append(heading, el('p', {class: 'dimension-question', text: dimensionQuestions[dimension.name]}), categories, detail);
    document.getElementById('dimension-list').append(card);
  });
  function activateTab(button) {
    document.querySelectorAll('[data-tab]').forEach(b => { const active = b === button; b.setAttribute('aria-selected', String(active)); b.tabIndex = active ? 0 : -1; document.getElementById(b.getAttribute('aria-controls')).hidden = !active; });
  }
  document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => activateTab(b)));
  document.querySelectorAll('[role=tablist]').forEach(list => list.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = Array.from(list.querySelectorAll('[role=tab]')); let index = tabs.indexOf(document.activeElement);
    if (index < 0) return; event.preventDefault();
    index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    tabs[index].click(); tabs[index].focus();
  }));
  const imageDialog = document.getElementById('image-dialog');
  function enlarge(src, caption) { const image = document.getElementById('expanded-image'); image.src = src; image.alt = caption; document.getElementById('expanded-caption').textContent = caption; imageDialog.showModal(); }
  document.querySelectorAll('[data-enlarge]').forEach(b => b.addEventListener('click', () => enlarge(b.dataset.enlarge, b.dataset.caption)));
  imageDialog.querySelector('.dialog-close').addEventListener('click', () => imageDialog.close());
  imageDialog.addEventListener('click', e => { if (e.target === imageDialog && (e.clientX < imageDialog.getBoundingClientRect().left || e.clientX > imageDialog.getBoundingClientRect().right)) imageDialog.close(); });
})();
