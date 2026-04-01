const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
//  Load thresholds from lighthouserc.js — single source of truth
// ---------------------------------------------------------------------------
const config = require('../lighthouserc.js');
const assertions = config.ci.assert.assertions;

const METRICS = [
  { key: 'performance',    label: 'Performance',    assertion: 'categories:performance' },
  { key: 'accessibility',  label: 'Accessibility',  assertion: 'categories:accessibility' },
  { key: 'best-practices', label: 'Best Practices', assertion: 'categories:best-practices' },
  { key: 'seo',            label: 'SEO',            assertion: 'categories:seo' },
];

for (const m of METRICS) {
  const rule = assertions[m.assertion];
  m.threshold = Math.round((rule?.[1]?.minScore ?? 0) * 100);
}

// ---------------------------------------------------------------------------
//  Parse Lighthouse results (.lighthouseci/lhr-*.json)
// ---------------------------------------------------------------------------
const RESULTS_DIR = path.resolve('.lighthouseci');
let resultFiles = [];
try {
  resultFiles = fs.readdirSync(RESULTS_DIR)
    .filter(f => f.startsWith('lhr-') && f.endsWith('.json'))
    .map(f => path.join(RESULTS_DIR, f));
} catch {}

if (resultFiles.length === 0) {
  console.log('⚠️ No Lighthouse result files found');
  process.exit(0);
}

const results = resultFiles.map(f => JSON.parse(fs.readFileSync(f, 'utf8')));

for (const m of METRICS) {
  const avg = results.reduce((sum, r) => sum + (r.categories?.[m.key]?.score ?? 0), 0) / results.length;
  m.score = Math.round(avg * 100);
  m.pass = m.score >= m.threshold;
}

const failed = METRICS.filter(m => !m.pass);
const hasFailed = failed.length > 0;

console.log('📊 Scores:', METRICS.map(m => `${m.label}: ${m.score}`).join(', '));

// ---------------------------------------------------------------------------
//  Extract report URL from lhci upload output
// ---------------------------------------------------------------------------
let reportUrl = '';
try {
  const uploadOutput = fs.readFileSync('upload_output.txt', 'utf8');
  const match = uploadOutput.match(/https:\/\/storage\.googleapis\.com\/\S+\.html/);
  if (match) reportUrl = match[0];
} catch {}

// ---------------------------------------------------------------------------
//  Write GitHub Step Summary
// ---------------------------------------------------------------------------
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  const rows = METRICS.map(m =>
    `| ${m.label} | ${m.score}% | ≥ ${m.threshold}% | ${m.pass ? '✅' : '❌'} |`
  ).join('\n');

  let summary = '## 📊 Lighthouse Scores\n\n'
    + '| Metric | Score | Threshold | Status |\n'
    + '|--------|-------|-----------|--------|\n'
    + rows + '\n';
  if (reportUrl) summary += `\n🔗 [View Online Report](${reportUrl})\n`;

  fs.appendFileSync(summaryPath, summary);
}

// ---------------------------------------------------------------------------
//  Write GitHub Outputs (for downstream steps if needed)
// ---------------------------------------------------------------------------
const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  fs.appendFileSync(outputPath, [
    `perf=${METRICS[0].score}`,
    `a11y=${METRICS[1].score}`,
    `bp=${METRICS[2].score}`,
    `seo=${METRICS[3].score}`,
    `has_failure=${hasFailed}`,
    `report_url=${reportUrl}`,
  ].join('\n') + '\n');
}

// ---------------------------------------------------------------------------
//  Feishu notification
// ---------------------------------------------------------------------------
async function sendFeishuNotification() {
  const webhookUrl = process.env.FEISHU_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('⚠️ FEISHU_WEBHOOK_URL not configured, skipping notification');
    return;
  }

  const buildTime = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

  const scoreLines = METRICS.map(m => {
    const icon = m.pass ? '🟢' : '🔴';
    const tag = m.pass ? '' : `（阈值 ≥ ${m.threshold}）`;
    return `${icon} **${m.label}**: ${m.score} 分${tag}`;
  }).join('\n');

  let title, template, alertText;

  if (hasFailed) {
    title = '⚠️ eSIM Lighthouse CI 告警';
    template = 'red';

    const failedList = failed.map(m => `${m.label}(${m.score}分)`).join('、');

    let mention = '<at id=all>所有人</at>';
    try {
      const mentionMap = JSON.parse(process.env.FEISHU_MENTION_MAP || '{}');
      const actor = process.env.GITHUB_ACTOR;
      if (actor && mentionMap[actor]) {
        mention = `<at id=${mentionMap[actor].id}>${mentionMap[actor].name}</at>`;
      }
    } catch {}

    alertText = `❌ **不达标指标**: ${failedList}\n${mention} 请及时检查代码！`;
  } else {
    title = '✅ eSIM Lighthouse CI 报告';
    template = 'green';
    alertText = '🎉 所有指标均达标，表现优秀！';
  }

  const elements = [
    { tag: 'div', text: { content: scoreLines, tag: 'lark_md' } },
    { tag: 'hr' },
    { tag: 'div', text: { content: alertText, tag: 'lark_md' } },
    { tag: 'div', text: { content: `⏰ **构建时间**: ${buildTime}`, tag: 'lark_md' } },
  ];

  if (reportUrl) {
    elements.push(
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { content: '🔗 查看详细报告', tag: 'plain_text' },
          url: reportUrl,
          type: 'primary',
        }],
      },
    );
  }

  const resp = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg_type: 'interactive',
      card: { header: { title: { content: title, tag: 'plain_text' }, template }, elements },
    }),
  });

  console.log(`✅ Feishu notification sent (HTTP ${resp.status})`);
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------
async function main() {
  await sendFeishuNotification().catch(err => {
    console.error('⚠️ Feishu notification failed:', err.message);
  });

  if (hasFailed) {
    console.error(`\n❌ Lighthouse check failed — ${failed.map(m => `${m.label}: ${m.score}/${m.threshold}`).join(', ')}`);
    process.exit(1);
  }

  console.log('\n✅ All Lighthouse metrics passed!');
}

main();
