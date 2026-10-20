/* Ordinary production URLs; standalone review URLs on non-production hosts. */
(function () {
  'use strict';
  const pagePaths = {
    '/': '/mission-v3/index.html',
    '/apprenticeships': '/mission-v3/apprenticeships.html',
    '/funding': '/mission-v3/funding.html',
    '/manage-apprenticeships': '/mission-v3/manage-apprenticeships.html'
  };
  const reviewing = !['www.levytate.co.uk', 'levytate.co.uk'].includes(window.location.hostname)
    && window.location.pathname.startsWith('/mission-v3/');
  function publicUrl(href) {
    const url = new URL(href, window.location.origin);
    if (reviewing && url.origin === window.location.origin && Object.prototype.hasOwnProperty.call(pagePaths, url.pathname)) {
      url.pathname = pagePaths[url.pathname];
    }
    return url;
  }
  if (reviewing) {
    document.querySelectorAll('a[href^="/"]').forEach(link => {
      const url = publicUrl(link.getAttribute('href'));
      if (url.origin === window.location.origin && ['/early-access', '/login', '/support', '/privacy', '/early-access-terms'].includes(url.pathname)) {
        url.host = 'www.levytate.co.uk';
        url.protocol = 'https:';
      }
      link.setAttribute('href', url.href);
    });
  }
  if (document.body.dataset.page !== 'home') return;
  const links = { programmes: '/apprenticeships', workforce: '/apprenticeships', providers: '/apprenticeships#providers', funding: '/funding', investment: '/funding', roi: '/funding#roi', journey: '/manage-apprenticeships', impact: '/manage-apprenticeships' };
  const parameters = new URLSearchParams(window.location.search);
  const key = window.location.hash.slice(1) || parameters.get('view') || parameters.get('section') || (parameters.get('audience') === 'provider' ? 'providers' : '');
  if (!Object.prototype.hasOwnProperty.call(links, key)) return;
  const destination = publicUrl(links[key]);
  ['view','section','audience','tour','step'].forEach(name => parameters.delete(name));
  destination.search = parameters.toString();
  window.location.replace(destination.href);
})();
