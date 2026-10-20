/* Keep old shared links useful; all new navigation uses ordinary page URLs. */
(function () {
  'use strict';
  if (document.body.dataset.page !== 'home') return;
  const links = { programmes: '/apprenticeships', workforce: '/apprenticeships', providers: '/apprenticeships#providers', funding: '/funding', investment: '/funding', roi: '/funding#roi', journey: '/manage-apprenticeships', impact: '/manage-apprenticeships' };
  const parameters = new URLSearchParams(window.location.search);
  const key = window.location.hash.slice(1) || parameters.get('view') || parameters.get('section') || (parameters.get('audience') === 'provider' ? 'providers' : '');
  if (!Object.prototype.hasOwnProperty.call(links, key)) return;
  const destination = new URL(links[key], window.location.origin);
  ['view','section','audience','tour','step'].forEach(name => parameters.delete(name));
  destination.search = parameters.toString();
  window.location.replace(destination.href);
})();
