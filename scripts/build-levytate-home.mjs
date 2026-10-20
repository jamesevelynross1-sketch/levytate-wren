import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
// Preserve the exact approved artwork already present in the deployed public site.
const legacy = readFileSync('public/levytate-interactive-2026.html', 'utf8');
mkdirSync('public/brand', { recursive: true });
for (const part of ['icon', 'wordmark']) {
  const marker = '"/brand/levytate-' + part + '.png":"data:image/png;base64,';
  const start = legacy.indexOf(marker);
  if (start < 0) throw new Error('Approved LevyTate ' + part + ' not found; refusing an artwork substitution.');
  const from = start + marker.length, end = legacy.indexOf('"', from);
  if (end < 0) throw new Error('Incomplete approved artwork.');
  const value = legacy.slice(from, end);
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) throw new Error('Invalid embedded artwork.');
  const image = Buffer.from(value, 'base64');
  if (image.length < 1000 || image.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG.');
  writeFileSync('public/brand/mission-' + part + '.png', image);
  console.log('Preserved LevyTate ' + part + ' sha256=' + createHash('sha256').update(image).digest('hex'));
}
const html = readFileSync('public/levytate-mission-v2.html', 'utf8');
for (const id of ['programmes','funding','journey','roi','providers']) {
  if (!html.includes('id="'+id+'"')) throw new Error('Missing public section: '+id);
}
console.log('LevyTate three-part public site prepared. Platform routes unchanged.');
