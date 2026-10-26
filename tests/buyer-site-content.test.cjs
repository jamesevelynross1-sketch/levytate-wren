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

test('every public page offers the approved icon in browser-sized favicon formats', () => {
  const publicDirectory = join(__dirname, '..', 'public');
  const ico = readFileSync(join(publicDirectory, 'brand', 'levytate-favicon.ico'));
  const png = readFileSync(join(publicDirectory, 'brand', 'levytate-favicon-32.png'));
  const touch = readFileSync(join(publicDirectory, 'apple-touch-icon.png'));
  assert.equal(ico.readUInt16LE(2), 1, 'ICO file format');
  assert.equal(ico.readUInt16LE(4), 3, 'ICO contains 16, 32 and 48 pixel artwork');
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  assert.equal(touch.readUInt32BE(16), 180);
  assert.equal(touch.readUInt32BE(20), 180);
  for (const html of Object.values(pages)) {
    assert.match(html, /rel="icon" href="\/brand\/levytate-favicon\.ico\?v=20261026"/);
    assert.match(html, /rel="icon" href="\/brand\/levytate-favicon-32\.png\?v=20261026"/);
    assert.match(html, /rel="apple-touch-icon" href="\/apple-touch-icon\.png\?v=20261026"/);
  }
  const middleware = readFileSync(join(__dirname, '..', 'middleware.ts'), 'utf8');
  assert.match(middleware, /pathname === "\/favicon\.ico"/);
  assert.match(middleware, /destination\.pathname = "\/brand\/levytate-favicon\.ico"/);
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
