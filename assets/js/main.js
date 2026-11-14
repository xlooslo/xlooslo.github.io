(() => {
  'use strict';

  const root = document.documentElement;

  /* ---------- Theme toggle ---------- */
  const btn = document.getElementById('theme-toggle');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  const currentTheme = () => root.dataset.theme || (systemDark.matches ? 'dark' : 'light');

  const setTheme = (theme, persist) => {
    root.dataset.theme = theme;
    if (btn) {
      btn.setAttribute('aria-pressed', String(theme === 'dark'));
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* storage can be blocked */ }
    }
    window.dispatchEvent(new Event('themechange'));
  };

  // Reflect the starting theme (saved choice, otherwise the system setting) in the button.
  setTheme(currentTheme(), false);
  if (btn) btn.addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark', true));

  /* ---------- Publication filter ---------- */
  const filter = document.querySelector('[data-pub-filter]');
  if (filter) {
    const pubs = Array.from(document.querySelectorAll('.pub'));
    const groups = Array.from(document.querySelectorAll('.pub-group'));
    const buttons = Array.from(filter.querySelectorAll('button'));

    const countFirst = pubs.filter(p => p.dataset.role === 'first').length;
    filter.querySelector('[data-count="all"]').textContent = '(' + pubs.length + ')';
    filter.querySelector('[data-count="first"]').textContent = '(' + countFirst + ')';

    const apply = mode => {
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
      pubs.forEach(p => { p.hidden = mode === 'first' && p.dataset.role !== 'first'; });
      groups.forEach(g => { g.hidden = !g.querySelector('.pub:not([hidden])'); });
    };

    buttons.forEach(b => b.addEventListener('click', () => apply(b.dataset.mode)));
    filter.hidden = false;   // shown only when JavaScript is available
  }
})();
