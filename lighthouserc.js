module.exports = {
    ci: {
      collect: {
        url: ['https://esimnum.com'],
        numberOfRuns: 3,
        settings: {
          chromeFlags: '--no-sandbox --disable-dev-shm-usage --headless',
          preset: 'desktop',
        },
      },
      assert: {
        assertions: {
          // Performance、Accessibility、Best Practices ＜ 95 分告警
          'categories:performance': ['error', { minScore: 0.95 }],
          'categories:accessibility': ['error', { minScore: 0.95 }],
          'categories:best-practices': ['error', { minScore: 0.95 }],
          // SEO ＜ 100 分告警
          'categories:seo': ['error', { minScore: 1 }],
        },
      },
      upload: {
        target: 'temporary-public-storage',
      },
    },
  };