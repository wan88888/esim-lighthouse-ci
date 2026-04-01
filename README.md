# eSIM Lighthouse CI

[esimnum.com](https://esimnum.com) 网站性能监控项目，基于 Google Lighthouse CI，自动检测 Performance、Accessibility、Best Practices、SEO 四项指标，不达标时通过飞书机器人告警并 @对应研发。

## 项目结构

```
├── .github/workflows/lighthouse.yml   # GitHub Actions 工作流（纯编排）
├── scripts/notify-feishu.js           # 分数解析 + 飞书通知（核心逻辑）
├── lighthouserc.js                    # Lighthouse CI 配置（阈值单一数据源）
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

所有阈值配置集中在 `lighthouserc.js`，通知脚本自动读取，只需维护一处：

```javascript
module.exports = {
  ci: {
    collect: {
      url: ['https://esimnum.com'],    // 测试 URL
      numberOfRuns: 3,                  // 每次运行 3 轮取平均
      settings: {
        preset: 'desktop',              // 桌面端模式
      },
    },
    assert: {
      assertions: {
        'categories:performance':    ['error', { minScore: 0.95 }],  // ≥ 95 分
        'categories:accessibility':  ['error', { minScore: 0.95 }],  // ≥ 95 分
        'categories:best-practices': ['error', { minScore: 0.95 }],  // ≥ 95 分
        'categories:seo':            ['error', { minScore: 1 }],     // = 100 分
      },
    },
    upload: {
      target: 'temporary-public-storage',  // 报告上传至临时公共存储（有效期 ~7 天）
    },
  },
};
```

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

#### `FEISHU_MENTION_MAP`（可选）

配置后，告警时 @指定的飞书联系人（而非 @所有人）。格式为 JSON 字符串：

**固定 @一组人（推荐）：**

```json
{
  "_default": [
    {"id": "ou_xxxxxxxxxxxx", "name": "张三"},
    {"id": "ou_yyyyyyyyyyyy", "name": "李四"}
  ]
}
```

**按 GitHub 用户映射：**

```json
{
  "github-username": {"id": "ou_xxxxxxxxxxxx", "name": "张三"},
  "_default": [{"id": "ou_yyyyyyyyyyyy", "name": "李四"}]
}
```

优先级：GitHub 用户精确匹配 → `_default` 列表 → @所有人。

`id` 为飞书用户的 Open ID（`ou_` 开头），可通过飞书管理后台或 [API 调试台](https://open.feishu.cn/api-explorer/) 查询。

## 通知效果

**告警卡片（红色）** — 任一指标不达标时发送：

```
⚠️ eSIM Lighthouse CI 告警

🟢 Performance: 100 分（阈值 ≥ 95）
🟢 Accessibility: 95 分（阈值 ≥ 95）
🟢 Best Practices: 100 分（阈值 ≥ 95）
🔴 SEO: 92 分（阈值 = 100）
───────────────────────────────
❌ 不达标指标: SEO(92分)
@张三 请及时检查代码！
```

**正常卡片（绿色）** — 全部达标时发送：

```
✅ eSIM Lighthouse CI 报告

🟢 Performance: 100 分（阈值 ≥ 95）
🟢 Accessibility: 97 分（阈值 ≥ 95）
🟢 Best Practices: 100 分（阈值 ≥ 95）
🟢 SEO: 100 分（阈值 = 100）
───────────────────────────────
🎉 所有指标均达标，表现优秀！
```

## 查看报告

- **GitHub Actions Summary**：每次运行后在 Summary 页显示分数表格和报告链接
- **在线报告**：上传至 Google 临时公共存储，有效期约 7 天，支持直接分享
- **本地**：运行 `npm test` 后查看 `.lighthouseci/` 目录下的 HTML/JSON 文件

## 故障排查

| 问题 | 排查方向 |
|------|---------|
| 测试失败 | 目标网站是否可访问；阈值是否设置过高 |
| CI 失败但本地正常 | CI 环境网络差异；目标站对 CI IP 限流 |
| 飞书未收到通知 | 检查 `FEISHU_WEBHOOK_URL` secret 是否配置正确 |
| @提醒不生效 | 检查 `FEISHU_MENTION_MAP` JSON 格式和 Open ID 是否正确 |

## 相关资源

- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)
- [Web Vitals](https://web.dev/vitals/)
- [飞书自定义机器人](https://open.feishu.cn/document/client-docs/bot-v3/add-custom-bot)
