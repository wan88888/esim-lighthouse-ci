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
        numberOfRuns: 3,
        settings: {
          chromeFlags: '--no-sandbox --disable-dev-shm-usage --headless',
          preset: 'desktop',
        },
      },
      assert: {
        assertions: {
          'categories:performance': ['warn', { minScore: 0.9 }],
          'categories:accessibility': ['warn', { minScore: 0.9 }],
          'categories:best-practices': ['warn', { minScore: 0.9 }],
          'categories:seo': ['warn', { minScore: 0.9 }],
        },
      },
      upload: {
        target: 'temporary-public-storage',
      },
    },
  };