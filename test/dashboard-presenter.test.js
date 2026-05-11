const test = require('node:test');
const assert = require('node:assert/strict');

const { createDashboardPresenter } = require('../src/dashboard/dashboard-presenter');

test('dashboard presenter prioriza la sesion activa y etiqueta datos efimeros', () => {
  const presenter = createDashboardPresenter();
  const viewModel = presenter.present({
    processStartedAt: Date.UTC(2026, 4, 8, 10, 0, 0),
    generatedAt: Date.UTC(2026, 4, 8, 10, 0, 5),
    uptimeSeconds: 5,
    config: {
      turnTimeoutSeconds: 15,
      scoreIncrement: 1
    },
    counts: {
      total: 2,
      active: 1,
      ended: 1,
      expired: 0
    },
    sessions: [
      {
        chatId: 99,
        status: 'ended',
        score: 4,
        level: 1,
        scoreIncrement: 1,
        turn: {
          id: 'turn-ended',
          prompt: 'Cuanto es 4 - 2?',
          choices: [2, 3, 1, 4],
          expiresAt: Date.UTC(2026, 4, 8, 9, 59, 50),
          remainingMs: 0,
          isExpired: true
        }
      },
      {
        chatId: 42,
        status: 'active',
        score: 7,
        level: 1,
        scoreIncrement: 1,
        turn: {
          id: 'turn-active',
          prompt: 'Cuanto es 8 - 5?',
          choices: [3, 2, 1, 4],
          expiresAt: Date.UTC(2026, 4, 8, 10, 0, 12),
          remainingMs: 7000,
          isExpired: false
        }
      }
    ]
  });

  assert.equal(viewModel.primarySession.chatId, '42');
  assert.equal(viewModel.primarySession.turn.remainingLabel, '7s restantes');
  assert.equal(viewModel.sessions[0].status, 'active');
  assert.equal(viewModel.sessions[0].ephemeralLabel, 'Efimero');
});

test('dashboard presenter refleja sesiones vencidas sin inventar turno activo', () => {
  const presenter = createDashboardPresenter();
  const viewModel = presenter.present({
    processStartedAt: Date.UTC(2026, 4, 8, 10, 0, 0),
    generatedAt: Date.UTC(2026, 4, 8, 10, 2, 0),
    uptimeSeconds: 120,
    config: {
      turnTimeoutSeconds: 15,
      scoreIncrement: 1
    },
    counts: {
      total: 1,
      active: 0,
      ended: 0,
      expired: 1
    },
    sessions: [
      {
        chatId: 7,
        status: 'expired',
        score: 3,
        level: 1,
        scoreIncrement: 1,
        turn: {
          id: 'turn-expired',
          prompt: 'Cuanto es 9 - 6?',
          choices: [3, 1, 2, 4],
          expiresAt: Date.UTC(2026, 4, 8, 10, 0, 30),
          remainingMs: 0,
          isExpired: true
        }
      }
    ]
  });

  assert.equal(viewModel.primarySession, null);
  assert.equal(viewModel.sessions[0].turn.remainingLabel, 'Vencido');
});
