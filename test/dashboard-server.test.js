const test = require('node:test');
const assert = require('node:assert/strict');

const { createDashboardController } = require('../src/dashboard/dashboard-controller');
const { createDashboardServer } = require('../src/dashboard/create-dashboard-server');
const { createObservabilityStore } = require('../src/observability/observability-store');
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
  const observabilityStore = createObservabilityStore({ now: () => 1700000001000 });
  sessionStore.set(1001, {
    chatId: 1001,
    status: 'active',
    score: 5,
    level: 1,
    startedAt: 1699999999000,
    answeredCount: 3,
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
      observabilityStore,
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

      assert.equal(snapshot.sessions.counts.total, 1);
      assert.equal(snapshot.sessions.counts.active, 1);
      assert.equal(snapshot.sessions.sessions[0].turn.remainingMs, 4000);
      assert.equal(snapshot.sessions.sessions[0].turn.timeoutId, undefined);
      assert.match(snapshot.sessions.emptyState.message, /memoria efimera|Snapshot en memoria/i);
      assert.equal(snapshot.telegram.status, 'connected');
    }
  );
});

test('dashboard server renderiza HTML administrativo con estado y sesiones', async () => {
  const sessionStore = createSessionStore();
  const observabilityStore = createObservabilityStore({ now: () => 1700000002000 });
  sessionStore.set(42, {
    chatId: 42,
    status: 'active',
    score: 9,
    level: 1,
    startedAt: 1700000000000,
    answeredCount: 2,
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
      observabilityStore,
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

      const dashboardResponse = await fetch(`${baseUrl}/dashboard`);
      const dashboardHtml = await dashboardResponse.text();

      assert.equal(dashboardResponse.status, 200);
      assert.match(dashboardHtml, /Centro de control del bot/i);
      assert.match(dashboardHtml, /Turnos en vivo/i);
      assert.match(dashboardHtml, /Actividad reciente por chat/i);
      assert.match(dashboardHtml, /ETIMEDOUT/i);
      assert.match(dashboardHtml, /42/i);
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
  const observabilityStore = createObservabilityStore({ now: () => 1700000010000 });

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 20, scoreIncrement: 2 },
      now: () => 1700000010000,
      observabilityStore,
      webhookPath: '/telegram/webhook'
    },
    async (baseUrl) => {
      const snapshotResponse = await fetch(`${baseUrl}/api/snapshot`);
      const snapshot = await snapshotResponse.json();

      assert.equal(snapshotResponse.status, 200);
      assert.equal(snapshot.sessions.counts.total, 0);
      assert.equal(snapshot.sessions.config.turnTimeoutSeconds, 20);
      assert.equal(snapshot.sessions.config.scoreIncrement, 2);
      assert.match(snapshot.sessions.emptyState.message, /pudo perderse si el proceso reinicio/i);
    }
  );
});
