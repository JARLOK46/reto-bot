const { Telegraf } = require('telegraf');
const { loadEnv } = require('./config/env');
const { createSessionStore } = require('./session/session-store');
const { registerHandlers } = require('./handlers/register-handlers');
const { createDashboardController } = require('./dashboard/dashboard-controller');
const { createDashboardServer } = require('./dashboard/create-dashboard-server');

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

  await dashboardServer.start();

  try {
    await bot.launch();
  } catch (error) {
    await dashboardServer.stop();
    throw error;
  }

  let shuttingDown = false;

  async function shutdown(signal) {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await dashboardServer.stop();
    bot.stop(signal);
  }

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
  main
};
