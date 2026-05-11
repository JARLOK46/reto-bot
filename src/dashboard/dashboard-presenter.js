function formatDateTime(timestamp) {
  if (!timestamp) {
    return 'n/a';
  }

  return new Date(timestamp).toISOString();
}

function formatRemainingTime(remainingMs, isExpired) {
  if (isExpired) {
    return 'Vencido';
  }

  if (!Number.isFinite(remainingMs)) {
    return 'Sin cronometro';
  }

  const seconds = Math.max(0, Math.ceil(remainingMs / 1000));
  return `${seconds}s restantes`;
}

function getSessionPriority(session) {
  const priorities = {
    active: 0,
    expired: 1,
    ended: 2
  };

  return priorities[session.status] ?? 3;
}

function toSessionViewModel(session) {
  const turn = session.turn
    ? {
        id: session.turn.id,
        prompt: session.turn.prompt,
        choices: session.turn.choices,
        expiresAtLabel: formatDateTime(session.turn.expiresAt),
        remainingLabel: formatRemainingTime(session.turn.remainingMs, session.turn.isExpired),
        isExpired: session.turn.isExpired
      }
    : null;

  return {
    chatId: String(session.chatId),
    status: session.status,
    statusLabel: session.status === 'active' ? 'Activa' : session.status === 'expired' ? 'Expirada' : 'Terminada',
    score: session.score,
    level: session.level,
    scoreIncrement: session.scoreIncrement,
    ephemeralLabel: 'Efimero',
    turn
  };
}

function createDashboardPresenter() {
  return {
    present(snapshot) {
      const sessions = [...(snapshot.sessions ?? [])]
        .sort((left, right) => {
          const priorityDiff = getSessionPriority(left) - getSessionPriority(right);

          if (priorityDiff !== 0) {
            return priorityDiff;
          }

          const leftRemaining = left.turn?.remainingMs ?? Number.MAX_SAFE_INTEGER;
          const rightRemaining = right.turn?.remainingMs ?? Number.MAX_SAFE_INTEGER;

          return leftRemaining - rightRemaining;
        })
        .map(toSessionViewModel);

      const primarySession = sessions.find((session) => session.status === 'active') ?? null;

      return {
        title: 'Dashboard HTML del bot',
        refreshSeconds: 10,
        notice: 'Estado en memoria del proceso actual',
        subtitle:
          'Vista read-only del runtime actual. No hay historico persistente ni tendencias entre reinicios.',
        processMeta: {
          startedAt: formatDateTime(snapshot.processStartedAt),
          generatedAt: formatDateTime(snapshot.generatedAt),
          uptime: `${snapshot.uptimeSeconds}s`,
          sessionCount: snapshot.counts?.total ?? 0,
          activeCount: snapshot.counts?.active ?? 0,
          endedCount: snapshot.counts?.ended ?? 0,
          expiredCount: snapshot.counts?.expired ?? 0
        },
        config: {
          turnTimeoutSeconds: snapshot.config?.turnTimeoutSeconds ?? 'n/a',
          scoreIncrement: snapshot.config?.scoreIncrement ?? 'n/a'
        },
        primarySession,
        sessions,
        emptyState: {
          title: 'No hay sesiones en memoria',
          body: 'Este MVP solo refleja sesiones efimeras del proceso actual. Si el bot reinicio, el estado anterior pudo perderse.'
        }
      };
    }
  };
}

module.exports = {
  createDashboardPresenter,
  formatDateTime,
  formatRemainingTime
};
