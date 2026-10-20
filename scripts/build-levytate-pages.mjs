import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { strict as assert } from 'node:assert';

// Build independent public pages from the approved story. No changes to the app,
// account records, enquiry endpoints, funding arithmetic or approved artwork.
const original = readFileSync('public/levytate-mission-v2.html', 'utf8');
const originalJs = readFileSync('public/mission-v2/site.js', 'utf8');
const directory = 'public/mission-v3';
mkdirSync(directory, { recursive: true });
const urls = { programmes: '/apprenticeships', funding: '/funding', journey: '/manage-apprenticeships', roi: '/funding#roi', providers: '/apprenticeships#providers' };
const links = value => value.replace(/href="#(programmes|funding|journey|roi|providers)"/g, (_, id) => `href="${urls[id]}"`);
function section(id) {
  const start = original.indexOf(`<section id="${id}"`);
  assert(start >= 0, `Missing approved section: ${id}`);
  const tags = /<section\b[^>]*>|<\/section>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let tag; (tag = tags.exec(original));) {
    depth += tag[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return links(original.slice(start, tags.lastIndex));
  }
  throw new Error(`Unclosed approved section: ${id}`);
}
const headerMatch = original.match(/<header class="header wrap">[\s\S]*?<\/header>/);
const iconMatch = original.match(/<svg class="interactive-symbol"[\s\S]*?<\/svg>/);
const footerMatch = original.match(/<footer class="footer wrap">[\s\S]*?<\/footer>/);
assert(headerMatch && iconMatch && footerMatch, 'Approved brand shell could not be found.');
const header = links(headerMatch[0]);
const icon = links(iconMatch[0]);
const footer = links(footerMatch[0]);
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
function document({ title, description, path, body, page }) {
  return `<!doctype html>
<html lang="en-GB"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escape(title)}</title><meta name="description" content="${escape(description)}">
<meta name="theme-color" content="#f8f9f5"><link rel="canonical" href="https://www.levytate.co.uk${path}">
<meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><meta property="og:url" content="https://www.levytate.co.uk${path}">
<link rel="icon" href="/brand/mission-icon.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/mission-v2/site.css"><link rel="stylesheet" href="/mission-v3/pages.css">
<script src="/mission-v3/navigation.js" defer></script><script src="/mission-v3/interactions.js" defer></script>
</head><body class="${page === 'home' ? 'home-page' : 'detail-page'}" data-page="${page}">
<a class="skip" href="#main-content">Skip to content</a>
${header}
${body}
${footer}
</body></html>`;
}
const homeBody = `<main id="main-content" class="home-main wrap">
<div class="home-intro"><h1>More opportunity for your people.<span>Less work to make it happen.</span></h1>
<p>Find the right apprenticeships, make better use of your funding<br class="desktop-break"> and keep everyone on the same page.</p></div>
<p class="explore-instruction" id="explore-instruction">Choose a part of the icon to explore.</p>
<div class="home-map" aria-describedby="explore-instruction">
<svg class="map-connections" viewBox="0 0 1060 400" preserveAspectRatio="none" aria-hidden="true"><path class="connector mint" data-highlight="programmes" d="M250 206 H337 L414 185"/><circle cx="414" cy="185" r="3" class="connection-dot mint"/><path class="connector coral" data-highlight="funding" d="M648 124 L719 104 H798"/><circle cx="648" cy="124" r="3" class="connection-dot coral"/><path class="connector navy" data-highlight="journey" d="M635 308 L719 300 H798"/><circle cx="635" cy="308" r="3" class="connection-dot navy"/></svg>
<div class="symbol-stage">${icon}</div>
<nav class="orbit-labels" aria-label="Explore LevyTate">
<a class="orbit-label label-mint" href="/apprenticeships" data-highlight="programmes"><i class="dot mint" aria-hidden="true"></i><span>Find the right<br class="desktop-break"> apprenticeships</span><b aria-hidden="true">→</b></a>
<a class="orbit-label label-coral" href="/funding" data-highlight="funding"><i class="dot coral" aria-hidden="true"></i><span>Make your funding<br class="desktop-break"> work harder</span><b aria-hidden="true">→</b></a>
<a class="orbit-label label-navy" href="/manage-apprenticeships" data-highlight="journey"><i class="dot navy" aria-hidden="true"></i><span>Manage everything<br class="desktop-break"> in one place</span><b aria-hidden="true">→</b></a>
</nav></div>
</main>`;
writeFileSync(`${directory}/index.html`, document({ title: 'LevyTate | More opportunity. Less work.', description: 'Find the right apprenticeships, make better use of your funding and manage the journey in one place. Choose a part of LevyTate to explore.', path: '/', body: homeBody, page: 'home' }));
const pages = [
  { id: 'programmes', file: 'apprenticeships', path: '/apprenticeships', title: 'Find the right apprenticeships | LevyTate', description: 'Connect roles and development needs with apprenticeship programmes. Compare teaching, delivery and provider support, then help employees take the next step.', extra: 'providers' },
  { id: 'funding', file: 'funding', path: '/funding', title: 'Make your apprenticeship funding work harder | LevyTate', description: 'Review planned training spend, understand levy commitments and estimate the value of less administration with the LevyTate ROI calculator.', extra: 'roi' },
  { id: 'journey', file: 'manage-apprenticeships', path: '/manage-apprenticeships', title: 'Manage apprenticeships in one place | LevyTate', description: 'Keep employee requests, manager decisions, learner progress and provider actions together. See what each person needs to do next.' }
];
function pageNavigation(selected) {
  return `<div class="page-wayfinding wrap"><a class="back-link" href="/">← Explore LevyTate</a><nav aria-label="The three parts of LevyTate">${pages.map(p => `<a href="${p.path}"${p.id === selected ? ' aria-current="page"' : ''}><i class="dot ${p.id === 'programmes' ? 'mint' : p.id === 'funding' ? 'coral' : 'navy'}" aria-hidden="true"></i>${p.id === 'programmes' ? 'Find apprenticeships' : p.id === 'funding' ? 'Use your funding' : 'Manage the journey'}</a>`).join('')}</nav></div>`;
}
for (const page of pages) {
  let content = section(page.id);
  content = content.replace(new RegExp(`<h2 id="${page.id}-title"([^>]*)>([\\s\\S]*?)<\\/h2>`), `<h1 id="${page.id}-title"$1>$2</h1>`);
  assert(content.includes(`<h1 id="${page.id}-title"`), 'The page must have a real heading.');
  content = content.replace('href="/funding#roi"', page.id === 'funding' ? 'href="#roi"' : 'href="/funding#roi"');
  const extra = page.extra ? section(page.extra) : '';
  const body = `${pageNavigation(page.id)}<main id="main-content" class="detail-main wrap"><div class="detail-surface">${content}${extra}</div><div class="page-close"><p>${page.id === 'journey' ? 'Less chasing. A clearer picture.' : 'See how this could work for your organisation.'}</p><a class="button" href="/early-access">Request a walkthrough <span aria-hidden="true">↗</span></a></div></main>`;
  writeFileSync(`${directory}/${page.file}.html`, document({ ...page, body, page: page.id }));
}
// Preserve the approved examples and ROI maths. Remove the old single-screen router;
// initialise the calculator only on its own page so other pages cannot go blank.
const routerStart = originalJs.indexOf('  function currentDestination()');
const eventsStart = originalJs.indexOf("  $$('[data-highlight]')");
const calculatorStart = originalJs.indexOf('  const currency =');
const routerEnd = originalJs.indexOf('  const initial = currentDestination();');
assert(routerStart > 0 && eventsStart > routerStart && calculatorStart > eventsStart && routerEnd > calculatorStart, 'The approved interaction source changed: check the page extraction before publishing.');
const globals = originalJs.slice(0, routerStart);
const interactions = originalJs.slice(eventsStart, calculatorStart).replace("$('#role-select').addEventListener", "$('#role-select')?.addEventListener");
let calculator = originalJs.slice(calculatorStart, routerEnd);
calculator = calculator.replace("if (!$('#roi').hidden)", "if ($('#roi') && !$('#roi').hidden)");
calculator = calculator.replace("lines.join('\\\\n')", "lines.join('\\n')");
writeFileSync(`${directory}/interactions.js`, globals + interactions + "\n  if ($('#roi-form')) {\n" + calculator + "\n  }\n})();\n");
for (const file of ['index', ...pages.map(p => p.file)]) {
  const html = readFileSync(`${directory}/${file}.html`, 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one page heading required`);
  assert(!html.includes('src="/mission-v2/site.js"'), 'Old tab router must not be loaded.');
  assert(!html.includes('href="#programmes"') && !html.includes('href="#journey"'), 'Navigation must lead to a page.');
}
console.log('Built centred LevyTate homepage and three independent benefit pages. Original artwork and ROI calculations preserved.');
