const dotenv = require('dotenv');

const { DEFAULT_SCORE_INCREMENT, DEFAULT_TURN_TIMEOUT_SECONDS } = require('../game/subtraction-game');

const DEFAULT_DASHBOARD_PORT = 3000;
const DEFAULT_WEBHOOK_PATH = '/telegram/webhook';

dotenv.config();

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

function normalizePath(value, fallback) {
  const path = (value ?? fallback ?? '').trim();

  if (!path) {
    return fallback;
  }

  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeUrl(value) {
  const normalized = String(value ?? '').trim().replace(/\/$/, '');

  if (!normalized) {
    return '';
  }

  return normalized;
}

function loadEnv() {
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
  const portValue = process.env.PORT ?? process.env.DASHBOARD_PORT;
  const dashboardPort = parseInteger(portValue, DEFAULT_DASHBOARD_PORT, 'PORT');
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
