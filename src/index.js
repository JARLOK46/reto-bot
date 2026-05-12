const dns = require('node:dns');
const { Telegraf } = require('telegraf');
const { loadEnv } = require('./config/env');
const { createSessionStore } = require('./session/session-store');
const { registerHandlers } = require('./handlers/register-handlers');
const { createDashboardController } = require('./dashboard/dashboard-controller');
const { createDashboardServer } = require('./dashboard/create-dashboard-server');

dns.setDefaultResultOrder('ipv4first');

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableTelegramError(error) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code);
}

async function launchBotWithRetry(bot, { shouldStop, logger = console } = {}) {
  let attempt = 0;

  while (!shouldStop()) {
    try {
      attempt += 1;
      logger.log(`Launching bot (attempt ${attempt})...`);
      await bot.launch();
      logger.log('Bot launched successfully');
      return true;
    } catch (error) {
      const retryable = isRetryableTelegramError(error);
      const delayMilliseconds = Math.min(5000 * attempt, 30000);

      logger.error('Bot launch failed', {
        attempt,
        code: error?.code,
        message: error?.message ?? error
      });

      if (!retryable) {
        throw error;
      }

      logger.log(`Retrying bot launch in ${delayMilliseconds}ms...`);
      await sleep(delayMilliseconds);
    }
  }

  return false;
}

function createBotApp(config) {
  const bot = new Telegraf(config.botToken);
  const sessionStore = createSessionStore();

   bot.catch((error, ctx) => {
    console.error('Bot update error', {
      updateId: ctx?.update?.update_id,
      error: error?.message ?? error
    });
  });

  registerHandlers(bot, {
    sessionStore,
    gameConfig: config.game
  });

  return { bot, sessionStore };
}

function createRuntimeApp(config, options = {}) {
  const processStartedAt = options.processStartedAt ?? Date.now();
  const { bot, sessionStore } = createBotApp(config);
  const dashboardController = createDashboardController({
    sessionStore,
    processStartedAt,
    gameConfig: config.game
  });
  const dashboardServer = createDashboardServer({
    controller: dashboardController,
    port: config.dashboard.port,
    logger: options.logger
  });

  return {
    bot,
    sessionStore,
    dashboardServer,
    processStartedAt
  };
}

async function main() {
  const config = loadEnv();
  const runtime = createRuntimeApp(config);
  const { bot, dashboardServer } = runtime;

  let shuttingDown = false;
  let botStarted = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await dashboardServer.stop();

    if (botStarted) {
      bot.stop(signal);
    }
  }

  await dashboardServer.start();

  launchBotWithRetry(bot, {
    shouldStop: () => shuttingDown,
    logger: console
  })
    .then((started) => {
      botStarted = started;
    })
    .catch(async (error) => {
      console.error('Fatal bot startup error', error);
      process.exitCode = 1;
      await shutdown('BOT_STARTUP_FATAL');
    });

  process.once('SIGINT', () => {
    shutdown('SIGINT').catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
  process.once('SIGTERM', () => {
    shutdown('SIGTERM').catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  });
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  createBotApp,
  createRuntimeApp,
  main,
  sleep,
  isRetryableTelegramError,
  launchBotWithRetry
};
