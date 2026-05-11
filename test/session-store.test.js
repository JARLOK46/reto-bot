const test = require('node:test');
const assert = require('node:assert/strict');

const { createSessionStore } = require('../src/session/session-store');

function createFakeClock() {
  let nextId = 1;
  const timers = new Map();
  const cleared = [];

  return {
    cleared,
    setTimeoutFn(callback, delay) {
      const timer = { id: nextId += 1, callback, delay };
      timers.set(timer.id, timer);
      return timer;
    },
    clearTimeoutFn(timer) {
      if (!timer) {
        return;
      }

      cleared.push(timer.id);
      timers.delete(timer.id);
    },
    run(timer) {
      const scheduled = timers.get(timer.id);

      if (!scheduled) {
        return;
      }

      timers.delete(timer.id);
      scheduled.callback();
    }
  };
}

test('session store reemplaza el timer previo al programar un nuevo turno', () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    turn: { id: 'turn-1', timeoutId: null }
  });

  const firstSession = sessionStore.scheduleTurnTimeout(123, 'turn-1', 1000, () => {});
  const firstTimerId = firstSession.turn.timeoutId.id;

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    turn: { id: 'turn-2', timeoutId: null }
  });

  const secondSession = sessionStore.scheduleTurnTimeout(123, 'turn-2', 1000, () => {});

  assert.ok(clock.cleared.includes(firstTimerId));
  assert.equal(secondSession.turn.id, 'turn-2');
});

test('session store limpia timers al cerrar sesion', () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    turn: { id: 'turn-1', timeoutId: null }
  });

  const session = sessionStore.scheduleTurnTimeout(123, 'turn-1', 1000, () => {});
  const timerId = session.turn.timeoutId.id;
  const ended = sessionStore.endSession(123, { status: 'ended' });

  assert.ok(clock.cleared.includes(timerId));
  assert.equal(ended.status, 'ended');
  assert.equal(ended.turn.timeoutId, null);
});

test('session store descarta timeouts obsoletos por turnId', () => {
  const clock = createFakeClock();
  const expirations = [];
  const sessionStore = createSessionStore(clock);

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    turn: { id: 'turn-1', timeoutId: null }
  });

  const firstSession = sessionStore.scheduleTurnTimeout(123, 'turn-1', 1000, (payload) => {
    expirations.push(payload.turnId);
  });
  const staleTimer = firstSession.turn.timeoutId;

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    turn: { id: 'turn-2', timeoutId: null }
  });

  sessionStore.scheduleTurnTimeout(123, 'turn-2', 1000, (payload) => {
    expirations.push(payload.turnId);
  });

  clock.run(staleTimer);

  assert.deepEqual(expirations, []);
});

test('session store expone snapshot serializable sin timeoutId y con contadores', () => {
  const sessionStore = createSessionStore();

  sessionStore.set(123, {
    chatId: 123,
    status: 'active',
    score: 6,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-active',
      problem: { prompt: 'Cuanto es 7 - 2?' },
      choices: [5, 4, 6, 3],
      expiresAt: 1700000005000,
      timeoutId: { hidden: true }
    }
  });

  sessionStore.set(456, {
    chatId: 456,
    status: 'ended',
    score: 2,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-ended',
      problem: { prompt: 'Cuanto es 4 - 3?' },
      choices: [1, 0, 2, 3],
      expiresAt: 1699999999000,
      timeoutId: null
    }
  });

  sessionStore.set(789, {
    chatId: 789,
    status: 'expired',
    score: 1,
    level: 1,
    scoreIncrement: 1,
    turn: {
      id: 'turn-expired',
      problem: { prompt: 'Cuanto es 3 - 1?' },
      choices: [2, 1, 0, 3],
      expiresAt: 1699999995000,
      timeoutId: null
    }
  });

  const snapshot = sessionStore.getSnapshot({
    now: 1700000001000,
    processStartedAt: 1700000000000,
    gameConfig: {
      turnTimeoutSeconds: 15,
      scoreIncrement: 1
    }
  });

  assert.equal(snapshot.uptimeSeconds, 1);
  assert.deepEqual(snapshot.counts, {
    total: 3,
    active: 1,
    ended: 1,
    expired: 1
  });
  assert.equal(snapshot.sessions[0].turn.remainingMs, 4000);
  assert.equal(snapshot.sessions[0].turn.timeoutId, undefined);
  assert.equal(snapshot.sessions[1].turn.isExpired, true);
  assert.equal(snapshot.emptyState.hasSessions, true);
});

test('session store devuelve snapshot valido cuando no hay sesiones', () => {
  const sessionStore = createSessionStore();
  const snapshot = sessionStore.getSnapshot({
    now: 1700000005000,
    processStartedAt: 1700000000000,
    gameConfig: {
      turnTimeoutSeconds: 15,
      scoreIncrement: 1
    }
  });

  assert.deepEqual(snapshot.counts, {
    total: 0,
    active: 0,
    ended: 0,
    expired: 0
  });
  assert.deepEqual(snapshot.sessions, []);
  assert.equal(snapshot.emptyState.hasSessions, false);
  assert.match(snapshot.emptyState.message, /No hay sesiones activas en este proceso/i);
});
