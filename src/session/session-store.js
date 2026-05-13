function createSessionStore(options = {}) {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
  const sessions = new Map();

  function normalizeTimestamp(value) {
    if (value instanceof Date) {
      return value.getTime();
    }

    return value ?? Date.now();
  }

  function toSerializableTurn(turn, now) {
    if (!turn) {
      return null;
    }

    const remainingMs = Math.max(0, turn.expiresAt - now);

    return {
      id: turn.id,
      prompt: turn.problem?.prompt ?? null,
      choices: Array.isArray(turn.choices) ? [...turn.choices] : [],
      expiresAt: turn.expiresAt,
      remainingMs,
      isExpired: remainingMs === 0
    };
  }

  function toSerializableSession(session, now) {
    return {
      chatId: session.chatId,
      status: session.status,
      score: session.score,
      level: session.level,
      startedAt: session.startedAt ?? null,
      answeredCount: session.answeredCount ?? 0,
      scoreIncrement: session.scoreIncrement,
      turn: toSerializableTurn(session.turn, now)
    };
  }

  function countSessionsByStatus(snapshotSessions) {
    return snapshotSessions.reduce(
      (counts, session) => {
        counts.total += 1;

        if (session.status === 'active') {
          counts.active += 1;
        }

        if (session.status === 'ended') {
          counts.ended += 1;
        }

        if (session.status === 'expired') {
          counts.expired += 1;
        }

        return counts;
      },
      {
        total: 0,
        active: 0,
        ended: 0,
        expired: 0
      }
    );
  }

  function clearSessionTimeout(session) {
    if (!session?.turn?.timeoutId) {
      return;
    }

    clearTimeoutFn(session.turn.timeoutId);
    session.turn.timeoutId = null;
  }

  return {
    get(chatId) {
      return sessions.get(chatId);
    },
    set(chatId, session) {
      const previousSession = sessions.get(chatId);

      if (previousSession && previousSession !== session) {
        clearSessionTimeout(previousSession);
      }

      sessions.set(chatId, session);
      return session;
    },
    scheduleTurnTimeout(chatId, turnId, timeoutMs, onExpire) {
      const session = sessions.get(chatId);

      if (!session || session.turn?.id !== turnId) {
        return undefined;
      }

      clearSessionTimeout(session);

      const timeoutId = setTimeoutFn(() => {
        const currentSession = sessions.get(chatId);

        if (!currentSession || currentSession.status !== 'active' || currentSession.turn?.id !== turnId) {
          return;
        }

        currentSession.turn.timeoutId = null;
        onExpire?.({ chatId, turnId, session: currentSession });
      }, timeoutMs);

      const nextSession = {
        ...session,
        turn: {
          ...session.turn,
          timeoutId
        }
      };

      sessions.set(chatId, nextSession);
      return nextSession;
    },
    clearTurnTimeout(chatId) {
      const session = sessions.get(chatId);

      if (!session) {
        return undefined;
      }

      clearSessionTimeout(session);
      return session;
    },
    endSession(chatId, updates = {}) {
      const session = sessions.get(chatId);

      if (!session) {
        return undefined;
      }

      clearSessionTimeout(session);

      const endedSession = {
        ...session,
        ...updates,
        status: updates.status ?? 'ended',
        turn: session.turn
          ? {
              ...session.turn,
              timeoutId: null
            }
          : null
      };

      sessions.set(chatId, endedSession);
      return endedSession;
    },
    delete(chatId) {
      const session = sessions.get(chatId);
      clearSessionTimeout(session);
      return sessions.delete(chatId);
    },
    listSessions(options = {}) {
      const now = normalizeTimestamp(options.now);

      return Array.from(sessions.values(), (session) => toSerializableSession(session, now));
    },
    getSnapshot(options = {}) {
      const now = normalizeTimestamp(options.now);
      const processStartedAt = normalizeTimestamp(options.processStartedAt);
      const snapshotSessions = this.listSessions({ now });
      const counts = countSessionsByStatus(snapshotSessions);

      return {
        processStartedAt,
        generatedAt: now,
        uptimeSeconds: Math.max(0, Math.floor((now - processStartedAt) / 1000)),
        config: {
          turnTimeoutSeconds: options.gameConfig?.turnTimeoutSeconds ?? null,
          scoreIncrement: options.gameConfig?.scoreIncrement ?? null
        },
        counts,
        sessionCount: counts.total,
        activeCount: counts.active,
        endedCount: counts.ended,
        expiredCount: counts.expired,
        emptyState: {
          hasSessions: counts.total > 0,
          message:
            counts.total > 0
              ? 'Snapshot en memoria del proceso actual.'
              : 'No hay sesiones activas en este proceso. El MVP solo muestra memoria efimera disponible ahora y el estado previo pudo perderse si el proceso reinicio.'
        },
        sessions: snapshotSessions
      };
    },
    reset() {
      for (const session of sessions.values()) {
        clearSessionTimeout(session);
      }

      sessions.clear();
    }
  };
}

module.exports = {
  createSessionStore
};
