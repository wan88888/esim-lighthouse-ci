module.exports = {
    ci: {
      collect: {
        url: ['https://esimnum.com/home'],
        numberOfRuns: 3,
        settings: {
          chromeFlags: '--no-sandbox --disable-dev-shm-usage --headless',
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
        target: 'temporary-public-storage',
      },
    },
  };