const dns = require('node:dns');
const { Telegraf } = require('telegraf');
const { loadEnv } = require('./config/env');
const { createSessionStore } = require('./session/session-store');
const { createObservabilityStore, cloneError } = require('./observability/observability-store');
const { registerHandlers } = require('./handlers/register-handlers');
const { createDashboardController } = require('./dashboard/dashboard-controller');
const { createDashboardServer } = require('./dashboard/create-dashboard-server');

// En algunos despliegues de Render/Node, priorizar IPv4 reduce timeouts
// intermitentes al resolver api.telegram.org.
dns.setDefaultResultOrder('ipv4first');

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Solo reintentamos errores transitorios de red. Errores de configuración
// como 401/403/409 deben fallar de forma explícita para no ocultar el problema.
function isRetryableTelegramError(error) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code);
}

// Normaliza errores runtime para exponerlos en /health sin filtrar stacks completos.
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

// Estado observable del runtime. Esto permite saber desde /health si el bot
// está conectado, reintentando o falló por un error no recuperable.
function createBotState(config) {
  return {
    mode: config.telegram.mode,
    status: 'idle',
    launchAttempts: 0,
    connectedAt: null,
    lastError: null
  };
}

function syncRuntimeError(observabilityStore, error, scope, title) {
  if (!observabilityStore || !error) {
    return;
  }

  const normalized = cloneError(error);
  observabilityStore.recordBotError({
    ...normalized,
    scope,
    title
  });
}

function syncRuntimeEvent(observabilityStore, event) {
  observabilityStore?.recordRuntimeEvent(event);
}

// Modo polling: adecuado para desarrollo local o despliegues simples. En hosting
// puede fallar por cortes transitorios de red, por eso se reintenta con backoff.
async function launchBotWithRetry(bot, { shouldStop, logger = console, botState, observabilityStore } = {}) {
  let attempt = 0;

  while (!shouldStop()) {
    try {
      attempt += 1;
      if (botState) {
        botState.status = 'connecting';
        botState.launchAttempts = attempt;
        botState.lastError = null;
      }

      syncRuntimeEvent(observabilityStore, {
        type: 'runtime',
        title: 'Arranque del bot en polling',
        message: `Intento ${attempt} de conexión con Telegram en modo polling.`,
        meta: { attempt, mode: 'polling' }
      });

      logger.log(`Launching bot (attempt ${attempt})...`);
      await bot.launch();
      if (botState) {
        botState.status = 'connected';
        botState.connectedAt = new Date().toISOString();
      }

      syncRuntimeEvent(observabilityStore, {
        type: 'runtime',
        title: 'Bot conectado por polling',
        message: 'El bot quedó conectado correctamente a Telegram.',
        meta: { attempt, mode: 'polling' }
      });

      logger.log('Bot launched successfully');
      return true;
    } catch (error) {
      const retryable = isRetryableTelegramError(error);
      const delayMilliseconds = Math.min(5000 * attempt, 30000);

      if (botState) {
        botState.status = retryable ? 'retrying' : 'failed';
        botState.lastError = toRuntimeError(error);
      }

      syncRuntimeError(observabilityStore, toRuntimeError(error), 'bot-launch', 'Fallo en arranque polling');

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

// Modo webhook: preferido para Render Web Service. Telegraf registra el webhook
// remoto y nosotros conectamos el handler HTTP al servidor interno del proceso.
async function registerWebhookWithRetry(bot, telegramConfig, { shouldStop, logger = console, botState, observabilityStore } = {}) {
  let attempt = 0;

  while (!shouldStop()) {
    try {
      attempt += 1;
      if (botState) {
        botState.status = 'connecting';
        botState.launchAttempts = attempt;
        botState.lastError = null;
      }

      syncRuntimeEvent(observabilityStore, {
        type: 'runtime',
        title: 'Registro de webhook',
        message: `Intento ${attempt} de registrar el webhook de Telegram.`,
        meta: { attempt, mode: 'webhook', path: telegramConfig.webhookPath }
      });

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

      syncRuntimeEvent(observabilityStore, {
        type: 'runtime',
        title: 'Webhook registrado',
        message: 'Telegram quedó configurado para enviar updates al servicio HTTP.',
        meta: { attempt, mode: 'webhook', path: telegramConfig.webhookPath }
      });

      logger.log('Webhook registered successfully');
      return webhookHandler;
    } catch (error) {
      const retryable = isRetryableTelegramError(error);
      const delayMilliseconds = Math.min(5000 * attempt, 30000);

      if (botState) {
        botState.status = retryable ? 'retrying' : 'failed';
        botState.lastError = toRuntimeError(error);
      }

      syncRuntimeError(observabilityStore, toRuntimeError(error), 'webhook-register', 'Fallo al registrar webhook');

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
  const observabilityStore = createObservabilityStore();

  // Cualquier error dentro de handlers debe registrarse sin tumbar el proceso.
  bot.catch((error, ctx) => {
    observabilityStore.recordBotError({
      scope: 'bot-handler',
      code: error?.code ?? error?.response?.error_code ?? null,
      message: error?.message ?? String(error),
      chatId: ctx?.chat?.id,
      title: 'Error en handler del bot'
    });

    console.error('Bot update error', {
      updateId: ctx?.update?.update_id,
      error: error?.message ?? error
    });
  });

  registerHandlers(bot, {
    sessionStore,
    observabilityStore,
    gameConfig: config.game
  });

  return { bot, sessionStore, observabilityStore };
}

function createRuntimeApp(config, options = {}) {
  const processStartedAt = options.processStartedAt ?? Date.now();
  const { bot, sessionStore, observabilityStore } = createBotApp(config);
  const botState = createBotState(config);
  // El runtime HTTP ahora cumple dos funciones reales: servir el dashboard
  // administrativo y exponer rutas de salud/snapshot/webhook para Render.
  const dashboardController = createDashboardController({
    sessionStore,
    processStartedAt,
    gameConfig: config.game,
    botState,
    observabilityStore,
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
    observabilityStore,
    botState,
    controller: dashboardController,
    dashboardServer,
    processStartedAt
  };
}

async function main() {
  const config = loadEnv();
  const runtime = createRuntimeApp(config);
  const { bot, observabilityStore, botState, controller, dashboardServer } = runtime;

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

  // El servidor HTTP debe iniciar primero para que /health responda y, en modo
  // webhook, Telegram tenga un endpoint disponible cuando registremos la URL.
  await dashboardServer.start();

  Promise.resolve()
    .then(async () => {
      if (config.telegram.mode === 'webhook') {
        const webhookHandler = await registerWebhookWithRetry(bot, config.telegram, {
          shouldStop: () => shuttingDown,
          logger: console,
          botState,
          observabilityStore
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
        botState,
        observabilityStore
      });
    })
    .catch(async (error) => {
      syncRuntimeError(observabilityStore, toRuntimeError(error), 'runtime', 'Fallo fatal del runtime');
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
  syncRuntimeError,
  syncRuntimeEvent,
  toRuntimeError,
  isRetryableTelegramError,
  launchBotWithRetry,
  registerWebhookWithRetry
};
