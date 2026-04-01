const fs = require('fs');
const path = require('path');

const MAX_ENTRIES = 100;

const deployDir = process.argv[2];
if (!deployDir) {
  console.error('Usage: node save-scores.js <deploy-dir>');
  process.exit(1);
}

// ---------------------------------------------------------------------------
//  Load thresholds from lighthouserc.js (same source as notify-feishu.js)
// ---------------------------------------------------------------------------
const config = require('../lighthouserc.js');
const assertions = config.ci.assert.assertions;

const METRICS = [
  { key: 'performance',    assertion: 'categories:performance' },
  { key: 'accessibility',  assertion: 'categories:accessibility' },
  { key: 'best-practices', assertion: 'categories:best-practices' },
  { key: 'seo',            assertion: 'categories:seo' },
];

for (const m of METRICS) {
  const rule = assertions[m.assertion];
  m.threshold = Math.round((rule?.[1]?.minScore ?? 0) * 100);
}

// ---------------------------------------------------------------------------
//  Parse Lighthouse results
// ---------------------------------------------------------------------------
const RESULTS_DIR = path.resolve('.lighthouseci');
let resultFiles = [];
try {
  resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
    .map(f => path.join(RESULTS_DIR, f));
} catch {}

if (resultFiles.length === 0) {
  console.log('⚠️ No Lighthouse result files found, skipping score save');
  process.exit(0);
}

const results = resultFiles.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));

const scores = {};
for (const m of METRICS) {
  const avg = results.reduce((sum, r) => sum + (r.categories?.[m.key]?.score ?? 0), 0) / results.length;
  scores[m.key] = Math.round(avg * 100);
}

// ---------------------------------------------------------------------------
//  Read existing history and append
// ---------------------------------------------------------------------------
const scoresFile = path.join(deployDir, 'scores.json');
let history = [];
try {
  history = JSON.parse(fs.readFileSync(scoresFile, 'utf8'));
} catch {}

const thresholds = {};
for (const m of METRICS) thresholds[m.key] = m.threshold;

history.push({
  date: new Date().toISOString(),
  commit: (process.env.GITHUB_SHA || 'local').slice(0, 7),
  trigger: process.env.GITHUB_EVENT_NAME || 'manual',
  scores,
  thresholds,
});

if (history.length > MAX_ENTRIES) {
  history = history.slice(-MAX_ENTRIES);
}

fs.mkdirSync(deployDir, { recursive: true });
fs.writeFileSync(scoresFile, JSON.stringify(history, null, 2));

console.log(`✅ Saved scores to ${scoresFile} (${history.length} entries)`);
