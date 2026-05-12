const test = require('node:test');
const assert = require('node:assert/strict');

const { createDashboardController } = require('../src/dashboard/dashboard-controller');
const { createDashboardServer } = require('../src/dashboard/create-dashboard-server');
const { createSessionStore } = require('../src/session/session-store');

async function withServer(options, run) {
  const controller = createDashboardController(options);
  const server = createDashboardServer({
    controller,
    port: 0,
    logger: { info() {} }
  });

  await server.start();

  try {
    const address = server.getAddress();
    return await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await server.stop();
  }
}

test('dashboard server expone health y snapshot JSON del proceso actual', async () => {
  const sessionStore = createSessionStore();
  sessionStore.set(1001, {
    chatId: 1001,
    status: 'active',
    score: 5,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-1',
      problem: { prompt: 'Cuanto es 7 - 4?' },
      choices: [3, 1, 2, 4],
      expiresAt: 1700000005000,
      timeoutId: { internal: true }
    }
  });

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 15, scoreIncrement: 1 },
      now: () => 1700000001000,
      botState: {
        mode: 'polling',
        status: 'connected',
        launchAttempts: 2,
        connectedAt: '2026-05-12T18:00:00.000Z',
        lastError: null
      },
      webhookPath: '/telegram/webhook'
    },
    async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/health`);
      assert.equal(healthResponse.status, 200);
      const healthPayload = await healthResponse.json();

      assert.equal(healthPayload.ok, true);
      assert.equal(healthPayload.uptimeSeconds, 1);
      assert.equal(healthPayload.telegram.mode, 'polling');
      assert.equal(healthPayload.telegram.status, 'connected');
      assert.equal(healthPayload.telegram.launchAttempts, 2);
      assert.equal(healthPayload.sessions.total, 1);
      assert.equal(healthPayload.sessions.active, 1);

      const snapshotResponse = await fetch(`${baseUrl}/api/snapshot`);
      assert.equal(snapshotResponse.status, 200);
      const snapshot = await snapshotResponse.json();

      assert.equal(snapshot.counts.total, 1);
      assert.equal(snapshot.counts.active, 1);
      assert.equal(snapshot.sessions[0].turn.remainingMs, 4000);
      assert.equal(snapshot.sessions[0].turn.timeoutId, undefined);
      assert.match(snapshot.emptyState.message, /memoria efimera|Snapshot en memoria/i);
      assert.equal(snapshot.telegram.status, 'connected');
    }
  );
});

test('keepalive server responde en raiz y marca dashboard como removido', async () => {
  const sessionStore = createSessionStore();
  sessionStore.set(42, {
    chatId: 42,
    status: 'active',
    score: 9,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-active',
      problem: { prompt: 'Cuanto es 8 - 3?' },
      choices: [5, 4, 6, 3],
      expiresAt: 1700000010000,
      timeoutId: null
    }
  });

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 15, scoreIncrement: 1 },
      now: () => 1700000002000,
      botState: {
        mode: 'webhook',
        status: 'retrying',
        launchAttempts: 3,
        connectedAt: null,
        lastError: {
          code: 'ETIMEDOUT',
          message: 'temporary timeout',
          retryable: true,
          at: '2026-05-12T18:00:05.000Z'
        }
      },
      webhookPath: '/telegram/webhook'
    },
    async (baseUrl) => {
      const rootResponse = await fetch(`${baseUrl}/`);
      const rootPayload = await rootResponse.json();

      assert.equal(rootResponse.status, 200);
      assert.equal(rootPayload.telegram.mode, 'webhook');
      assert.equal(rootPayload.telegram.status, 'retrying');
      assert.equal(rootPayload.telegram.lastError.code, 'ETIMEDOUT');

      const removedResponse = await fetch(`${baseUrl}/dashboard`);
      const removedMessage = await removedResponse.text();

      assert.equal(removedResponse.status, 410);
      assert.match(removedMessage, /Dashboard removed/i);
    }
  );
});

test('keepalive server devuelve 503 en webhook antes de registrar handler', async () => {
  const sessionStore = createSessionStore();

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 15, scoreIncrement: 1 },
      now: () => 1700000005000,
      webhookPath: '/telegram/webhook'
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/telegram/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ update_id: 1 })
      });
      const payload = await response.json();

      assert.equal(response.status, 503);
      assert.equal(payload.ok, false);
      assert.match(payload.error, /not ready/i);
    }
  );
});

test('keepalive server expone snapshot cuando no hay sesiones en memoria', async () => {
  const sessionStore = createSessionStore();

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 20, scoreIncrement: 2 },
      now: () => 1700000010000,
      webhookPath: '/telegram/webhook'
    },
    async (baseUrl) => {
      const snapshotResponse = await fetch(`${baseUrl}/api/snapshot`);
      const snapshot = await snapshotResponse.json();

      assert.equal(snapshotResponse.status, 200);
      assert.equal(snapshot.counts.total, 0);
      assert.equal(snapshot.config.turnTimeoutSeconds, 20);
      assert.equal(snapshot.config.scoreIncrement, 2);
      assert.match(snapshot.emptyState.message, /pudo perderse si el proceso reinicio/i);
    }
  );
});
