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
      now: () => 1700000001000
    },
    async (baseUrl) => {
      const healthResponse = await fetch(`${baseUrl}/api/health`);
      assert.equal(healthResponse.status, 200);
      assert.deepEqual(await healthResponse.json(), { ok: true, uptimeSeconds: 1 });

      const snapshotResponse = await fetch(`${baseUrl}/api/snapshot`);
      assert.equal(snapshotResponse.status, 200);
      const snapshot = await snapshotResponse.json();

      assert.equal(snapshot.counts.total, 1);
      assert.equal(snapshot.counts.active, 1);
      assert.equal(snapshot.sessions[0].turn.remainingMs, 4000);
      assert.equal(snapshot.sessions[0].turn.timeoutId, undefined);
      assert.match(snapshot.emptyState.message, /memoria efimera|Snapshot en memoria/i);
    }
  );
});

test('dashboard server renderiza HTML con tarjeta de turno activo y aviso efimero', async () => {
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
      now: () => 1700000002000
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /Turno activo/i);
      assert.match(html, /Cuanto es 8 - 3\?/i);
      assert.match(html, /Estado en memoria del proceso actual/i);
      assert.match(html, /sin historico persistente/i);
    }
  );
});

test('dashboard server muestra snapshot sin turno activo cuando solo hay sesiones cerradas', async () => {
  const sessionStore = createSessionStore();
  sessionStore.set(7, {
    chatId: 7,
    status: 'expired',
    score: 2,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-expired',
      problem: { prompt: 'Cuanto es 6 - 1?' },
      choices: [5, 4, 6, 3],
      expiresAt: 1700000000000,
      timeoutId: null
    }
  });

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 15, scoreIncrement: 1 },
      now: () => 1700000005000
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard`);
      const html = await response.text();

      assert.equal(response.status, 200);
      assert.match(html, /No hay turno activo ahora/i);
      assert.match(html, /Expirada/i);
    }
  );
});

test('dashboard server muestra empty state veraz cuando no hay sesiones en memoria', async () => {
  const sessionStore = createSessionStore();

  await withServer(
    {
      sessionStore,
      processStartedAt: 1700000000000,
      gameConfig: { turnTimeoutSeconds: 20, scoreIncrement: 2 },
      now: () => 1700000010000
    },
    async (baseUrl) => {
      const response = await fetch(`${baseUrl}/dashboard`);
      const html = await response.text();

      const snapshotResponse = await fetch(`${baseUrl}/api/snapshot`);
      const snapshot = await snapshotResponse.json();

      assert.equal(response.status, 200);
      assert.match(html, /No hay sesiones en memoria/i);
      assert.match(html, /Timeout turno/i);
      assert.match(html, /20s/i);
      assert.match(html, /memoria efimera del proceso actual/i);
      assert.match(html, /estado anterior pudo perderse|entre reinicios/i);
      assert.match(snapshot.emptyState.message, /pudo perderse si el proceso reinicio/i);
    }
  );
});
