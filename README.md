# eSIM Lighthouse CI

这是一个用于 [esimnum.com](https://esimnum.com) 网站性能监控的 Lighthouse CI 自动化测试项目。

## 📋 项目简介

本项目通过 Google Lighthouse CI 自动化测试工具，定期检测和监控网站的性能、可访问性、最佳实践和 SEO 等关键指标。

## 🚀 功能特性

- ✅ 自动化性能测试
- ✅ 多次运行取平均值（默认 3 次）
- ✅ GitHub Actions 集成
- ✅ 生成详细的 HTML 和 JSON 报告
- ✅ 自定义性能和可访问性阈值

## 📦 安装

### 本地安装

```bash
# 克隆项目
git clone <repository-url>
cd esim-lighthouse-ci

# 安装依赖
npm install

# 全局安装 Lighthouse CI（可选）
npm install -g @lhci/cli
```

## 🔧 配置说明

### lighthouserc.js

配置文件包含以下主要设置：

```javascript
{
  ci: {
    collect: {
      url: ['https://esimnum.com/home'],  // 测试的 URL
      numberOfRuns: 3,                     // 运行次数
      settings: {
        chromeFlags: '--no-sandbox',
        preset: 'desktop',
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.3 }],
        'categories:accessibility': ['warn', { minScore: 0.3 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',  // 上传到临时公共存储
    },
  },
}
```

### 修改测试 URL

要测试不同的页面，修改 `lighthouserc.js` 中的 `url` 数组：

```javascript
url: [
  'https://esimnum.com/home',
  'https://esimnum.com/about',
  'https://esimnum.com/products',
],
```

### 调整性能阈值

根据实际需求修改 `assertions` 中的 `minScore` 值（0-1 范围）：

```javascript
assertions: {
  'categories:performance': ['error', { minScore: 0.8 }],
  'categories:accessibility': ['warn', { minScore: 0.9 }],
  'categories:best-practices': ['warn', { minScore: 0.8 }],
  'categories:seo': ['warn', { minScore: 0.8 }],
}
```

## 💻 使用方法

### 本地运行

```bash
# 运行完整的 Lighthouse CI 测试
npm test

# 或使用 CI 模式运行
npm run test:ci
```

### GitHub Actions 自动化

项目已配置 GitHub Actions 工作流（`.github/workflows/lighthouse.yml`），会在以下情况自动运行：

- 推送到 `main` 分支时
- 创建 Pull Request 时

测试完成后，可在 GitHub Actions 的 Artifacts 中下载 Lighthouse 报告。

## 📊 查看报告

### 本地报告

运行测试后，报告会保存在 `.lighthouseci/` 目录下：

```bash
# 查看生成的报告文件
ls -l .lighthouseci/

# 在浏览器中打开 HTML 报告
open .lighthouseci/lhr-*.html
```

### GitHub Actions 报告

1. 进入 GitHub 仓库的 Actions 页面
2. 选择对应的工作流运行记录
3. 在 Artifacts 部分下载 `lighthouse-report`
4. 解压后在浏览器中打开 HTML 文件

### 临时公共存储

测试完成后，控制台会输出一个临时公共报告链接，有效期为几天。

## 📈 测试指标说明

Lighthouse 会评估以下核心指标：

- **Performance（性能）**: 页面加载速度、首次内容绘制、最大内容绘制等
- **Accessibility（可访问性）**: 无障碍访问标准合规性
- **Best Practices（最佳实践）**: 现代 Web 开发最佳实践
- **SEO（搜索引擎优化）**: 搜索引擎友好度

每个类别的得分范围：
- 🟢 90-100: 优秀
- 🟠 50-89: 需要改进
- 🔴 0-49: 差

## 🛠️ 故障排查

### 测试失败

如果测试失败，检查：

1. 目标网站是否可访问
2. 性能阈值是否设置过高
3. 网络连接是否稳定
4. Chrome 浏览器是否正确安装（本地运行时）

### GitHub Actions 失败

#### 问题：No artifacts will be uploaded

如果遇到 "No files were found with the provided path" 错误：

1. **检查测试是否真正运行**: 查看 "Run Lighthouse CI" 步骤的日志
2. **网络问题**: GitHub Actions 运行环境可能无法访问目标网站
3. **超时问题**: 网站响应太慢导致测试超时

**解决方案**：

工作流已配置为：
- 使用 `continue-on-error: true` 确保即使测试失败也继续执行
- 在上传前检查文件是否存在
- 只在报告文件生成时才上传 artifacts
- 显示清晰的状态消息帮助诊断问题

如果持续失败，可以：
1. 降低性能阈值（`minScore`）
2. 减少运行次数（`numberOfRuns`）
3. 检查目标网站是否对 CI/CD IP 有访问限制

### 本地测试成功但 CI 失败

可能的原因：
- CI 环境网络速度不同
- CI 环境资源限制
- 目标网站对 CI IP 地址有限流

解决方法：
1. 在 CI 中使用更宽松的阈值
2. 考虑使用本地 Lighthouse 服务器
3. 添加重试机制

## 📝 开发建议

- 在重大更新前运行 Lighthouse 测试
- 定期检查和优化低于阈值的指标
- 根据实际情况调整 `numberOfRuns` 以平衡准确性和速度
- 考虑添加移动端测试（修改 `preset: 'mobile'`）

## 🔗 相关资源

- [Lighthouse CI 官方文档](https://github.com/GoogleChrome/lighthouse-ci)
- [Lighthouse 评分指南](https://web.dev/performance-scoring/)
- [Web Vitals](https://web.dev/vitals/)

## 📄 许可证

ISC

## 👥 贡献

欢迎提交 Issue 和 Pull Request！

