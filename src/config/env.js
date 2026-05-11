const dotenv = require('dotenv');

const { DEFAULT_SCORE_INCREMENT, DEFAULT_TURN_TIMEOUT_SECONDS } = require('../game/subtraction-game');

const DEFAULT_DASHBOARD_PORT = 3000;

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

  if (scoreIncrement <= 0) {
    throw new Error('SCORE_INCREMENT must be greater than 0.');
  }

  if (turnTimeoutSeconds <= 0) {
    throw new Error('TURN_TIMEOUT_SECONDS must be greater than 0.');
  }

  if (dashboardPort <= 0) {
    throw new Error('DASHBOARD_PORT must be greater than 0.');
  }

  return {
    botToken,
    dashboard: {
      port: dashboardPort
    },
    game: {
      scoreIncrement,
      turnTimeoutSeconds
    }
  };
}

module.exports = {
  DEFAULT_DASHBOARD_PORT,
  loadEnv
};
