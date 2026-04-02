const fs = require('fs');
const path = require('path');

const config = require('../../lighthouserc.js');
const assertions = config.ci.assert.assertions;
const pageNames = config.pageNames || {};

const METRIC_DEFS = [
  { key: 'performance',    label: 'Performance',    assertion: 'categories:performance' },
  { key: 'accessibility',  label: 'Accessibility',  assertion: 'categories:accessibility' },
  { key: 'best-practices', label: 'Best Practices', assertion: 'categories:best-practices' },
  { key: 'seo',            label: 'SEO',            assertion: 'categories:seo' },
];

const thresholds = {};
for (const m of METRIC_DEFS) {
  const rule = assertions[m.assertion];
  thresholds[m.key] = Math.round((rule?.[1]?.minScore ?? 0) * 100);
}

function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function normalizeUrl(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function displayName(url) {
  const norm = normalizeUrl(url);
  for (const [key, name] of Object.entries(pageNames)) {
    if (normalizeUrl(key) === norm) return name;
  }
  try {
    const u = new URL(url);
    return u.pathname === '/' ? u.hostname : u.hostname + u.pathname;
  } catch {
    return url;
  }
}

/**
 * Parse all lhr-*.json files, group by requestedUrl, compute per-page median
 * scores, and map each page to its report URL from upload_output.txt.
 *
 * Returns { pages, hasFailed } where pages is an array of:
 *   { url, name, metrics: [{ key, label, score, threshold, pass }], reportUrl, failed }
 */
function parse() {
  const RESULTS_DIR = path.resolve('.lighthouseci');
  let resultFiles = [];
  try {
    resultFiles = fs.readdirSync(RESULTS_DIR)
      .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
      .sort()
      .map(f => path.join(RESULTS_DIR, f));
  } catch {}

  if (resultFiles.length === 0) return { pages: [], hasFailed: false };

  const allResults = resultFiles.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));

  // Group by requestedUrl, preserving file-index for report URL mapping
  const pageMap = new Map();
  allResults.forEach((r, idx) => {
    const url = r.requestedUrl || r.finalUrl;
    if (!pageMap.has(url)) pageMap.set(url, { results: [], indices: [] });
    pageMap.get(url).results.push(r);
    pageMap.get(url).indices.push(idx);
  });

  // Load report URL mapping — prefer links.json (written by lhci upload),
  // fall back to parsing upload_output.txt
  let linksMap = {};
  try {
    linksMap = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, 'links.json'), 'utf8'));
    console.log('📎 links.json:', JSON.stringify(linksMap));
  } catch {
    console.log('📎 links.json not found, will fallback to upload_output.txt');
  }

  function findReportUrl(pageUrl) {
    const norm = normalizeUrl(pageUrl);
    // links.json keys may include suffix like " (desktop)"
    for (const [key, val] of Object.entries(linksMap)) {
      if (normalizeUrl(key) === norm || key.startsWith(pageUrl) || key.startsWith(norm)) {
        return val;
      }
    }
    // Fallback: try upload_output.txt
    try {
      const output = fs.readFileSync('upload_output.txt', 'utf8');
      const allUrls = [...output.matchAll(/https:\/\/storage\.googleapis\.com\/\S+\.html/g)].map(m => m[0]);
      if (allUrls.length === 1) return allUrls[0];
    } catch {}
    return '';
  }

  const pages = [];
  let hasFailed = false;

  for (const [url, group] of pageMap) {
    const metrics = METRIC_DEFS.map(def => {
      const scores = group.results.map(r => r.categories?.[def.key]?.score ?? 0);
      const score = Math.round(median(scores) * 100);
      const t = thresholds[def.key];
      return { key: def.key, label: def.label, score, threshold: t, pass: score >= t };
    });

    const reportUrl = findReportUrl(url);

    const failed = metrics.filter(m => !m.pass);
    if (failed.length > 0) hasFailed = true;

    pages.push({ url, name: displayName(url), metrics, reportUrl, failed });
  }

  return { pages, hasFailed };
}

module.exports = { METRIC_DEFS, thresholds, parse, displayName };
