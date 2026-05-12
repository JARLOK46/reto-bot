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

function toRuntimeError(error) {
  if (!error) {
    return null;
  }

  return {
    code: error?.code ?? null,
    message: error?.message ?? String(error),
    retryable: isRetryableTelegramError(error),
    at: new Date().toISOString()
  };
}

function createBotState(config) {
  return {
    mode: config.telegram.mode,
    status: 'idle',
    launchAttempts: 0,
    connectedAt: null,
    lastError: null
  };
}

async function launchBotWithRetry(bot, { shouldStop, logger = console, botState } = {}) {
  let attempt = 0;

  while (!shouldStop()) {
    try {
      attempt += 1;
      if (botState) {
        botState.status = 'connecting';
        botState.launchAttempts = attempt;
        botState.lastError = null;
      }

      logger.log(`Launching bot (attempt ${attempt})...`);
      await bot.launch();
      if (botState) {
        botState.status = 'connected';
        botState.connectedAt = new Date().toISOString();
      }
      logger.log('Bot launched successfully');
      return true;
    } catch (error) {
      const retryable = isRetryableTelegramError(error);
      const delayMilliseconds = Math.min(5000 * attempt, 30000);

      if (botState) {
        botState.status = retryable ? 'retrying' : 'failed';
        botState.lastError = toRuntimeError(error);
      }

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

async function registerWebhookWithRetry(bot, telegramConfig, { shouldStop, logger = console, botState } = {}) {
  let attempt = 0;

  while (!shouldStop()) {
    try {
      attempt += 1;
      if (botState) {
        botState.status = 'connecting';
        botState.launchAttempts = attempt;
        botState.lastError = null;
      }

      logger.log(`Registering webhook (attempt ${attempt})...`);
      const webhookHandler = await bot.createWebhook({
        domain: telegramConfig.webhookBaseUrl,
        path: telegramConfig.webhookPath,
        secret_token: telegramConfig.webhookSecretToken
      });

      if (botState) {
        botState.status = 'connected';
        botState.connectedAt = new Date().toISOString();
      }

      logger.log('Webhook registered successfully');
      return webhookHandler;
    } catch (error) {
      const retryable = isRetryableTelegramError(error);
      const delayMilliseconds = Math.min(5000 * attempt, 30000);

      if (botState) {
        botState.status = retryable ? 'retrying' : 'failed';
        botState.lastError = toRuntimeError(error);
      }

      logger.error('Webhook registration failed', {
        attempt,
        code: error?.code,
        message: error?.message ?? error
      });

      if (!retryable) {
        throw error;
      }

      logger.log(`Retrying webhook registration in ${delayMilliseconds}ms...`);
      await sleep(delayMilliseconds);
    }
  }

  return null;
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
  const botState = createBotState(config);
  const dashboardController = createDashboardController({
    sessionStore,
    processStartedAt,
    gameConfig: config.game,
    botState,
    webhookPath: config.telegram.webhookPath
  });
  const dashboardServer = createDashboardServer({
    controller: dashboardController,
    port: config.dashboard.port,
    logger: options.logger
  });

  return {
    bot,
    sessionStore,
    botState,
    controller: dashboardController,
    dashboardServer,
    processStartedAt
  };
}

async function main() {
  const config = loadEnv();
  const runtime = createRuntimeApp(config);
  const { bot, botState, controller, dashboardServer } = runtime;

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

  Promise.resolve()
    .then(async () => {
      if (config.telegram.mode === 'webhook') {
        const webhookHandler = await registerWebhookWithRetry(bot, config.telegram, {
          shouldStop: () => shuttingDown,
          logger: console,
          botState
        });

        if (webhookHandler) {
          controller.setWebhookHandler(webhookHandler);
          botStarted = true;
        }

        return;
      }

      botStarted = await launchBotWithRetry(bot, {
        shouldStop: () => shuttingDown,
        logger: console,
        botState
      });
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
  createBotState,
  toRuntimeError,
  isRetryableTelegramError,
  launchBotWithRetry,
  registerWebhookWithRetry
};
