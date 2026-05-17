const DEFAULT_SCORE_INCREMENT = 1;
const DEFAULT_TURN_TIMEOUT_SECONDS = 15;
const LEVEL_UP_SCORE = 20;

// Reglas mínimas por nivel.
const LEVEL_RULES = {
  1: { minOperand: 0, maxOperand: 9 },
  2: { minOperand: 10, maxOperand: 99 },
};

let turnSequence = 0;

// Devuelve un entero aleatorio inclusivo entre min y max.
function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Mezcla las opciones para que la respuesta correcta no aparezca siempre en la
// misma posición dentro de los botones de Telegram.
function shuffleArray(values) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBetween(0, index);
    const currentValue = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = currentValue;
  }

  return shuffled;
}

// Permite recibir Date o timestamp numérico y trabajar siempre con milisegundos.
function normalizeNow(now = Date.now()) {
  if (now instanceof Date) {
    return now.getTime();
  }

  return now;
}

// Obtiene la configuración de un nivel; si el nivel no existe, cae a nivel 1.
function getLevelRule(level) {
  return LEVEL_RULES[level] ?? LEVEL_RULES[1];
}

// Calcula el rango teórico de respuestas válidas para un nivel dado.
function getAnswerRange(level) {
  const { minOperand, maxOperand } = getLevelRule(level);

  return {
    minAnswer: 0,
    maxAnswer: maxOperand - minOperand,
  };
}

// Elige la respuesta correcta del próximo problema. Intenta evitar repetir de
// inmediato la respuesta previa para que el juego no se sienta artificial.
function chooseAnswer(options = {}) {
  const level = options.level ?? 1;
  const previousAnswer = options.previousAnswer;
  const { minAnswer, maxAnswer } = getAnswerRange(level);

  if (maxAnswer <= minAnswer) {
    return minAnswer;
  }

  if (
    !Number.isInteger(previousAnswer) ||
    previousAnswer < minAnswer ||
    previousAnswer > maxAnswer
  ) {
    return randomBetween(minAnswer, maxAnswer);
  }

  const candidate = randomBetween(minAnswer, maxAnswer - 1);

  return candidate >= previousAnswer ? candidate + 1 : candidate;
}

// Decide el nivel a partir del puntaje acumulado.
function getLevelForScore(score) {
  return score >= LEVEL_UP_SCORE ? 2 : 1;
}

// Crea una resta válida para el nivel indicado, garantizando que el resultado
// no sea negativo.
function createProblem(options = {}) {
  const level = options.level ?? 1;
  const { minOperand, maxOperand } = getLevelRule(level);
  const answer = chooseAnswer({
    level,
    previousAnswer: options.previousAnswer,
  });
  const subtrahend = randomBetween(minOperand, maxOperand - answer);
  const minuend = answer + subtrahend;

  return {
    minuend,
    subtrahend,
    answer,
    prompt: `Cuanto es ${minuend} - ${subtrahend}?`,
  };
}

// Construye 4 opciones únicas de respuesta, incluyendo obligatoriamente la correcta.
function createChoices(answer) {
  const choices = new Set([answer]);
  const candidates = [
    answer + 1,
    answer - 1,
    answer + 2,
    answer - 2,
    answer + 10,
    answer - 10,
    0,
    answer + 3,
    answer + 4,
  ];

  for (const candidate of candidates) {
    if (candidate >= 0) {
      choices.add(candidate);
    }

    if (choices.size === 4) {
      break;
    }
  }

  let fallback = answer + 5;

  while (choices.size < 4) {
    if (fallback >= 0) {
      choices.add(fallback);
    }

    fallback += 1;
  }

  return shuffleArray(Array.from(choices));
}

// Crea un turno completo con problema, opciones y fecha de vencimiento.
function createTurn(options = {}) {
  const level = options.level ?? 1;
  const timeoutSeconds = options.timeoutSeconds ?? DEFAULT_TURN_TIMEOUT_SECONDS;
  const now = normalizeNow(options.now);
  const problem = createProblem({
    level,
    previousAnswer: options.previousAnswer,
  });

  turnSequence += 1;

  return {
    id: `turn-${now}-${turnSequence}`,
    problem,
    choices: createChoices(problem.answer),
    expiresAt: now + timeoutSeconds * 1000,
    timeoutId: null,
  };
}

// Intenta convertir lo escrito por el usuario en un entero. Si no parece un
// número válido, devuelve null.
function parseAnswer(rawValue) {
  const normalized = String(rawValue ?? "").trim();

  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

// Resuelve si la respuesta pertenece al turno correcto, si aún está vigente y
// si coincide con la respuesta esperada.
function resolveTurnAnswer(session, input = {}) {
  if (!session?.turn) {
    return { kind: "missing" };
  }

  if (input.turnId && input.turnId !== session.turn.id) {
    return { kind: "stale" };
  }

  if (session.status !== "active") {
    return { kind: "expired" };
  }

  if (normalizeNow(input.now) >= session.turn.expiresAt) {
    return { kind: "expired" };
  }

  const parsedAnswer = parseAnswer(input.answer);

  if (parsedAnswer === session.turn.problem.answer) {
    return { kind: "correct", answer: parsedAnswer };
  }

  return {
    kind: "wrong",
    expectedAnswer: session.turn.problem.answer,
    receivedAnswer: parsedAnswer,
  };
}

// Plantilla base de mensajes para no repetir estructura en bienvenida y acierto.
function formatTurnMessage({
  score,
  level,
  turn,
  timeoutSeconds,
  introLines = [],
}) {
  const intro = introLines.filter(Boolean).join("\n");
  const body = [
    `Nivel ${level} | Puntaje: ${score}`,
    turn.problem.prompt,
    `Tienes ${timeoutSeconds} segundos. Puedes responder con un boton o escribiendo el numero.`,
  ].join("\n");

  return intro ? `${intro}\n\n${body}` : body;
}

function formatWelcomeMessage({ score, level, turn, timeoutSeconds }) {
  return formatTurnMessage({
    score,
    level,
    turn,
    timeoutSeconds,
    introLines: ["Nueva sesion de restas. Vamos paso a paso."],
  });
}

function formatCorrectAnswerMessage({
  score,
  level,
  turn,
  timeoutSeconds,
  leveledUp,
}) {
  return formatTurnMessage({
    score,
    level,
    turn,
    timeoutSeconds,
    introLines: [
      "Bien hecho, esa respuesta es correcta.",
      leveledUp
        ? "Subiste al nivel 2. Desde ahora las restas usan numeros de dos cifras."
        : null,
    ],
  });
}

function formatWrongAnswerMessage({ score, expectedAnswer }) {
  return `Respuesta incorrecta. La respuesta correcta era ${expectedAnswer}. La sesion termino con ${score} puntos. Escribe /start para intentarlo otra vez.`;
}

function formatExpiredTurnMessage({ score }) {
  return `Se acabo el tiempo de este turno. La sesion termino con ${score} puntos. Escribe /start para jugar otra vez.`;
}

function formatInactiveTurnMessage() {
  return "Ese turno ya no esta vigente. Escribe /start para comenzar una nueva sesion.";
}

function formatNoSessionMessage() {
  return "No hay una sesion activa. Escribe /start para comenzar.";
}

// Serializa la respuesta de un botón para que Telegram pueda devolverla después.
function createAnswerCallbackData(turnId, answer) {
  return `answer:${turnId}:${answer}`;
}

// Interpreta el payload serializado de un botón inline.
function parseAnswerCallbackData(data) {
  const normalized = String(data ?? "");
  const match = /^answer:([^:]+):(-?\d+)$/.exec(normalized);

  if (!match) {
    return null;
  }

  return {
    turnId: match[1],
    answer: Number.parseInt(match[2], 10),
  };
}

module.exports = {
  DEFAULT_SCORE_INCREMENT,
  DEFAULT_TURN_TIMEOUT_SECONDS,
  LEVEL_RULES,
  LEVEL_UP_SCORE,
  chooseAnswer,
  createAnswerCallbackData,
  createChoices,
  createProblem,
  createTurn,
  formatCorrectAnswerMessage,
  formatExpiredTurnMessage,
  formatInactiveTurnMessage,
  formatNoSessionMessage,
  formatWelcomeMessage,
  formatWrongAnswerMessage,
  getAnswerRange,
  getLevelForScore,
  parseAnswerCallbackData,
  resolveTurnAnswer,
};
