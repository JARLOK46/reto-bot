const DEFAULT_MAX_EVENTS = 40;
const DEFAULT_MAX_ERRORS = 20;
const DEFAULT_MAX_HISTORY = 24;

function clampList(items, maxItems) {
  return items.slice(0, maxItems);
}

function cloneError(error) {
  if (!error) {
    return null;
  }

  return {
    code: error.code ?? null,
    message: error.message ?? String(error),
    retryable: error.retryable ?? null,
    at: error.at ?? new Date().toISOString()
  };
}

function createObservabilityStore(options = {}) {
  const now = options.now ?? (() => Date.now());
  const maxEvents = options.maxEvents ?? DEFAULT_MAX_EVENTS;
  const maxErrors = options.maxErrors ?? DEFAULT_MAX_ERRORS;
  const maxHistory = options.maxHistory ?? DEFAULT_MAX_HISTORY;

  const recentEvents = [];
  const recentErrors = [];
  const sessionHistory = [];
  const chats = new Map();

  function currentTimestamp() {
    return new Date(now()).toISOString();
  }

  function ensureChat(chatId) {
    const normalizedChatId = String(chatId);
    const existing = chats.get(normalizedChatId);

    if (existing) {
      return existing;
    }

    const created = {
      chatId: normalizedChatId,
      starts: 0,
      correctAnswers: 0,
      wrongAnswers: 0,
      expiredSessions: 0,
      completedSessions: 0,
      currentScore: 0,
      currentLevel: 1,
      status: 'idle',
      lastSeenAt: null,
      lastEvent: 'Sin actividad',
      lastSessionResult: null
    };

    chats.set(normalizedChatId, created);
    return created;
  }

  function addEvent(event) {
    recentEvents.unshift({
      at: currentTimestamp(),
      level: event.level ?? 'info',
      type: event.type ?? 'runtime',
      title: event.title ?? 'Evento',
      message: event.message ?? '',
      chatId: event.chatId != null ? String(event.chatId) : null,
      meta: event.meta ?? null
    });

    recentEvents.splice(maxEvents);
  }

  function addError(error) {
    const entry = {
      at: currentTimestamp(),
      scope: error.scope ?? 'runtime',
      code: error.code ?? null,
      message: error.message ?? 'Error desconocido',
      retryable: error.retryable ?? null,
      chatId: error.chatId != null ? String(error.chatId) : null
    };

    recentErrors.unshift(entry);
    recentErrors.splice(maxErrors);
    addEvent({
      level: 'error',
      type: 'error',
      title: error.title ?? 'Error registrado',
      message: entry.message,
      chatId: entry.chatId,
      meta: {
        code: entry.code,
        scope: entry.scope,
        retryable: entry.retryable
      }
    });
  }

  function addHistoryItem(item) {
    sessionHistory.unshift({
      at: currentTimestamp(),
      chatId: String(item.chatId),
      finalScore: item.finalScore ?? 0,
      level: item.level ?? 1,
      status: item.status ?? 'ended',
      startedAt: item.startedAt ?? null,
      endedAt: item.endedAt ?? currentTimestamp(),
      answeredCount: item.answeredCount ?? 0,
      reason: item.reason ?? null
    });

    sessionHistory.splice(maxHistory);
  }

  return {
    recordSessionStarted(session) {
      const chat = ensureChat(session.chatId);
      chat.starts += 1;
      chat.currentScore = session.score ?? 0;
      chat.currentLevel = session.level ?? 1;
      chat.status = session.status ?? 'active';
      chat.lastSeenAt = currentTimestamp();
      chat.lastEvent = 'Sesión iniciada';

      addEvent({
        type: 'session',
        title: 'Sesión iniciada',
        message: `El chat ${chat.chatId} comenzó una nueva partida.`,
        chatId: chat.chatId,
        meta: {
          score: chat.currentScore,
          level: chat.currentLevel
        }
      });
    },
    recordAnswerCorrect(session, options = {}) {
      const chat = ensureChat(session.chatId);
      chat.correctAnswers += 1;
      chat.currentScore = session.score ?? chat.currentScore;
      chat.currentLevel = session.level ?? chat.currentLevel;
      chat.status = session.status ?? 'active';
      chat.lastSeenAt = currentTimestamp();
      chat.lastEvent = options.leveledUp ? 'Respuesta correcta y subida de nivel' : 'Respuesta correcta';

      addEvent({
        type: 'answer',
        title: options.leveledUp ? 'Respuesta correcta con subida de nivel' : 'Respuesta correcta',
        message: `El chat ${chat.chatId} alcanzó ${chat.currentScore} puntos.`,
        chatId: chat.chatId,
        meta: {
          score: chat.currentScore,
          level: chat.currentLevel,
          leveledUp: Boolean(options.leveledUp)
        }
      });
    },
    recordAnswerWrong(session, options = {}) {
      const chat = ensureChat(session.chatId);
      chat.wrongAnswers += 1;
      chat.completedSessions += 1;
      chat.currentScore = options.finalScore ?? session?.score ?? chat.currentScore;
      chat.currentLevel = session?.level ?? chat.currentLevel;
      chat.status = 'ended';
      chat.lastSeenAt = currentTimestamp();
      chat.lastEvent = 'Sesión terminada por respuesta incorrecta';
      chat.lastSessionResult = 'incorrecta';

      addHistoryItem({
        chatId: chat.chatId,
        finalScore: chat.currentScore,
        level: chat.currentLevel,
        status: 'ended',
        startedAt: session?.startedAt ?? null,
        answeredCount: session?.answeredCount ?? 0,
        reason: 'Respuesta incorrecta'
      });

      addEvent({
        type: 'session',
        level: 'warning',
        title: 'Sesión finalizada por error',
        message: `El chat ${chat.chatId} cerró la partida con ${chat.currentScore} puntos.`,
        chatId: chat.chatId,
        meta: {
          expectedAnswer: options.expectedAnswer ?? null,
          finalScore: chat.currentScore
        }
      });
    },
    recordSessionExpired(session) {
      const chat = ensureChat(session.chatId);
      chat.expiredSessions += 1;
      chat.currentScore = session.score ?? chat.currentScore;
      chat.currentLevel = session.level ?? chat.currentLevel;
      chat.status = 'expired';
      chat.lastSeenAt = currentTimestamp();
      chat.lastEvent = 'Sesión expirada';
      chat.lastSessionResult = 'expirada';

      addHistoryItem({
        chatId: chat.chatId,
        finalScore: chat.currentScore,
        level: chat.currentLevel,
        status: 'expired',
        startedAt: session.startedAt ?? null,
        answeredCount: session.answeredCount ?? 0,
        reason: 'Tiempo agotado'
      });

      addEvent({
        type: 'session',
        level: 'warning',
        title: 'Sesión expirada',
        message: `El chat ${chat.chatId} agotó el tiempo del turno.`,
        chatId: chat.chatId,
        meta: {
          finalScore: chat.currentScore
        }
      });
    },
    recordBotError(error) {
      addError(error);
    },
    recordRuntimeEvent(event) {
      addEvent(event);
    },
    getSnapshot() {
      const visibleChats = Array.from(chats.values())
        .sort((left, right) => {
          const leftTime = left.lastSeenAt ? Date.parse(left.lastSeenAt) : 0;
          const rightTime = right.lastSeenAt ? Date.parse(right.lastSeenAt) : 0;
          return rightTime - leftTime;
        });

      const summary = visibleChats.reduce(
        (accumulator, chat) => {
          accumulator.totalChats += 1;
          accumulator.totalStarts += chat.starts;
          accumulator.totalCorrectAnswers += chat.correctAnswers;
          accumulator.totalWrongAnswers += chat.wrongAnswers;
          accumulator.totalExpiredSessions += chat.expiredSessions;
          accumulator.totalCompletedSessions += chat.completedSessions;
          return accumulator;
        },
        {
          totalChats: 0,
          totalStarts: 0,
          totalCorrectAnswers: 0,
          totalWrongAnswers: 0,
          totalExpiredSessions: 0,
          totalCompletedSessions: 0
        }
      );

      return {
        summary,
        recentEvents: clampList(recentEvents, maxEvents),
        recentErrors: clampList(recentErrors, maxErrors),
        sessionHistory: clampList(sessionHistory, maxHistory),
        chats: visibleChats,
        generatedAt: currentTimestamp()
      };
    },
    reset() {
      recentEvents.splice(0, recentEvents.length);
      recentErrors.splice(0, recentErrors.length);
      sessionHistory.splice(0, sessionHistory.length);
      chats.clear();
    },
    cloneError
  };
}

module.exports = {
  createObservabilityStore,
  cloneError
};
