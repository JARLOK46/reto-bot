const dotenv = require('dotenv');

const { DEFAULT_SCORE_INCREMENT, DEFAULT_TURN_TIMEOUT_SECONDS } = require('../game/subtraction-game');

const DEFAULT_DASHBOARD_PORT = 3000;
const DEFAULT_WEBHOOK_PATH = '/telegram/webhook';

dotenv.config();

// Convierte variables numéricas opcionales y produce un error claro si el valor
// existe pero viene mal formado.
function parseInteger(value, fallback, name) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed)) {
    throw new Error(`${name} must be an integer.`);
  }

  return parsed;
}

// Normaliza rutas para webhook/HTTP y asegura que siempre empiecen con '/'.
function normalizePath(value, fallback) {
  const path = (value ?? fallback ?? '').trim();

  if (!path) {
    return fallback;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

// Limpia la URL para evitar espacios o slashes sobrantes al final.
function normalizeUrl(value) {
  const normalized = String(value ?? '').trim().replace(/\/$/, '');

  if (!normalized) {
    return '';
  }

  return normalized;
}

function loadEnv() {
  // BOT_TOKEN es obligatorio porque sin él el bot no puede hablar con Telegram.
  const botToken = process.env.BOT_TOKEN;

  if (!botToken) {
    throw new Error('BOT_TOKEN is required.');
  }

  const scoreIncrement = parseInteger(process.env.SCORE_INCREMENT, DEFAULT_SCORE_INCREMENT, 'SCORE_INCREMENT');
  const turnTimeoutSeconds = parseInteger(
    process.env.TURN_TIMEOUT_SECONDS,
    DEFAULT_TURN_TIMEOUT_SECONDS,
    'TURN_TIMEOUT_SECONDS'
  );

  // En Render el puerto real llega por PORT. Localmente se usa DASHBOARD_PORT
  // para el servidor HTTP del dashboard, salud y webhook.
  const portValue = process.env.PORT ?? process.env.DASHBOARD_PORT;
  const dashboardPort = parseInteger(portValue, DEFAULT_DASHBOARD_PORT, 'PORT');

  // Si existe URL pública, asume webhook por defecto. Si no, usa polling
  // para facilitar pruebas locales.
  const webhookBaseUrl = normalizeUrl(process.env.WEBHOOK_BASE_URL ?? process.env.RENDER_EXTERNAL_URL);
  const telegramMode = (process.env.TELEGRAM_MODE ?? (webhookBaseUrl ? 'webhook' : 'polling')).trim().toLowerCase();
  const webhookPath = normalizePath(process.env.WEBHOOK_PATH, DEFAULT_WEBHOOK_PATH);
  const webhookSecretToken = process.env.WEBHOOK_SECRET_TOKEN?.trim() || undefined;

  if (scoreIncrement <= 0) {
    throw new Error('SCORE_INCREMENT must be greater than 0.');
  }

  if (turnTimeoutSeconds <= 0) {
    throw new Error('TURN_TIMEOUT_SECONDS must be greater than 0.');
  }

  if (dashboardPort <= 0) {
    throw new Error('DASHBOARD_PORT must be greater than 0.');
  }

  if (!['polling', 'webhook'].includes(telegramMode)) {
    throw new Error('TELEGRAM_MODE must be either polling or webhook.');
  }

  if (telegramMode === 'webhook' && !webhookBaseUrl) {
    throw new Error('WEBHOOK_BASE_URL is required when TELEGRAM_MODE=webhook.');
  }

  // Devuelve un objeto ya normalizado para que el resto del sistema no dependa
  // de process.env directamente ni repita validaciones.
  return {
    botToken,
    dashboard: {
      port: dashboardPort
    },
    telegram: {
      mode: telegramMode,
      webhookBaseUrl,
      webhookPath,
      webhookSecretToken
    },
    game: {
      scoreIncrement,
      turnTimeoutSeconds
    }
  };
}

module.exports = {
  DEFAULT_DASHBOARD_PORT,
  DEFAULT_WEBHOOK_PATH,
  loadEnv
};
