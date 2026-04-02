const fs = require('fs');
const path = require('path');
const { parse, thresholds } = require('./lib/lhr-parser');

const MAX_ENTRIES = 100;

const deployDir = process.argv[2];
if (!deployDir) {
  console.error('Usage: node save-scores.js <deploy-dir>');
  process.exit(1);
}

const { pages } = parse();
if (pages.length === 0) {
  console.log('⚠️ No Lighthouse result files found, skipping score save');
  process.exit(0);
}

// Build a per-page scores map: { "esimnum.com": { performance: 100, ... }, ... }
const pageScores = {};
for (const page of pages) {
  const scores = {};
  for (const m of page.metrics) scores[m.key] = m.score;
  pageScores[page.name] = scores;
}

// Build migration map: old shortUrl keys → current displayName
const migrationMap = {};
for (const [fullUrl, name] of Object.entries(require('../lighthouserc.js').pageNames || {})) {
  try {
    const u = new URL(fullUrl);
    const oldKey = u.pathname === '/' ? u.hostname : u.hostname + u.pathname;
    migrationMap[oldKey] = name;
  } catch {}
}

const scoresFile = path.join(deployDir, 'scores.json');
let history = [];
try {
  history = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
} catch {}

// Migrate old page-name keys in historical entries
for (const entry of history) {
  if (!entry.pages) continue;
  const migrated = {};
  for (const [key, val] of Object.entries(entry.pages)) {
    migrated[migrationMap[key] || key] = val;
  }
  entry.pages = migrated;
}

history.push({
  date: new Date().toISOString(),
  commit: (process.env.GITHUB_SHA || 'local').slice(0, 7),
  trigger: process.env.GITHUB_EVENT_NAME || 'manual',
  pages: pageScores,
  thresholds,
});

if (history.length > MAX_ENTRIES) {
  history = history.slice(-MAX_ENTRIES);
}

fs.mkdirSync(deployDir, { recursive: true });
fs.writeFileSync(scoresFile, JSON.stringify(history, null, 2));

console.log(`✅ Saved scores to ${scoresFile} (${history.length} entries)`);
