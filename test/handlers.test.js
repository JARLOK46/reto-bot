const test = require('node:test');
const assert = require('node:assert/strict');

const { createSessionStore } = require('../src/session/session-store');
const { createCallbackHandler } = require('../src/handlers/callback-handler');
const { createMessageHandler } = require('../src/handlers/message-handler');
const { createStartHandler } = require('../src/handlers/start-handler');
const { createAnswerCallbackData } = require('../src/game/subtraction-game');

function createFakeClock() {
  const timers = [];

  return {
    setTimeoutFn(callback, delay) {
      const timer = { callback, delay };
      timers.push(timer);
      return timer;
    },
    clearTimeoutFn() {},
    runNext() {
      const timer = timers.shift();

      if (timer) {
        timer.callback();
      }
    }
  };
}

function createCtx({ text = '', callbackData, chatId = 123 } = {}) {
  const replies = [];
  const callbackReplies = [];
  const sentMessages = [];

  return {
    callbackQuery: callbackData ? { data: callbackData } : undefined,
    chat: { id: chatId },
    message: { text },
    replies,
    sentMessages,
    callbackReplies,
    telegram: {
      async sendMessage(targetChatId, message) {
        sentMessages.push({ chatId: targetChatId, message });
      }
    },
    async answerCbQuery(message) {
      callbackReplies.push(message);
    },
    async reply(message, extra) {
      replies.push({ message, extra });
    }
  };
}

function createOldQueryError() {
  const error = new Error('Bad Request: query is too old and response timeout expired or query ID is invalid');
  error.response = {
    description: 'Bad Request: query is too old and response timeout expired or query ID is invalid'
  };

  return error;
}

test('start handler inicia una sesion nueva con turno activo y botones', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const ctx = createCtx({ text: '/start' });

  await startHandler(ctx);

  const session = sessionStore.get(123);
  assert.equal(session.score, 0);
  assert.equal(session.level, 1);
  assert.equal(session.status, 'active');
  assert.ok(session.turn.id);
  assert.equal(ctx.replies.length, 1);
  assert.match(ctx.replies[0].message, /Nueva sesion de restas/);
  assert.ok(ctx.replies[0].extra.reply_markup.inline_keyboard.length > 0);
});

test('message handler acepta fallback textual y genera un nuevo turno', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const messageHandler = createMessageHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const startCtx = createCtx({ text: '/start' });

  await startHandler(startCtx);

  const firstTurn = sessionStore.get(123).turn;
  const answerCtx = createCtx({ text: String(firstTurn.problem.answer) });

  await messageHandler(answerCtx);

  const session = sessionStore.get(123);
  assert.equal(session.score, 1);
  assert.notEqual(session.turn.id, firstTurn.id);
  assert.match(answerCtx.replies[0].message, /respuesta es correcta/i);
  assert.notEqual(session.turn.problem.answer, firstTurn.problem.answer);
});

test('callback handler acepta la opcion correcta y usa el mismo flujo canonico', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const callbackHandler = createCallbackHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const startCtx = createCtx({ text: '/start' });

  await startHandler(startCtx);

  const firstTurn = sessionStore.get(123).turn;
  const callbackCtx = createCtx({
    callbackData: createAnswerCallbackData(firstTurn.id, firstTurn.problem.answer)
  });

  await callbackHandler(callbackCtx);

  const session = sessionStore.get(123);
  assert.equal(session.score, 1);
  assert.notEqual(session.turn.id, firstTurn.id);
  assert.deepEqual(callbackCtx.callbackReplies, ['Respuesta correcta.']);
  assert.equal(callbackCtx.replies.length, 1);
});

test('timeout cierra la sesion completa y envia mensaje de expiracion', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const ctx = createCtx({ text: '/start' });

  await startHandler(ctx);
  clock.runNext();

  const session = sessionStore.get(123);
  assert.equal(session.status, 'expired');
  assert.equal(ctx.sentMessages.length, 1);
  assert.match(ctx.sentMessages[0].message, /Se acabo el tiempo/);
});

test('respuesta tardia por texto no duplica efectos y orienta al usuario', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const messageHandler = createMessageHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const startCtx = createCtx({ text: '/start' });

  await startHandler(startCtx);
  const scoreBefore = sessionStore.get(123).score;
  const expiredTurn = sessionStore.get(123).turn;

  clock.runNext();

  const lateCtx = createCtx({ text: String(expiredTurn.problem.answer) });
  await messageHandler(lateCtx);

  assert.equal(sessionStore.get(123).score, scoreBefore);
  assert.deepEqual(lateCtx.replies.map((reply) => reply.message), [
    'Ese turno ya no esta vigente. Escribe /start para comenzar una nueva sesion.'
  ]);
});

test('respuesta incorrecta por texto cierra la sesion y orienta el reinicio', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const messageHandler = createMessageHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const startCtx = createCtx({ text: '/start' });

  await startHandler(startCtx);

  const activeTurn = sessionStore.get(123).turn;
  const wrongAnswer = activeTurn.choices.find((choice) => choice !== activeTurn.problem.answer) ?? activeTurn.problem.answer + 1;
  const wrongCtx = createCtx({ text: String(wrongAnswer) });

  await messageHandler(wrongCtx);

  const session = sessionStore.get(123);
  assert.equal(session.score, 0);
  assert.equal(session.status, 'ended');
  assert.match(wrongCtx.replies[0].message, /Respuesta incorrecta\./);
  assert.match(wrongCtx.replies[0].message, /Escribe \/start para intentarlo otra vez\./);
});

test('callback tardio o repetido se ignora sin duplicar puntaje', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const startHandler = createStartHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const callbackHandler = createCallbackHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });
  const startCtx = createCtx({ text: '/start' });

  await startHandler(startCtx);

  const firstTurn = sessionStore.get(123).turn;
  const firstCallbackCtx = createCtx({
    callbackData: createAnswerCallbackData(firstTurn.id, firstTurn.problem.answer)
  });

  await callbackHandler(firstCallbackCtx);

  const scoreAfterFirstAnswer = sessionStore.get(123).score;
  const lateCallbackCtx = createCtx({
    callbackData: createAnswerCallbackData(firstTurn.id, firstTurn.problem.answer)
  });

  await callbackHandler(lateCallbackCtx);

  assert.equal(sessionStore.get(123).score, scoreAfterFirstAnswer);
  assert.deepEqual(lateCallbackCtx.callbackReplies, ['Ese turno ya no esta vigente.']);
  assert.equal(lateCallbackCtx.replies.length, 0);
});

test('callback viejo de Telegram no tumba el proceso si answerCbQuery expira', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const callbackHandler = createCallbackHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });

  const ctx = createCtx({ callbackData: createAnswerCallbackData('turn-viejo', 4) });
  ctx.answerCbQuery = async () => {
    throw createOldQueryError();
  };

  await assert.doesNotReject(async () => {
    await callbackHandler(ctx);
  });
});

test('al llegar a 20 puntos el siguiente turno sube automaticamente a nivel 2', async () => {
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const messageHandler = createMessageHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });

  sessionStore.set(123, {
    chatId: 123,
    score: 19,
    scoreIncrement: 1,
    level: 1,
    status: 'active',
    turn: {
      id: 'turn-19',
      problem: { minuend: 9, subtrahend: 4, answer: 5, prompt: 'Cuanto es 9 - 4?' },
      choices: [5, 4, 6, 7],
      expiresAt: Date.now() + 10000,
      timeoutId: null
    }
  });

  const ctx = createCtx({ text: '5' });
  await messageHandler(ctx);

  const session = sessionStore.get(123);
  assert.equal(session.score, 20);
  assert.equal(session.level, 2);
  assert.ok(session.turn.problem.minuend >= 10);
  assert.ok(session.turn.problem.subtrahend >= 10);
  assert.ok(session.turn.problem.answer >= 0 && session.turn.problem.answer <= 89);
  assert.match(ctx.replies[0].message, /Subiste al nivel 2/);
});

test('message handler pasa previousAnswer al siguiente turno sin romper el contrato', async () => {
  const originalRandom = Math.random;
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const messageHandler = createMessageHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });

  sessionStore.set(123, {
    chatId: 123,
    score: 0,
    scoreIncrement: 1,
    level: 1,
    status: 'active',
    turn: {
      id: 'turn-prev',
      problem: { minuend: 9, subtrahend: 4, answer: 5, prompt: 'Cuanto es 9 - 4?' },
      choices: [5, 4, 6, 7],
      expiresAt: Date.now() + 10000,
      timeoutId: null
    }
  });

  Math.random = () => 0.55;

  try {
    const ctx = createCtx({ text: '5' });
    await messageHandler(ctx);

    const session = sessionStore.get(123);
    assert.equal(session.score, 1);
    assert.equal(session.status, 'active');
    assert.notEqual(session.turn.problem.answer, 5);
    assert.equal(session.turn.choices.length, 4);
    assert.equal(new Set(session.turn.choices).size, 4);
    assert.ok(session.turn.choices.includes(session.turn.problem.answer));
    assert.match(ctx.replies[0].message, /respuesta es correcta/i);
  } finally {
    Math.random = originalRandom;
  }
});

test('al subir a nivel 2 mantiene callbacks, expiracion y evita repetir la respuesta previa', async () => {
  const originalRandom = Math.random;
  const clock = createFakeClock();
  const sessionStore = createSessionStore(clock);
  const callbackHandler = createCallbackHandler({
    sessionStore,
    gameConfig: { scoreIncrement: 1, turnTimeoutSeconds: 15 }
  });

  sessionStore.set(123, {
    chatId: 123,
    score: 19,
    scoreIncrement: 1,
    level: 1,
    status: 'active',
    turn: {
      id: 'turn-level-up',
      problem: { minuend: 9, subtrahend: 4, answer: 5, prompt: 'Cuanto es 9 - 4?' },
      choices: [5, 4, 6, 7],
      expiresAt: Date.now() + 10000,
      timeoutId: null
    }
  });

  Math.random = () => 0.06;

  try {
    const ctx = createCtx({
      callbackData: createAnswerCallbackData('turn-level-up', 5)
    });

    await callbackHandler(ctx);

    const session = sessionStore.get(123);
    assert.equal(session.score, 20);
    assert.equal(session.level, 2);
    assert.notEqual(session.turn.problem.answer, 5);
    assert.ok(session.turn.problem.answer >= 0 && session.turn.problem.answer <= 89);
    assert.ok(session.turn.expiresAt > Date.now());
    assert.deepEqual(ctx.callbackReplies, ['Respuesta correcta.']);
    assert.match(ctx.replies[0].message, /Subiste al nivel 2/);
  } finally {
    Math.random = originalRandom;
  }
});

test('message handler ignora /start para no duplicar respuestas', async () => {
  const sessionStore = createSessionStore();
  const messageHandler = createMessageHandler({ sessionStore });
  const ctx = createCtx({ text: '/start' });

  await messageHandler(ctx);

  assert.deepEqual(ctx.replies, []);
});
