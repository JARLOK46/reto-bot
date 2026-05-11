const test = require('node:test');
const assert = require('node:assert/strict');

const envModulePath = require.resolve('../src/config/env');

function withEnv(overrides, callback) {
  const original = {
    BOT_TOKEN: process.env.BOT_TOKEN,
    PORT: process.env.PORT,
    DASHBOARD_PORT: process.env.DASHBOARD_PORT,
    SCORE_INCREMENT: process.env.SCORE_INCREMENT,
    TURN_TIMEOUT_SECONDS: process.env.TURN_TIMEOUT_SECONDS
  };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(value);
    }
  }

  delete require.cache[envModulePath];

  try {
    return callback(require('../src/config/env'));
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    delete require.cache[envModulePath];
  }
}

test('loadEnv prioriza PORT sobre DASHBOARD_PORT en hosting', () => {
  withEnv(
    {
      BOT_TOKEN: 'token-test',
      PORT: '10000',
      DASHBOARD_PORT: '3000',
      SCORE_INCREMENT: '1',
      TURN_TIMEOUT_SECONDS: '15'
    },
    ({ loadEnv }) => {
      const config = loadEnv();

      assert.equal(config.dashboard.port, 10000);
    }
  );
});

test('loadEnv usa DASHBOARD_PORT cuando PORT no existe', () => {
  withEnv(
    {
      BOT_TOKEN: 'token-test',
      PORT: undefined,
      DASHBOARD_PORT: '4321',
      SCORE_INCREMENT: '1',
      TURN_TIMEOUT_SECONDS: '15'
    },
    ({ loadEnv }) => {
      const config = loadEnv();

      assert.equal(config.dashboard.port, 4321);
    }
  );
});
