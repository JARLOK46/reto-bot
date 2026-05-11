const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LEVEL_RULES,
  LEVEL_UP_SCORE,
  chooseAnswer,
  createChoices,
  createProblem,
  createTurn,
  formatCorrectAnswerMessage,
  formatExpiredTurnMessage,
  formatInactiveTurnMessage,
  formatNoSessionMessage,
  formatWelcomeMessage,
  getAnswerRange,
  getLevelForScore,
  resolveTurnAnswer
} = require('../src/game/subtraction-game');

function withMockedRandom(value, callback) {
  const originalRandom = Math.random;
  Math.random = () => value;

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function withMockedRandomSequence(values, callback) {
  const originalRandom = Math.random;
  let index = 0;
  Math.random = () => {
    const nextValue = values[Math.min(index, values.length - 1)];
    index += 1;
    return nextValue;
  };

  try {
    return callback();
  } finally {
    Math.random = originalRandom;
  }
}

function randomValueForInclusiveRange(target, min, max) {
  return ((target - min) + 0.5) / ((max - min) + 1);
}

test('getAnswerRange resuelve el rango real de respuestas por nivel', () => {
  assert.deepEqual(getAnswerRange(1), { minAnswer: 0, maxAnswer: 9 });
  assert.deepEqual(getAnswerRange(2), { minAnswer: 0, maxAnswer: 89 });
});

test('createProblem genera nivel 1 con respuestas 0..9 y restas no negativas', () => {
  for (let index = 0; index < 100; index += 1) {
    const problem = createProblem({ level: 1 });

    assert.ok(problem.minuend >= 0 && problem.minuend <= 9);
    assert.ok(problem.subtrahend >= 0 && problem.subtrahend <= problem.minuend);
    assert.equal(problem.answer, problem.minuend - problem.subtrahend);
    assert.ok(problem.answer >= 0 && problem.answer <= 9);
  }
});

test('createProblem genera nivel 2 con respuestas 0..89 y restas no negativas', () => {
  for (let index = 0; index < 100; index += 1) {
    const problem = createProblem({ level: 2 });

    assert.ok(problem.minuend >= 10 && problem.minuend <= 99);
    assert.ok(problem.subtrahend >= 10 && problem.subtrahend <= problem.minuend);
    assert.equal(problem.answer, problem.minuend - problem.subtrahend);
    assert.ok(problem.answer >= 0 && problem.answer <= 89);
  }
});

test('createProblem demuestra elegibilidad completa de respuestas en nivel 1', () => {
  const { minAnswer, maxAnswer } = getAnswerRange(1);
  const { minOperand, maxOperand } = LEVEL_RULES[1];
  const reachedAnswers = [];

  for (let expectedAnswer = minAnswer; expectedAnswer <= maxAnswer; expectedAnswer += 1) {
    const problem = withMockedRandomSequence([
      randomValueForInclusiveRange(expectedAnswer, minAnswer, maxAnswer),
      randomValueForInclusiveRange(minOperand, minOperand, maxOperand - expectedAnswer)
    ], () => createProblem({ level: 1 }));

    reachedAnswers.push(problem.answer);
    assert.equal(problem.answer, expectedAnswer);
    assert.equal(problem.answer, problem.minuend - problem.subtrahend);
    assert.ok(problem.minuend >= minOperand && problem.minuend <= maxOperand);
    assert.ok(problem.subtrahend >= minOperand && problem.subtrahend <= problem.minuend);
  }

  assert.deepEqual(reachedAnswers, Array.from({ length: maxAnswer - minAnswer + 1 }, (_, index) => minAnswer + index));
});

test('createProblem demuestra elegibilidad completa de respuestas en nivel 2', () => {
  const { minAnswer, maxAnswer } = getAnswerRange(2);
  const { minOperand, maxOperand } = LEVEL_RULES[2];
  const reachedAnswers = [];

  for (let expectedAnswer = minAnswer; expectedAnswer <= maxAnswer; expectedAnswer += 1) {
    const problem = withMockedRandomSequence([
      randomValueForInclusiveRange(expectedAnswer, minAnswer, maxAnswer),
      randomValueForInclusiveRange(minOperand, minOperand, maxOperand - expectedAnswer)
    ], () => createProblem({ level: 2 }));

    reachedAnswers.push(problem.answer);
    assert.equal(problem.answer, expectedAnswer);
    assert.equal(problem.answer, problem.minuend - problem.subtrahend);
    assert.ok(problem.minuend >= minOperand && problem.minuend <= maxOperand);
    assert.ok(problem.subtrahend >= minOperand && problem.subtrahend <= problem.minuend);
  }

  assert.deepEqual(reachedAnswers, Array.from({ length: maxAnswer - minAnswer + 1 }, (_, index) => minAnswer + index));
});

test('createProblem preserva invariantes algebraicas por nivel', () => {
  for (const [level, { minOperand, maxOperand }] of Object.entries(LEVEL_RULES)) {
    for (let index = 0; index < 100; index += 1) {
      const problem = createProblem({ level: Number(level) });

      assert.equal(problem.answer, problem.minuend - problem.subtrahend);
      assert.ok(problem.answer >= 0);
      assert.ok(problem.subtrahend >= minOperand);
      assert.ok(problem.minuend <= maxOperand);
    }
  }
});

test('chooseAnswer evita repetir la respuesta anterior cuando hay alternativas', () => {
  const repeatedCandidateLevel1 = withMockedRandom(0.55, () => chooseAnswer({ level: 1, previousAnswer: 5 }));
  const repeatedCandidateLevel2 = withMockedRandom(0.06, () => chooseAnswer({ level: 2, previousAnswer: 5 }));

  assert.notEqual(repeatedCandidateLevel1, 5);
  assert.notEqual(repeatedCandidateLevel2, 5);
  assert.ok(repeatedCandidateLevel1 >= 0 && repeatedCandidateLevel1 <= 9);
  assert.ok(repeatedCandidateLevel2 >= 0 && repeatedCandidateLevel2 <= 89);
});

test('chooseAnswer reutiliza la unica respuesta disponible en un dominio unitario', () => {
  const originalRules = LEVEL_RULES[99];
  LEVEL_RULES[99] = { minOperand: 4, maxOperand: 4 };

  try {
    assert.equal(chooseAnswer({ level: 99, previousAnswer: 0 }), 0);
  } finally {
    if (originalRules) {
      LEVEL_RULES[99] = originalRules;
    } else {
      delete LEVEL_RULES[99];
    }
  }
});

test('createProblem no repite inmediatamente la respuesta correcta previa', () => {
  const problem = withMockedRandom(0.55, () => createProblem({ level: 1, previousAnswer: 5 }));

  assert.notEqual(problem.answer, 5);
  assert.equal(problem.answer, problem.minuend - problem.subtrahend);
});

test('getLevelForScore sube exactamente al llegar a 20 puntos', () => {
  assert.equal(getLevelForScore(LEVEL_UP_SCORE - 1), 1);
  assert.equal(getLevelForScore(LEVEL_UP_SCORE), 2);
  assert.equal(getLevelForScore(LEVEL_UP_SCORE + 5), 2);
});

test('createTurn incluye opciones unicas y la respuesta correcta', () => {
  const turn = createTurn({ level: 1, now: 1000, timeoutSeconds: 15 });

  assert.equal(turn.expiresAt, 16000);
  assert.equal(turn.choices.length, 4);
  assert.equal(new Set(turn.choices).size, 4);
  assert.ok(turn.choices.includes(turn.problem.answer));
});

test('createChoices no deja siempre la respuesta correcta en la primera posicion', () => {
  const choices = withMockedRandomSequence([0, 0, 0], () => createChoices(4));

  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.includes(4));
  assert.notEqual(choices[0], 4);
});

test('resolveTurnAnswer mantiene coherencia entre texto y callback', () => {
  const session = {
    status: 'active',
    turn: {
      id: 'turn-1',
      expiresAt: 5000,
      problem: { answer: 4 }
    }
  };

  assert.deepEqual(resolveTurnAnswer(session, { answer: '4', now: 1000 }), {
    kind: 'correct',
    answer: 4
  });
  assert.deepEqual(resolveTurnAnswer(session, { turnId: 'turn-1', answer: '4', now: 1000 }), {
    kind: 'correct',
    answer: 4
  });
  assert.deepEqual(resolveTurnAnswer(session, { turnId: 'turn-0', answer: '4', now: 1000 }), {
    kind: 'stale'
  });
});

test('resolveTurnAnswer reporta error y expiracion con estados canonicos', () => {
  const activeSession = {
    status: 'active',
    turn: {
      id: 'turn-1',
      expiresAt: 5000,
      problem: { answer: 4 }
    }
  };
  const endedSession = {
    status: 'expired',
    turn: {
      id: 'turn-1',
      expiresAt: 5000,
      problem: { answer: 4 }
    }
  };

  assert.deepEqual(resolveTurnAnswer(activeSession, { answer: '9', now: 1000 }), {
    kind: 'wrong',
    expectedAnswer: 4,
    receivedAnswer: 9
  });
  assert.deepEqual(resolveTurnAnswer(activeSession, { answer: '4', now: 5000 }), {
    kind: 'expired'
  });
  assert.deepEqual(resolveTurnAnswer(endedSession, { answer: '4', now: 1000 }), {
    kind: 'expired'
  });
});

test('mensajes del dominio reflejan el gameplay mejorado', () => {
  const turn = {
    problem: { prompt: 'Cuanto es 12 - 10?' }
  };

  assert.match(formatWelcomeMessage({ score: 0, level: 1, turn, timeoutSeconds: 15 }), /boton o escribiendo el numero/);
  assert.match(
    formatCorrectAnswerMessage({ score: 20, level: 2, turn, timeoutSeconds: 15, leveledUp: true }),
    /Subiste al nivel 2/
  );
  assert.match(formatExpiredTurnMessage({ score: 3 }), /Se acabo el tiempo/);
  assert.equal(formatInactiveTurnMessage(), 'Ese turno ya no esta vigente. Escribe /start para comenzar una nueva sesion.');
  assert.equal(formatNoSessionMessage(), 'No hay una sesion activa. Escribe /start para comenzar.');
  assert.equal(new Set(createChoices(4)).size, 4);
});
