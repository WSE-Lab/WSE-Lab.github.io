/* Shared, dependency-free utilities. All dataset values are inserted as text, never HTML. */
(function () {
  'use strict';
  const bib = '@article{zhang2026llms,\n  title = {LLMs for Model-driven Engineering: A Systematic Literature Review},\n  author = {Zhang, Man and Li, Yunyang and Yue, Tao},\n  journal = {ACM Transactions on Software Engineering and Methodology},\n  year = {2026},\n  doi = {10.1145/3859883}\n}';
  const iconPaths = {
    catalog: 'M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3z M15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3z M4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14z M15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5z',
    document: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M14 3v6h6 M8 13h8 M8 17h5',
    save: 'M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M7 3v6h9V3 M7 21v-7h10v7',
    copy: 'M9 8h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2z M16 8V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3',
    search: 'M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0z M15 15l6 6',
    link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2',
    compare: 'M3 5h7v14H3z M14 5h7v14h-7z M6 9h1 M6 13h1 M17 9h1 M17 13h1',
    plus: 'M12 5v14 M5 12h14',
    minus: 'M5 12h14',
    reset: 'M9 4h6 M4 7h16 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
    table: 'M3 4h18v16H3z M3 9h18 M9 9v11 M3 14h18',
    expand: 'M8 3H3v5 M16 3h5v5 M3 16v5h5 M21 16v5h-5'
  };
  function decorateIcon(node, name) {
    if (!iconPaths[name]) return node;
    node.querySelectorAll(':scope > .button-icon').forEach(icon => icon.remove());
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    Object.entries({class: 'button-icon', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true', focusable: 'false'}).forEach(([key, value]) => svg.setAttribute(key, value));
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', iconPaths[name]); svg.append(path);
    node.classList.add('icon-action'); node.dataset.icon = name; node.prepend(svg);
    return node;
  }
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined) return;
      if (key === 'text') node.textContent = value;
      else if (key === 'class') node.className = value;
      else node.setAttribute(key, value);
    });
    for (const child of [].concat(children)) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    if (attrs['data-icon']) decorateIcon(node, attrs['data-icon']);
    return node;
  }
  function link(text, href, cls = '', icon = '') {
    const node = el('a', {text, href, class: cls, 'data-icon': icon || null});
    if (/^https?:\/\//i.test(href)) { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  }
  function toast(message) {
    const node = document.getElementById('toast');
    if (!node) return;
    node.textContent = message; node.hidden = false;
    clearTimeout(toast.timer); toast.timer = setTimeout(() => { node.hidden = true; }, 2800);
  }
  async function copy(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else {
        const area = el('textarea', {'aria-label': 'Text to copy'}); area.value = text;
        area.style.cssText = 'position:fixed;left:-9999px;top:0';
        (document.querySelector('dialog[open]') || document.body).append(area); area.select();
        const success = document.execCommand('copy'); area.remove();
        if (!success) throw new Error('Copy unavailable');
      }
      toast('Copied to clipboard'); return true;
    } catch (_) { toast('Copy unavailable. Select and copy the displayed text.'); return false; }
  }
  function download(name, content, type = 'text/plain;charset=utf-8') {
    const blob = new Blob([content], {type}); const url = URL.createObjectURL(blob);
    const a = link('', url); a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function catalog(params) { return 'catalog.html?' + new URLSearchParams(params).toString(); }
  function safeUrl(value) {
    try { const u = new URL(value); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch (_) { return ''; }
  }
  function authorText(value) {
    // Decode the unbraced BibTeX name escapes present in the source metadata.
    return String(value).replace(/\\'\\i/g, 'í').replace(/\\`\\i/g, 'ì')
      .replace(/\\DJ/g, 'Đ').replace(/\\dj/g, 'đ').replace(/\\aa/g, 'å').replace(/\\l/g, 'ł');
  }
  const navButton = document.querySelector('.nav-toggle');
  if (navButton) navButton.addEventListener('click', () => {
    const expanded = navButton.getAttribute('aria-expanded') !== 'true';
    navButton.setAttribute('aria-expanded', String(expanded)); document.querySelector('.site-nav').classList.toggle('open', expanded);
  });
  document.querySelectorAll('.site-nav a').forEach(a => a.addEventListener('click', () => {
    document.querySelector('.site-nav').classList.remove('open'); if (navButton) navButton.setAttribute('aria-expanded', 'false');
  }));
  document.querySelectorAll('[data-copy-citation]').forEach(b => b.addEventListener('click', () => copy(bib)));
  const citation = document.getElementById('citation-text'); if (citation) citation.textContent = bib;
  document.querySelectorAll('[data-icon]').forEach(node => decorateIcon(node, node.dataset.icon));
  window.Site = {el, link, toast, copy, download, catalog, safeUrl, bib, decorateIcon, authorText};
})();
