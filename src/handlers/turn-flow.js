const { Markup } = require('telegraf');

const {
  DEFAULT_SCORE_INCREMENT,
  DEFAULT_TURN_TIMEOUT_SECONDS,
  createAnswerCallbackData,
  createTurn,
  formatCorrectAnswerMessage,
  formatExpiredTurnMessage,
  formatInactiveTurnMessage,
  formatNoSessionMessage,
  formatWelcomeMessage,
  formatWrongAnswerMessage,
  getLevelForScore,
  parseAnswerCallbackData,
  resolveTurnAnswer
} = require('../game/subtraction-game');

function createTurnKeyboard(turn) {
  return Markup.inlineKeyboard(
    turn.choices.map((choice) => [Markup.button.callback(String(choice), createAnswerCallbackData(turn.id, choice))])
  );
}

function createReplyOptions(turn) {
  return {
    reply_markup: createTurnKeyboard(turn).reply_markup
  };
}

function isIgnorableCallbackQueryError(error) {
  const description = error?.response?.description ?? error?.description ?? '';

  return /query is too old|query ID is invalid|response timeout expired/i.test(description);
}

function createTurnFlow({ sessionStore, gameConfig = {} }) {
  if (!sessionStore) {
    throw new Error('sessionStore is required.');
  }

  const scoreIncrement = gameConfig.scoreIncrement ?? DEFAULT_SCORE_INCREMENT;
  const turnTimeoutSeconds = gameConfig.turnTimeoutSeconds ?? DEFAULT_TURN_TIMEOUT_SECONDS;
  const turnTimeoutMs = turnTimeoutSeconds * 1000;

  async function safeAnswerCallbackQuery(ctx, message) {
    try {
      await ctx.answerCbQuery(message);
    } catch (error) {
      if (isIgnorableCallbackQueryError(error)) {
        return;
      }

      throw error;
    }
  }

  function scheduleTimeout(ctx, chatId, turnId) {
    sessionStore.scheduleTurnTimeout(chatId, turnId, turnTimeoutMs, async () => {
      const endedSession = sessionStore.endSession(chatId, { status: 'expired' });

      if (!endedSession) {
        return;
      }

      await ctx.telegram.sendMessage(chatId, formatExpiredTurnMessage({ score: endedSession.score }));
    });
  }

  function createActiveSession(chatId, score) {
    const level = getLevelForScore(score);
    const turn = createTurn({
      level,
      timeoutSeconds: turnTimeoutSeconds
    });

    return sessionStore.set(chatId, {
      chatId,
      score,
      scoreIncrement,
      level,
      status: 'active',
      turn
    });
  }

  async function startSession(ctx) {
    const chatId = ctx.chat.id;
    const session = createActiveSession(chatId, 0);

    scheduleTimeout(ctx, chatId, session.turn.id);

    const activeSession = sessionStore.get(chatId);

    await ctx.reply(
      formatWelcomeMessage({
        score: activeSession.score,
        level: activeSession.level,
        turn: activeSession.turn,
        timeoutSeconds: turnTimeoutSeconds
      }),
      createReplyOptions(activeSession.turn)
    );
  }

  async function processResolvedAnswer(ctx, input) {
    const chatId = ctx.chat.id;
    const session = sessionStore.get(chatId);
    const result = resolveTurnAnswer(session, {
      turnId: input.turnId,
      answer: input.answer,
      now: Date.now()
    });

    if (result.kind === 'missing') {
      if (input.source === 'callback') {
        await safeAnswerCallbackQuery(ctx, 'Ya no hay una sesion activa.');
      } else {
        await ctx.reply(formatNoSessionMessage());
      }

      return result;
    }

    if (result.kind === 'stale' || result.kind === 'expired') {
      if (input.source === 'callback') {
        await safeAnswerCallbackQuery(ctx, 'Ese turno ya no esta vigente.');
      } else {
        await ctx.reply(formatInactiveTurnMessage());
      }

      return result;
    }

    if (result.kind === 'wrong') {
      const endedSession = sessionStore.endSession(chatId, { status: 'ended' });

      if (input.source === 'callback') {
        await safeAnswerCallbackQuery(ctx, 'Respuesta incorrecta.');
      }

      await ctx.reply(
        formatWrongAnswerMessage({
          score: endedSession?.score ?? session?.score ?? 0,
          expectedAnswer: result.expectedAnswer
        })
      );

      return result;
    }

    const nextScore = session.score + (session.scoreIncrement ?? scoreIncrement);
    const nextLevel = getLevelForScore(nextScore);
    const leveledUp = nextLevel > session.level;
    const previousAnswer = session.turn.problem.answer;
    const nextTurn = createTurn({
      level: nextLevel,
      timeoutSeconds: turnTimeoutSeconds,
      previousAnswer
    });

    sessionStore.set(chatId, {
      ...session,
      score: nextScore,
      level: nextLevel,
      status: 'active',
      turn: nextTurn
    });

    scheduleTimeout(ctx, chatId, nextTurn.id);

    if (input.source === 'callback') {
      await safeAnswerCallbackQuery(ctx, 'Respuesta correcta.');
    }

    const activeSession = sessionStore.get(chatId);

    await ctx.reply(
      formatCorrectAnswerMessage({
        score: activeSession.score,
        level: activeSession.level,
        turn: activeSession.turn,
        timeoutSeconds: turnTimeoutSeconds,
        leveledUp
      }),
      createReplyOptions(activeSession.turn)
    );

    return result;
  }

  async function processTextAnswer(ctx) {
    const text = ctx.message?.text ?? '';

    if (text.trim().startsWith('/start')) {
      return undefined;
    }

    return processResolvedAnswer(ctx, {
      source: 'text',
      answer: text
    });
  }

  async function processCallbackAnswer(ctx) {
    const payload = parseAnswerCallbackData(ctx.callbackQuery?.data);

    if (!payload) {
      await safeAnswerCallbackQuery(ctx, 'No pude interpretar esa respuesta.');
      return { kind: 'missing' };
    }

    return processResolvedAnswer(ctx, {
      source: 'callback',
      turnId: payload.turnId,
      answer: String(payload.answer)
    });
  }

  return {
    processCallbackAnswer,
    processTextAnswer,
    startSession
  };
}

module.exports = {
  createTurnFlow,
  createTurnKeyboard
};
