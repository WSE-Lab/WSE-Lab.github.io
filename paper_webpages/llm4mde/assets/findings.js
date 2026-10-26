/* Interactive, locally rendered statistics. No manuscript figure images are used. */
(function () {
  'use strict';
  const {el, decorateIcon} = window.Site;
  const parts = window.LLM4MDE_FINDINGS.parts;
  const dialog = document.getElementById('chart-dialog');
  const dialogBody = document.getElementById('chart-dialog-body');
  const chartTitle = document.getElementById('chart-dialog-title');
  let chartOpener = null;
  const meta = [
    {key: 'bibliometric', cohort: '235 primary studies', topics: ['Publication growth', 'Publication venues', 'Contribution types']},
    {key: 'scope', cohort: '159 proposed-method studies', topics: ['Tasks and languages', 'Model types', 'Application domains']},
    {key: 'technical', cohort: '159 proposed-method studies', topics: ['Models and prompting', 'Enhancement techniques', 'Tools and human involvement']},
    {key: 'evaluation', cohort: '235 primary studies', topics: ['Benchmarking scope', 'Evaluation metrics', 'Baselines and replication']}
  ];

  function renderChart(chart, expanded = false) {
    const wrapper = el('div', {class: 'analysis-card', 'data-chart-id': chart.id});
    const heading = el('div', {class: 'analysis-heading'}, [el('div', {}, [
      el('h4', {text: chart.title}), el('p', {class: 'analysis-scope', text: chart.scope})
    ])]);
    const actions = el('div', {class: 'analysis-actions'});
    if (!expanded) {
      const enlarge = el('button', {type: 'button', class: 'button small', 'data-icon': 'expand', text: 'Enlarge chart', 'aria-label': 'Enlarge ' + chart.title});
      enlarge.addEventListener('click', () => {
        chartOpener = enlarge;
        chartTitle.textContent = chart.title;
        dialog.dataset.part = chart.part;
        dialogBody.replaceChildren(renderChart(chart, true));
        dialog.showModal(); dialog.scrollTop = 0;
      });
      actions.append(enlarge);
    }
    heading.append(actions); wrapper.append(heading);

    const maximum = Math.max(1, ...chart.rows.flatMap(row => row.values));
    const unit = Math.pow(10, Math.floor(Math.log10(maximum / 5)));
    const step = Math.max(1, unit * [1, 2, 5, 10].find(value => value >= maximum / 5 / unit));
    const scaleMax = Math.ceil(maximum / step) * step;
    wrapper.style.setProperty('--grid-step', (step / scaleMax * 100) + '%');
    const legend = el('div', {class: 'analysis-legend'});
    chart.series.forEach((name, i) => legend.append(el('span', {}, [el('i', {class: 'series-key series-' + i, 'aria-hidden': 'true'}), name])));
    wrapper.append(legend);
    const scale = el('div', {class: 'analysis-axis', 'aria-hidden': 'true'}, [el('span', {text: 'Number of studies'})]);
    const ticks = el('div', {class: 'analysis-ticks'});
    for (let value = 0; value <= scaleMax; value += step) ticks.append(el('span', {text: String(value)}));
    scale.append(ticks); wrapper.append(scale);

    const bars = el('ol', {class: 'analysis-bars', 'aria-label': chart.title});
    function renderRow(row, index, child = false) {
      const item = el('li', {class: 'analysis-row'});
      item.hidden = !child && !expanded && index >= chart.previewRows;
      const label = el('span', {class: 'analysis-label', text: row.label});
      if (row.fullName) {
        label.title = row.fullName;
        label.classList.add('analysis-language-label');
      }
      item.append(label);
      const values = el('div', {class: 'analysis-values'});
      row.values.forEach((value, series) => {
        const track = el('span', {class: 'analysis-track', 'aria-hidden': 'true'});
        const fill = el('span', {class: 'analysis-fill series-' + series});
        fill.style.width = (value / scaleMax * 100) + '%';
        track.append(fill);
        values.append(el('div', {class: 'analysis-series', title: row.label + ' · ' + chart.series[series] + ': ' + value}, [
          el('span', {class: 'sr-only', text: chart.series[series] + ': '}), track, el('strong', {text: String(value)})
        ]));
      });
      item.append(values);
      if (row.children && row.children.length) {
        const id = 'model-types-' + (expanded ? 'dialog-' : 'inline-') + index;
        const toggle = el('button', {type: 'button', class: 'analysis-type-toggle', 'data-icon': 'plus', 'aria-expanded': 'false', 'aria-controls': id}, [
          el('span', {}, [el('span', {text: row.label}), el('small', {text: row.children.length + ' model types'})])
        ]);
        label.replaceChildren(toggle);
        const types = el('ol', {id, class: 'analysis-bars analysis-types', 'aria-label': row.label + ' model types'});
        types.hidden = true;
        row.children.forEach((type, i) => types.append(renderRow(type, i, true)));
        toggle.addEventListener('click', () => {
          types.hidden = !types.hidden;
          toggle.setAttribute('aria-expanded', String(!types.hidden));
          decorateIcon(toggle, types.hidden ? 'plus' : 'minus');
        });
        item.append(types);
      }
      return item;
    }
    chart.rows.forEach((row, index) => bars.append(renderRow(row, index)));
    wrapper.append(bars);
    if (!expanded && chart.rows.length > chart.previewRows) {
      const more = el('button', {type: 'button', class: 'analysis-more', 'data-icon': 'plus', 'aria-expanded': 'false', text: 'Show all ' + chart.rows.length + ' categories'});
      more.addEventListener('click', () => {
        const all = more.getAttribute('aria-expanded') !== 'true';
        Array.from(bars.children).forEach((row, i) => { row.hidden = !all && i >= chart.previewRows; });
        more.setAttribute('aria-expanded', String(all));
        more.textContent = all ? 'Show fewer categories' : 'Show all ' + chart.rows.length + ' categories';
        decorateIcon(more, all ? 'minus' : 'plus');
      });
      wrapper.append(el('p', {class: 'analysis-preview-note', text: 'Preview shows the first ' + chart.previewRows + ' of ' + chart.rows.length + ' categories.'}), more);
      more.addEventListener('click', () => {
        wrapper.querySelector('.analysis-preview-note').textContent = more.getAttribute('aria-expanded') === 'true'
          ? 'Showing all ' + chart.rows.length + ' categories.'
          : 'Preview shows the first ' + chart.previewRows + ' of ' + chart.rows.length + ' categories.';
      });
    }
    wrapper.append(el('p', {class: 'analysis-note', text: chart.note}));
    return wrapper;
  }

  function wireTabs(tablist) {
    const tabs = Array.from(tablist.children);
    function activate(active) {
      tabs.forEach(tab => {
        const selected = tab === active;
        tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
      });
    }
    tabs.forEach(tab => tab.addEventListener('click', () => activate(tab)));
    tablist.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const current = tabs.indexOf(document.activeElement); if (current < 0) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      activate(tabs[next]); tabs[next].focus();
    });
  }

  document.querySelectorAll('#findings .finding-part').forEach((article, index) => {
    const part = meta[index];
    article.dataset.part = part.key;
    article.querySelector('.finding-part-heading').append(el('span', {class: 'finding-cohort', text: part.cohort}));
    const summary = article.querySelector('.finding-summary');
    Array.from(summary.children).forEach((paragraph, i) => {
      const block = el('div', {class: 'summary-block'}, [el('h4', {text: part.topics[i]})]);
      paragraph.replaceWith(block); block.append(paragraph);
    });
    const summaryId = 'finding-' + part.key + '-summary';
    const summaryTabId = summaryId + '-tab';
    const tablist = el('div', {class: 'finding-tabs', role: 'tablist', 'aria-label': article.querySelector('h3').textContent + ' views'});
    const summaryTab = el('button', {type: 'button', role: 'tab', id: summaryTabId, 'aria-controls': summaryId, 'aria-selected': 'true', text: 'Summary'});
    tablist.append(summaryTab);
    const panels = el('div', {class: 'finding-panels'});
    const summaryPanel = el('div', {id: summaryId, role: 'tabpanel', 'aria-labelledby': summaryTabId, tabindex: '0'}, [summary]);
    panels.append(summaryPanel);
    const metricGroups = [
      {id: 'effectiveness-metrics', label: 'Effectiveness metrics', labels: {'metric-scopes': 'Scope', 'quality-aspects': 'Aspect', 'metric-measurement': 'Measurement', 'metric-reference': 'Reference', 'metric-perspective': 'Perspective', 'metric-type': 'Type'}},
      {id: 'cost-metrics', label: 'Cost metrics', labels: {'time-cost': 'Time metrics', 'resource-cost': 'Resource metrics'}}
    ];
    parts[part.key].forEach(chart => {
      chart.part = part.key;
      const group = part.key === 'evaluation' && metricGroups.find(group => Object.hasOwn(group.labels, chart.id));
      if (group && !group.tabs) {
        const metricsId = 'finding-evaluation-' + group.id;
        tablist.append(el('button', {type: 'button', role: 'tab', id: metricsId + '-tab', 'aria-controls': metricsId, 'aria-selected': 'false', tabindex: '-1', text: group.label}));
        group.tabs = el('div', {class: 'finding-tabs finding-subtabs', role: 'tablist', 'aria-label': group.label + ' categories'});
        group.panels = el('div', {class: 'finding-metric-panels'});
        const metricGroup = el('div', {id: metricsId, role: 'tabpanel', 'aria-labelledby': metricsId + '-tab'}, [group.tabs, group.panels]);
        metricGroup.hidden = true;
        panels.append(metricGroup);
      }
      const id = 'finding-' + part.key + '-' + chart.id;
      const selected = Boolean(group && !group.tabs.children.length);
      const button = el('button', {type: 'button', role: 'tab', id: id + '-tab', 'aria-controls': id, 'aria-selected': String(selected), tabindex: selected ? '0' : '-1', text: group ? group.labels[chart.id] : chart.tab});
      const panel = el('div', {id, role: 'tabpanel', 'aria-labelledby': id + '-tab', tabindex: '0'});
      panel.hidden = !selected; panel.append(renderChart(chart));
      (group ? group.tabs : tablist).append(button);
      (group ? group.panels : panels).append(panel);
    });
    wireTabs(tablist);
    metricGroups.forEach(group => { if (group.tabs) wireTabs(group.tabs); });
    article.append(tablist, panels);
  });
  dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (chartOpener && chartOpener.isConnected) chartOpener.focus(); });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
  });
})();
