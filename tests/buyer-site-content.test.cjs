const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const directory = join(__dirname, '..', 'public', 'mission-v3');
const pages = Object.fromEntries(['index', 'apprenticeships', 'funding', 'manage-apprenticeships']
  .map(name => [name, readFileSync(join(directory, name + '.html'), 'utf8')]));

test('the approved public navigation and original symbol remain', () => {
  assert.match(pages.index, /class="interactive-symbol"/);
  assert.match(pages.index, /mission-wordmark/);
  for (const route of ['/apprenticeships', '/funding', '/manage-apprenticeships']) {
    assert.ok(pages.index.includes('href="' + route + '"'));
  }
});

test('buyer pages have no product fee or dummy letter-avatar tiles', () => {
  for (const html of Object.values(pages)) {
    assert.doesNotMatch(html, /annual software cost|first-year setup cost|enter your quote|£6,500|£1,000 software costs/i);
    assert.doesNotMatch(html, /class="ps-provider-monogram"/);
    assert.doesNotMatch(html, /<span>ME<\/span>/);
  }
  assert.match(pages.apprenticeships, /Illustrative programme profile/);
  assert.match(pages.apprenticeships, /Engineering manufacturing technician/);
});

test('funding page demonstrates distinct fictional evidence and a forward scenario', () => {
  const page = pages.funding;
  assert.match(page, /data-das-forecast/);
  assert.match(page, /data-das-rows/);
  assert.match(page, /data-das-starts="0"/);
  assert.match(page, /data-das-starts="8" aria-pressed="true"/);
  assert.match(page, /data-das-starts="16"/);
  assert.match(page, /forecast-model\.js/);
  assert.match(page, /forecast\.js/);
  assert.match(page, /No live DAS connection|not a live DAS connection/i);
  assert.match(page, /data-das-line-selected/);
  assert.match(page, /id="training-result"/);
  assert.match(page, /id="opportunity-result"/);
  assert.doesNotMatch(page, /id="licence"|id="setup"|id="roi-result"/);
  assert.match(page, /refinements\.css/);
});
