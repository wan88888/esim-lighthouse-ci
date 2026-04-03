const fs = require('fs');
const { parse } = require('./lib/lhr-parser');

// ---------------------------------------------------------------------------
//  告警时 @提醒的飞书联系人（为空则 @所有人）
//  id: 飞书 Open ID（ou_ 开头），通过飞书管理后台或 API 调试台获取
// ---------------------------------------------------------------------------
const MENTION_CONTACTS = [
  // { id: 'ou_***', name: '***' },
];

// ---------------------------------------------------------------------------
//  Parse Lighthouse results — grouped by page URL
// ---------------------------------------------------------------------------
const { pages, hasFailed } = parse();

if (pages.length === 0) {
  console.log('⚠️ No Lighthouse result files found');
  process.exit(0);
}

// ---------------------------------------------------------------------------
//  Load last-run scores from history for delta calculation
// ---------------------------------------------------------------------------
let prevPageScores = {};
try {
  const history = JSON.parse(fs.readFileSync('scores_history.json', 'utf8'));
  if (history.length > 0) {
    const last = history[history.length - 1];
    if (last.pages) {
      prevPageScores = last.pages;
    } else if (last.scores) {
      prevPageScores = { default: last.scores };
    }
  }
} catch {}

for (const page of pages) {
  const prev = prevPageScores[page.name] || {};
  for (const m of page.metrics) {
    const prevScore = prev[m.key];
    m.delta = prevScore != null ? m.score - prevScore : null;
  }
  console.log(`📊 [${page.name}]`, page.metrics.map(m => {
    const d = m.delta != null ? ` (${m.delta >= 0 ? '+' : ''}${m.delta})` : '';
    return `${m.label}: ${m.score}${d}`;
  }).join(', '));
}

// ---------------------------------------------------------------------------
//  Dashboard URL
// ---------------------------------------------------------------------------
let dashboardUrl = '';
const ghRepo = process.env.GITHUB_REPOSITORY;
if (ghRepo) {
  const [owner, repo] = ghRepo.split('/');
  dashboardUrl = `https://${owner}.github.io/${repo}/`;
}

// ---------------------------------------------------------------------------
//  Write GitHub Step Summary (per-page)
// ---------------------------------------------------------------------------
const summaryPath = process.env.GITHUB_STEP_SUMMARY;
if (summaryPath) {
  let summary = '## 📊 Lighthouse Scores\n\n';
  for (const page of pages) {
    summary += `### ${page.name}\n\n`
      + '| Metric | Score | Threshold | Status |\n'
      + '|--------|-------|-----------|--------|\n'
      + page.metrics.map(m =>
          `| ${m.label} | ${m.score}% | ≥ ${m.threshold}% | ${m.pass ? '✅' : '❌'} |`
        ).join('\n') + '\n';
    if (page.reportUrl) summary += `\n🔗 [View Report](${page.reportUrl})\n`;
    summary += '\n';
  }
  fs.appendFileSync(summaryPath, summary);
}

// ---------------------------------------------------------------------------
//  Write GitHub Outputs
// ---------------------------------------------------------------------------
const outputPath = process.env.GITHUB_OUTPUT;
if (outputPath) {
  const first = pages[0]?.metrics;
  fs.appendFileSync(outputPath, [
    `perf=${first?.[0]?.score ?? 0}`,
    `a11y=${first?.[1]?.score ?? 0}`,
    `bp=${first?.[2]?.score ?? 0}`,
    `seo=${first?.[3]?.score ?? 0}`,
    `has_failure=${hasFailed}`,
    `report_url=${pages[0]?.reportUrl ?? ''}`,
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

  let title, template;
  if (hasFailed) {
    title = '⚠️ eSIM Lighthouse CI 告警';
    template = 'red';
  } else {
    title = '✅ eSIM Lighthouse CI 报告';
    template = 'green';
  }

  const elements = [];

  // --- Per-page score sections ---
  for (const page of pages) {
    const scoreLines = page.metrics.map(m => {
      const icon = m.pass ? '🟢' : '🔴';
      const op = m.threshold >= 100 ? '=' : '≥';
      let deltaStr = '';
      if (m.delta != null) {
        if (m.delta > 0) deltaStr = ` 🔺+${m.delta}`;
        else if (m.delta < 0) deltaStr = ` 🔻${m.delta}`;
        else deltaStr = ' ➖0';
      }
      return `${icon} **${m.label}**: ${m.score} 分${deltaStr}（阈值 ${op} ${m.threshold}）`;
    }).join('\n');

    let section = `📄 **${page.name}**\n${scoreLines}`;
    if (page.reportUrl) {
      section += `\n[🔗 查看报告](${page.reportUrl})`;
    }

    elements.push({ tag: 'div', text: { content: section, tag: 'lark_md' } });
    elements.push({ tag: 'hr' });
  }

  // --- Alert / summary section ---
  let alertText;
  if (hasFailed) {
    const failedByPage = pages
      .filter(p => p.failed.length > 0)
      .map(p => {
        const items = p.failed.map(m => `${m.label}(${m.score}分)`).join('、');
        return `${p.name} — ${items}`;
      })
      .join('\n');

    let mention = '<at id=all>所有人</at>';
    if (MENTION_CONTACTS.length > 0) {
      mention = MENTION_CONTACTS.map(u => `<at id=${u.id}>${u.name}</at>`).join(' ');
    }
    alertText = `❌ **不达标指标**:\n${failedByPage}\n${mention} 请关注并排查原因`;
  } else {
    alertText = '🎉 所有页面指标均达标，表现优秀！';
  }

  elements.push({ tag: 'div', text: { content: alertText, tag: 'lark_md' } });

  if (!hasFailed) {
    const allScores = pages.flatMap(p => p.metrics.map(m => m.score));
    const avg = Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length);
    elements.push({ tag: 'div', text: { content: `📊 **综合平均分**: ${avg} 分`, tag: 'lark_md' } });
  }

  const triggerMap = { push: '代码推送', pull_request: 'Pull Request', schedule: '定时巡检' };
  const trigger = triggerMap[process.env.TRIGGER_EVENT] || process.env.TRIGGER_EVENT || '手动触发';
  elements.push({ tag: 'div', text: { content: `⏰ **构建时间**: ${buildTime}｜**触发方式**: ${trigger}`, tag: 'lark_md' } });

  // --- Action buttons ---
  if (dashboardUrl) {
    elements.push(
      { tag: 'hr' },
      {
        tag: 'action',
        actions: [{
          tag: 'button',
          text: { content: '📈 查看趋势图', tag: 'plain_text' },
          url: dashboardUrl,
          type: 'default',
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

  const respBody = await resp.text();
  console.log(`✅ Feishu notification sent (HTTP ${resp.status}): ${respBody}`);
}

// ---------------------------------------------------------------------------
//  Main
// ---------------------------------------------------------------------------
async function main() {
  await sendFeishuNotification().catch(err => {
    console.error('⚠️ Feishu notification failed:', err.message);
  });

  if (hasFailed) {
    const allFailed = pages.flatMap(p => p.failed.map(m => `${p.name} ${m.label}: ${m.score}/${m.threshold}`));
    console.error(`\n❌ Lighthouse check failed — ${allFailed.join(', ')}`);
    process.exit(1);
  }

  console.log('\n✅ All Lighthouse metrics passed!');
}

main();
