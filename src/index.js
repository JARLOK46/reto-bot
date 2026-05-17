const dns = require('node:dns');
const { Telegraf } = require('telegraf');
const { loadEnv } = require('./config/env');
const { createSessionStore } = require('./session/session-store');
const { createObservabilityStore, cloneError } = require('./observability/observability-store');
const { registerHandlers } = require('./handlers/register-handlers');
const { createDashboardController } = require('./dashboard/dashboard-controller');
const { createDashboardServer } = require('./dashboard/create-dashboard-server');

// Prioriza IPv4 para reducir timeouts intermitentes al resolver api.telegram.org
// en algunos despliegues.
dns.setDefaultResultOrder('ipv4first');

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

// Solo reintenta errores temporales de red. Si el problema es de configuración,
// debe fallar de forma explícita para no ocultarlo.
function isRetryableTelegramError(error) {
  return ['ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'EAI_AGAIN'].includes(error?.code);
}

// Normaliza errores del runtime en un formato simple para mostrarlos en /health
// o en el dashboard.
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

// Representa el estado técnico del bot para saber si está conectado,
// reintentando o si ya falló por un error no recuperable.
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
  // Copia el error al store de observabilidad con un formato consistente.
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
  // Evita repetir validaciones nulas al registrar eventos de runtime.
  observabilityStore?.recordRuntimeEvent(event);
}

// Arranca el bot en modo polling. Si falla por red, aplica reintentos con backoff.
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

// Registra el webhook en Telegram y después conecta el handler HTTP al servidor
// interno del proceso.
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
  // Ensambla las piezas base del bot, sin conectarlo todavía con Telegram.
  const bot = new Telegraf(config.botToken);
  const sessionStore = createSessionStore();
  const observabilityStore = createObservabilityStore();

  // Si algo falla dentro de un handler, el error se registra sin tumbar todo el proceso.
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
  // Une Telegram, HTTP y observabilidad en una sola estructura de runtime.
  const processStartedAt = options.processStartedAt ?? Date.now();
  const { bot, sessionStore, observabilityStore } = createBotApp(config);
  const botState = createBotState(config);
  // El runtime HTTP sirve para mostrar el dashboard y para exponer
  // salud/snapshot/webhook hacia Render.
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
  // Orquesta el orden de arranque y apagado del sistema completo.
  const config = loadEnv();
  const runtime = createRuntimeApp(config);
  const { bot, observabilityStore, botState, controller, dashboardServer } = runtime;

  let shuttingDown = false;
  let botStarted = false;

  async function shutdown(signal) {
    // Evita intentar apagar dos veces si Render envía varias señales.
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    await dashboardServer.stop();

    if (botStarted) {
      bot.stop(signal);
    }
  }

  // El servidor HTTP inicia primero para que /health responda y, en modo
  // webhook, Telegram tenga el endpoint listo al registrar la URL.
  await dashboardServer.start();

  Promise.resolve()
    .then(async () => {
      // Elige el modo de conexión usando la configuración ya validada.
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
