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

function displayName(url) {
  if (pageNames[url]) return pageNames[url];
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

  // Extract ALL report URLs (order matches result files)
  let reportUrls = [];
  try {
    const output = fs.readFileSync('upload_output.txt', 'utf8');
    reportUrls = [...output.matchAll(/https:\/\/storage\.googleapis\.com\/\S+\.html/g)].map(m => m[0]);
  } catch {}

  const pages = [];
  let hasFailed = false;

  for (const [url, group] of pageMap) {
    const metrics = METRIC_DEFS.map(def => {
      const scores = group.results.map(r => r.categories?.[def.key]?.score ?? 0);
      const score = Math.round(median(scores) * 100);
      const t = thresholds[def.key];
      return { key: def.key, label: def.label, score, threshold: t, pass: score >= t };
    });

    // Collect all report URLs for this page's runs, pick one
    const pageReportUrls = group.indices.map(i => reportUrls[i]).filter(Boolean);
    const reportUrl = pageReportUrls[Math.floor(pageReportUrls.length / 2)] || '';

    const failed = metrics.filter(m => !m.pass);
    if (failed.length > 0) hasFailed = true;

    pages.push({ url, name: displayName(url), metrics, reportUrl, failed });
  }

  return { pages, hasFailed };
}

module.exports = { METRIC_DEFS, thresholds, parse, displayName };
