(() => {
  'use strict';
  const navbar = document.querySelector('.navbar');
  const button = document.querySelector('.mobile-menu-btn');
  const links = document.querySelector('.navbar-links');
  function resize() {
    document.documentElement.style.setProperty('--lab-nav-height', `${navbar.getBoundingClientRect().height}px`);
  }
  function closeMenu() { links.classList.remove('active'); button.setAttribute('aria-expanded', 'false'); }
  function scroll() { navbar.classList.toggle('scrolled', window.scrollY > 50); }
  button.addEventListener('click', () => { const open = links.classList.toggle('active'); button.setAttribute('aria-expanded', String(open)); });
  links.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && links.classList.contains('active')) { closeMenu(); button.focus(); } });
  window.addEventListener('scroll', scroll, {passive:true});
  window.addEventListener('resize', () => { if (window.innerWidth > 1100) closeMenu(); });
  new ResizeObserver(resize).observe(navbar);
  resize(); scroll();
})();
