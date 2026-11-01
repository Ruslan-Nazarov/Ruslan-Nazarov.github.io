(() => {
  const id = Number(document.currentScript?.dataset.metricaId);
  if (!Number.isSafeInteger(id) || id < 1) return;

  window.ym = window.ym || function () { (window.ym.a = window.ym.a || []).push(arguments); };
  window.ym.l = Date.now();
  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(script);
  window.ym(id, 'init', { id, trackLinks: true, accurateTrackBounce: true, webvisor: false, clickmap: false });

  document.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link) return;
    const url = new URL(link.href, location.href);
    const goals = [];
    if (url.protocol === 'mailto:' || url.protocol === 'tel:') goals.push('contact_click');
    if (/\.(pdf|docx?|xlsx?|txt|md|zip)(?:$)/i.test(url.pathname)) goals.push('file_click');
    if (/^https?:$/.test(url.protocol) && url.origin !== location.origin) goals.push('external_link_click');
    for (const goal of goals) window.ym(id, 'reachGoal', goal);
  });
})();
