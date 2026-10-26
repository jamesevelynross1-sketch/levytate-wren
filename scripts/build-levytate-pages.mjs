import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { refinePageContent, contentStyles, contentInteractionOverrides } from './levytate-buyer-content.mjs';

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
// A native disclosure keeps the definition readable and keyboard accessible even
// without JavaScript. These styles affect the new explanation only, not the map.
const explanationStyles = `
.home-intro>p.product-definition{max-width:850px;text-wrap:pretty}
.product-definition strong{font-weight:600;color:var(--ink)}
.product-explainer{max-width:680px;margin:8px auto 0}
.product-explainer>summary{list-style:none;display:flex;align-items:center;justify-content:center;gap:9px;min-height:44px;width:fit-content;margin-inline:auto;cursor:pointer;font-size:14px;font-weight:550;color:var(--ink);text-underline-offset:5px}
.product-explainer>summary::-webkit-details-marker{display:none}
.product-explainer>summary::after{content:'+';font-size:18px;font-weight:400}
.product-explainer[open]>summary::after{content:'−'}
.product-explainer>summary:hover{text-decoration:underline}
.product-explainer-panel{text-align:left;padding:24px 26px;background:#fff;border:1px solid var(--line);border-radius:9px;margin-top:6px}
.product-explainer-panel h2{font-size:22px;line-height:1.3;letter-spacing:-.025em;font-weight:550;color:var(--ink)}
.home-intro .product-explainer-panel p{font-size:15px;line-height:1.65;margin:13px 0 0;max-width:none;color:var(--muted)}
.product-explainer-panel strong{color:var(--ink);font-weight:550}
@media(max-width:480px){.product-explainer-panel{padding:20px}.product-explainer-panel h2{font-size:20px}.home-intro .product-explainer-panel p{font-size:14px}}
`;
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
${page === 'home' ? `<style>${explanationStyles}</style>` : `<style>${contentStyles}</style>`}
${page === 'home' ? '' : '<link rel="stylesheet" href="/mission-v3/refinements.css">'}
<script src="/mission-v3/navigation.js" defer></script><script src="/mission-v3/interactions.js" defer></script>
${page === 'funding' ? '<script src="/mission-v3/forecast-model.js" defer></script><script src="/mission-v3/forecast.js" defer></script>' : ''}
</head><body class="${page === 'home' ? 'home-page' : 'detail-page'}" data-page="${page}">
<a class="skip" href="#main-content">Skip to content</a>
${header}
${body}
${footer}
</body></html>`;
}
const homeBody = `<main id="main-content" class="home-main wrap">
<div class="home-intro"><h1>More opportunity for your people.<span>Less work to make it happen.</span></h1>
<p class="product-definition"><strong>LevyTate is an apprenticeship platform for employers.</strong> It brings programme choice, funding decisions and learner progress into one shared workspace—so developing your people doesn’t depend on someone holding the whole process together in their inbox.</p>
<details class="product-explainer" id="what-is-levytate">
<summary>What is LevyTate?</summary>
<div class="product-explainer-panel"><h2>One place to organise apprenticeships across your business.</h2>
<p>LevyTate gives employees, managers and apprenticeship teams a shared workspace for opportunities, applications, approvals and progress.</p>
<p><strong>Providers deliver the training. LevyTate helps the employer bring the journey together.</strong> Your team gets a clearer view without piecing it together from emails, spreadsheets and separate provider updates.</p>
</div></details></div>
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
writeFileSync(`${directory}/index.html`, document({ title: 'LevyTate | Apprenticeship platform for employers', description: 'LevyTate is an apprenticeship platform for employers, bringing programme choice, funding decisions, approvals and learner progress into one shared workspace.', path: '/', body: homeBody, page: 'home' }));
const pages = [
  { id: 'programmes', file: 'apprenticeships', path: '/apprenticeships', title: 'Find the right apprenticeships | LevyTate', description: 'Use LevyTate to connect roles and development needs with apprenticeship programmes, compare provider offers and help employees take the next step.', extra: 'providers',
    oldIntro: 'Someone wants to progress. Their team needs new skills. Start with the work they do—not a course catalogue.',
    intro: 'LevyTate starts with the employee’s role and what they need to learn. Programme information and provider support sit alongside that need, helping your team make a more informed choice.' },
  { id: 'funding', file: 'funding', path: '/funding', title: 'Make your apprenticeship funding work harder | LevyTate', description: 'Explore an illustrative 12-month DAS balance forecast, upcoming commitments, fund expiry and the potential value of less administration.', extra: 'roi',
    oldIntro: 'Teams buy training separately while apprenticeship funding can go unused. Bring the plans together before committing the budget.',
    intro: 'Teams buy training separately while apprenticeship funding can go unused. LevyTate helps you review those plans together, check suitable apprenticeship options and build the case before spending.' },
  { id: 'journey', file: 'manage-apprenticeships', path: '/manage-apprenticeships', title: 'Manage apprenticeships in one place | LevyTate', description: 'Use LevyTate to keep employee requests, manager decisions, learner progress and provider actions together. See who needs to act next.',
    oldIntro: 'The employee is waiting. The manager thinks HR is handling it. The provider needs an update. Keep the request, owner and next action together.',
    intro: 'An employee submits a request in LevyTate. Their manager reviews it. The apprenticeship lead makes the final decision. Everyone can see who needs to act next.' }
];
function pageNavigation(selected) {
  return `<div class="page-wayfinding wrap"><a class="back-link" href="/">← Explore LevyTate</a><nav aria-label="The three parts of LevyTate">${pages.map(p => `<a href="${p.path}"${p.id === selected ? ' aria-current="page"' : ''}><i class="dot ${p.id === 'programmes' ? 'mint' : p.id === 'funding' ? 'coral' : 'navy'}" aria-hidden="true"></i>${p.id === 'programmes' ? 'Find apprenticeships' : p.id === 'funding' ? 'Use your funding' : 'Manage the journey'}</a>`).join('')}</nav></div>`;
}
for (const page of pages) {
  let content = section(page.id);
  content = content.replace(new RegExp(`<h2 id="${page.id}-title"([^>]*)>([\\s\\S]*?)<\\/h2>`), `<h1 id="${page.id}-title"$1>$2</h1>`);
  assert(content.includes(`<h1 id="${page.id}-title"`), 'The page must have a real heading.');
  assert.equal(content.split(`<p>${page.oldIntro}</p>`).length, 2, `${page.id}: expected one introduction to update`);
  content = content.replace(`<p>${page.oldIntro}</p>`, `<p>${page.intro}</p>`);
  content = content.replace('href="/funding#roi"', page.id === 'funding' ? 'href="#roi"' : 'href="/funding#roi"');
  content = refinePageContent(page.id, content);
  // Replace only the integration's text tile. Reuse the existing responsive logo
  // sizing so the Copilot and approved LevyTate marks remain balanced.
  if (page.id === 'journey') {
    const copilotTile = '<span class="ps-integration-label">Microsoft 365<br><strong>Copilot</strong></span>';
    assert.equal(content.split(copilotTile).length, 2, 'Expected exactly one Copilot integration text tile.');
    assert(readFileSync('public/brand/microsoft-copilot.svg', 'utf8').includes('<svg'), 'Microsoft Copilot logo asset is required.');
    content = content.replace(copilotTile, '<img src="/brand/microsoft-copilot.svg" width="256" height="256" alt="Microsoft Copilot" class="ps-mark" decoding="async">');
  }
  const extra = page.extra ? refinePageContent(page.extra, section(page.extra)) : '';
  const body = `${pageNavigation(page.id)}<main id="main-content" class="detail-main wrap"><div class="detail-surface">${content}${extra}</div><div class="page-close"><p>${page.id === 'journey' ? 'Less chasing. A clearer picture.' : 'See how this could work for your organisation.'}</p><a class="button" href="/early-access">Request a walkthrough <span aria-hidden="true">↗</span></a></div></main>`;
  writeFileSync(`${directory}/${page.file}.html`, document({ ...page, body, page: page.id }));
}
// Preserve the approved examples and business-impact estimator. Remove the old single-screen router;
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
writeFileSync(`${directory}/interactions.js`, globals + contentInteractionOverrides + interactions + "\n  if ($('#roi-form')) {\n" + calculator + "\n  }\n})();\n");
for (const file of ['index', ...pages.map(p => p.file)]) {
  const html = readFileSync(`${directory}/${file}.html`, 'utf8');
  assert.equal((html.match(/<h1\b/g) || []).length, 1, `${file}: one page heading required`);
  assert(!html.includes('src="/mission-v2/site.js"'), 'Old tab router must not be loaded.');
  assert(!html.includes('href="#programmes"') && !html.includes('href="#journey"'), 'Navigation must lead to a page.');
}
const home = readFileSync(`${directory}/index.html`, 'utf8');
assert(home.includes('<strong>LevyTate is an apprenticeship platform for employers.</strong>'), 'The product must be defined before interaction.');
assert(home.includes('<summary>What is LevyTate?</summary>'), 'The accessible product explanation is required.');
assert(!/<details[^>]*class="product-explainer"[^>]*\bopen(?:\s|>)/.test(home), 'The optional explanation must start closed.');
console.log('Built LevyTate homepage and three benefit pages with illustrative DAS scenarios and a price-free business-impact estimator.');
