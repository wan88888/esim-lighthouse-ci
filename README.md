# eSIM Lighthouse CI

[esimnum.com](https://esimnum.com) 网站性能监控项目，基于 Google Lighthouse CI，自动检测多个页面的 Performance、Accessibility、Best Practices、SEO 四项指标，不达标时通过飞书机器人告警并 @对应研发，同时提供历史趋势看板。

## 项目结构

```
├── .github/workflows/lighthouse.yml   # GitHub Actions 工作流
├── scripts/
│   ├── lib/
│   │   └── lhr-parser.js              # 公共模块：按页面分组解析 LHR 结果
│   ├── notify-feishu.js               # 分数解析 + 飞书通知（含变化量对比）
│   └── save-scores.js                 # 历史分数持久化（按页面存储）
├── dashboard/
│   └── index.html                     # 趋势看板（部署到 gh-pages，支持多页面切换）
├── lighthouserc.js                    # Lighthouse CI 配置（阈值 + 页面名称映射）
├── package.json
└── package-lock.json
```

## 快速开始

```bash
git clone <repository-url>
cd esim-lighthouse-ci
npm install
npm test
```

## 配置说明

### 测试目标与阈值（lighthouserc.js）

所有配置集中在 `lighthouserc.js`，通知脚本和趋势看板自动读取，只需维护一处：

```javascript
module.exports = {
  pageNames: {
    'https://esimnum.com': '主页',
    'https://esimnum.com/destinations/esim-united-states/US': '套餐页',
  },
  ci: {
    collect: {
      url: [
        'https://esimnum.com',
        'https://esimnum.com/destinations/esim-united-states/US',
      ],
      numberOfRuns: 3,                    // 每页跑 3 次取中位数，减少波动
      settings: {
        preset: 'desktop',               // 桌面端模式
      },
    },
    assert: {
      assertions: {
        'categories:performance':    ['warn', { minScore: 0.9 }],  // ≥ 90 分
        'categories:accessibility':  ['warn', { minScore: 0.9 }],  // ≥ 90 分
        'categories:best-practices': ['warn', { minScore: 0.9 }],  // ≥ 90 分
        'categories:seo':            ['warn', { minScore: 0.9 }],  // ≥ 90 分
      },
    },
    upload: {
      target: 'temporary-public-storage',  // 报告上传至临时公共存储（有效期 ~7 天）
    },
  },
};
```

#### 如何添加新页面

1. 在 `ci.collect.url` 数组中添加 URL
2. 在 `pageNames` 中添加对应的中文名称映射
3. 无需修改任何脚本，飞书通知和趋势看板自动适配

### GitHub Actions 触发方式

| 触发条件 | 说明 |
|---------|------|
| `push` to `main` | 主分支有新提交时自动运行 |
| `pull_request` | 所有 PR 自动运行 |
| `schedule` | 每周三凌晨 06:37（北京时间）定时运行 |

工作流还配置了：
- **`timeout-minutes: 10`** — 防止异常挂起消耗 CI 分钟数
- **`concurrency`** — 同分支多次触发自动取消旧的运行

### 飞书通知配置

需要在 GitHub 仓库 **Settings → Secrets and variables → Actions** 中配置：

#### `FEISHU_WEBHOOK_URL`（必选）

飞书群自定义机器人的 Webhook URL。

创建方式：飞书群聊 →「设置」→「群机器人」→「自定义机器人」→ 复制 Webhook URL。

#### 飞书 @提醒联系人

告警时 @谁由 `scripts/notify-feishu.js` 顶部的 `MENTION_CONTACTS` 数组控制：

```javascript
const MENTION_CONTACTS = [
  { id: 'ou_xxxxxxxxxxxx', name: '张三' },  // 有 id → 飞书红点提醒
  { name: '李四' },                          // 只有 name → 显示 @李四 文字
];
```

数组为空则默认 @所有人。`id` 为飞书 Open ID（`ou_` 开头），可通过飞书管理后台或 [API 调试台](https://open.feishu.cn/api-explorer/) 查询。

## 通知效果

飞书卡片按页面分区展示分数，每个页面独立显示四项指标、变化量和报告链接。

**告警卡片（红色）** — 任一页面有指标不达标时发送：

```
⚠️ eSIM Lighthouse CI 告警

📄 主页
🟢 Performance: 100 分（阈值 ≥ 90）
🟢 Accessibility: 95 分 🔺+2（阈值 ≥ 90）
🟢 Best Practices: 100 分（阈值 ≥ 90）
🟢 SEO: 92 分（阈值 ≥ 90）
🔗 查看报告
───────────────────────────────
📄 套餐页
🟢 Performance: 100 分（阈值 ≥ 90）
🟢 Accessibility: 92 分（阈值 ≥ 90）
🔴 Best Practices: 74 分 🔻-5（阈值 ≥ 90）
🟢 SEO: 92 分（阈值 ≥ 90）
🔗 查看报告
───────────────────────────────
❌ 不达标指标:
套餐页 — Best Practices(74分)
@所有人 请及时检查代码！

⏰ 构建时间: 2026/04/02 09:48:31

[📈 查看趋势图]
```

**正常卡片（绿色）** — 所有页面全部达标时发送：

```
✅ eSIM Lighthouse CI 报告

📄 主页
🟢 Performance: 100 分（阈值 ≥ 90）
🟢 Accessibility: 97 分 🔺+2（阈值 ≥ 90）
🟢 Best Practices: 100 分（阈值 ≥ 90）
🟢 SEO: 100 分（阈值 ≥ 90）
🔗 查看报告
───────────────────────────────
📄 套餐页
🟢 Performance: 98 分（阈值 ≥ 90）
🟢 Accessibility: 95 分（阈值 ≥ 90）
🟢 Best Practices: 92 分 🔺+3（阈值 ≥ 90）
🟢 SEO: 100 分（阈值 ≥ 90）
🔗 查看报告
───────────────────────────────
🎉 所有页面指标均达标，表现优秀！

[📈 查看趋势图]
```

通知特性：
- 每个页面独立展示四项分数和对应的在线报告链接
- 分数变化量用 🔺/🔻 标识，与上次运行对比
- 不达标指标按页面分组列出
- 底部趋势图按钮跳转 GitHub Pages 看板

## 趋势看板

每次 CI 运行后，分数按页面自动追加到 `gh-pages` 分支的 `scores.json`，通过 GitHub Pages 托管的静态页面展示历史趋势。

**访问地址**：`https://<用户名>.github.io/esim-lighthouse-ci/`

看板功能：
- 顶部 Tab 切换不同页面（主页 / 套餐页）
- 四项指标的历史趋势折线图
- 最近一次运行的分数卡片（通过/不通过状态）
- 保留最近 100 次运行数据

**首次启用**：GitHub 仓库 Settings → Pages → Source 选择 `gh-pages` 分支 → Save。

## 查看报告

- **飞书通知**：每个页面的「查看报告」链接可直接跳转对应的 Lighthouse 在线报告
- **趋势看板**：GitHub Pages 上的历史趋势图，永久保存
- **GitHub Actions Summary**：每次运行后在 Summary 页显示分数表格和报告链接
- **在线报告**：上传至 Google 临时公共存储，有效期约 7 天，支持直接分享
- **本地**：运行 `npm test` 后查看 `.lighthouseci/` 目录下的 HTML/JSON 文件

## 故障排查

| 问题 | 排查方向 |
|------|---------|
| 测试失败 | 目标网站是否可访问；阈值是否设置过高 |
| CI 失败但本地正常 | CI 环境网络差异；目标站对 CI IP 限流 |
| 飞书未收到通知 | 检查 `FEISHU_WEBHOOK_URL` secret 是否配置正确 |
| @提醒不生效 | 检查 `MENTION_CONTACTS` 数组中的 Open ID 是否正确 |
| 趋势看板空白 | 确认 GitHub Pages 已启用，Source 设为 `gh-pages` 分支 |
| 新增页面后通知/看板没显示 | 检查 `lighthouserc.js` 中 `url` 和 `pageNames` 是否都已添加 |

## 相关资源

- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)
- [飞书自定义机器人](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
