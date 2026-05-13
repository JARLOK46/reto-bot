function formatDateTime(timestamp) {
  if (!timestamp) {
    return 'n/a';
  }

  return new Date(timestamp).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'medium'
  });
}

function formatRelativeSeconds(seconds) {
  if (!Number.isFinite(seconds)) {
    return 'n/a';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function formatSessionStatus(status) {
  return status === 'active'
    ? 'Activa'
    : status === 'expired'
      ? 'Expirada'
      : status === 'ended'
        ? 'Terminada'
        : 'Sin estado';
}

function formatBotStatus(status) {
  return status === 'connected'
    ? 'Conectado'
    : status === 'retrying'
      ? 'Reintentando'
      : status === 'connecting'
        ? 'Conectando'
        : status === 'failed'
          ? 'Falló'
          : 'En espera';
}

function formatTurnRemaining(turn) {
  if (!turn) {
    return 'Sin turno';
  }

  if (turn.isExpired) {
    return 'Vencido';
  }

  const seconds = Math.max(0, Math.ceil((turn.remainingMs ?? 0) / 1000));
  return `${seconds}s`; 
}

function createDashboardPresenter() {
  return {
    present(snapshot) {
      const activeSessions = [...(snapshot.sessions?.sessions ?? [])]
        .filter((session) => session.status === 'active')
        .sort((left, right) => (left.turn?.remainingMs ?? Number.MAX_SAFE_INTEGER) - (right.turn?.remainingMs ?? Number.MAX_SAFE_INTEGER))
        .map((session) => ({
          chatId: String(session.chatId),
          score: session.score,
          level: session.level,
          statusLabel: formatSessionStatus(session.status),
          prompt: session.turn?.prompt ?? 'Sin turno',
          remainingLabel: formatTurnRemaining(session.turn),
          startedAt: formatDateTime(session.startedAt),
          answeredCount: session.answeredCount ?? 0
        }));

      const recentChats = [...(snapshot.observability?.chats ?? [])]
        .slice(0, 8)
        .map((chat) => ({
          chatId: chat.chatId,
          statusLabel: formatSessionStatus(chat.status),
          currentScore: chat.currentScore,
          currentLevel: chat.currentLevel,
          starts: chat.starts,
          correctAnswers: chat.correctAnswers,
          lastEvent: chat.lastEvent,
          lastSeenAt: formatDateTime(chat.lastSeenAt)
        }));

      const recentErrors = [...(snapshot.observability?.recentErrors ?? [])].slice(0, 6).map((error) => ({
        ...error,
        atLabel: formatDateTime(error.at)
      }));

      const recentEvents = [...(snapshot.observability?.recentEvents ?? [])].slice(0, 8).map((event) => ({
        ...event,
        atLabel: formatDateTime(event.at)
      }));

      const history = [...(snapshot.observability?.sessionHistory ?? [])].slice(0, 8).map((item) => ({
        ...item,
        statusLabel: formatSessionStatus(item.status),
        startedAtLabel: formatDateTime(item.startedAt),
        endedAtLabel: formatDateTime(item.endedAt)
      }));

      return {
        title: 'Centro de control del bot',
        refreshSeconds: 15,
        generatedAt: formatDateTime(snapshot.generatedAt),
        bot: {
          mode: snapshot.telegram?.mode ?? 'unknown',
          statusLabel: formatBotStatus(snapshot.telegram?.status),
          status: snapshot.telegram?.status ?? 'idle',
          uptime: formatRelativeSeconds(snapshot.sessions?.uptimeSeconds ?? 0),
          connectedAt: formatDateTime(snapshot.telegram?.connectedAt),
          launchAttempts: snapshot.telegram?.launchAttempts ?? 0,
          lastError: snapshot.telegram?.lastError
            ? {
                ...snapshot.telegram.lastError,
                atLabel: formatDateTime(snapshot.telegram.lastError.at)
              }
            : null
        },
        metrics: {
          activeSessions: snapshot.sessions?.counts?.active ?? 0,
          trackedChats: snapshot.observability?.summary?.totalChats ?? 0,
          recentHistory: snapshot.observability?.sessionHistory?.length ?? 0,
          recentErrors: snapshot.observability?.recentErrors?.length ?? 0
        },
        notes: {
          visibility: 'Los datos mostrados pertenecen al proceso actual. No existe persistencia histórica entre reinicios.',
          audience: 'Diseñado para supervisión interna de profesores y administradores.'
        },
        activeSessions,
        recentChats,
        recentErrors,
        recentEvents,
        history
      };
    }
  };
}

module.exports = {
  createDashboardPresenter,
  formatDateTime,
  formatRelativeSeconds
};
