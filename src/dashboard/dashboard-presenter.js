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

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function sumValues(items) {
  return items.reduce((total, item) => total + (item.value ?? 0), 0);
}

function buildTrendPoints(snapshot) {
  const historyScores = (snapshot.observability?.sessionHistory ?? [])
    .slice(0, 6)
    .reverse()
    .map((item) => item.finalScore ?? 0);
  const activeScores = (snapshot.sessions?.sessions ?? [])
    .filter((session) => session.status === 'active')
    .slice(0, 2)
    .map((session) => session.score ?? 0);

  const rawPoints = [...historyScores, ...activeScores];
  const normalized = rawPoints.length ? rawPoints : [0, 1, 0, 2, 1, 3, 2];
  const maxValue = Math.max(...normalized, 1);

  return normalized.map((value, index) => ({
    label: `P${index + 1}`,
    value,
    percent: clampPercent((value / maxValue) * 100)
  }));
}

function buildFilterGroups(snapshot, bot) {
  const counts = snapshot.sessions?.counts ?? {};
  const summary = snapshot.observability?.summary ?? {};

  return [
    {
      title: 'Estado del bot',
      items: [
        { label: bot.statusLabel, value: bot.mode },
        { label: 'Intentos de arranque', value: String(bot.launchAttempts) },
        { label: 'Última conexión', value: bot.connectedAt }
      ]
    },
    {
      title: 'Sesiones',
      items: [
        { label: 'Activas', value: String(counts.active ?? 0) },
        { label: 'Terminadas', value: String(counts.ended ?? 0) },
        { label: 'Expiradas', value: String(counts.expired ?? 0) }
      ]
    },
    {
      title: 'Actividad',
      items: [
        { label: 'Chats visibles', value: String(summary.totalChats ?? 0) },
        { label: 'Aciertos', value: String(summary.totalCorrectAnswers ?? 0) },
        { label: 'Errores de usuario', value: String(summary.totalWrongAnswers ?? 0) }
      ]
    },
    {
      title: 'Ventana actual',
      items: [
        { label: 'Uptime', value: bot.uptime },
        { label: 'Eventos recientes', value: String(snapshot.observability?.recentEvents?.length ?? 0) },
        { label: 'Errores recientes', value: String(snapshot.observability?.recentErrors?.length ?? 0) }
      ]
    }
  ];
}

function buildSessionBreakdown(snapshot) {
  const counts = snapshot.sessions?.counts ?? {};
  const items = [
    { label: 'Activas', value: counts.active ?? 0, color: 'primary' },
    { label: 'Terminadas', value: counts.ended ?? 0, color: 'cyan' },
    { label: 'Expiradas', value: counts.expired ?? 0, color: 'accent' }
  ];
  const total = Math.max(1, sumValues(items));

  return items.map((item) => ({
    ...item,
    percent: clampPercent((item.value / total) * 100)
  }));
}

function buildActivityBars(summary, counts, recentErrors, recentEvents) {
  const items = [
    { label: 'Chats', value: summary.totalChats ?? 0 },
    { label: 'Inicios', value: summary.totalStarts ?? 0 },
    { label: 'Aciertos', value: summary.totalCorrectAnswers ?? 0 },
    { label: 'Fallos', value: summary.totalWrongAnswers ?? 0 },
    { label: 'Activas', value: counts.active ?? 0 },
    { label: 'Eventos', value: recentEvents.length ?? 0 },
    { label: 'Errores', value: recentErrors.length ?? 0 }
  ];
  const maxValue = Math.max(1, ...items.map((item) => item.value));

  return items.map((item) => ({
    ...item,
    percent: clampPercent((item.value / maxValue) * 100)
  }));
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
          wrongAnswers: chat.wrongAnswers,
          lastEvent: chat.lastEvent,
          lastSeenAt: formatDateTime(chat.lastSeenAt)
        }));

      const topChats = [...recentChats]
        .sort((left, right) => (right.currentScore + right.correctAnswers) - (left.currentScore + left.correctAnswers))
        .slice(0, 5)
        .map((chat, index) => ({
          ...chat,
          rank: index + 1,
          avatarLabel: chat.chatId.slice(-2)
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

      const bot = {
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
      };

      const summary = snapshot.observability?.summary ?? {};
      const counts = snapshot.sessions?.counts ?? {};
      const healthyRuns = Math.max(1, (summary.totalCompletedSessions ?? 0) + (summary.totalExpiredSessions ?? 0) + (counts.active ?? 0));
      const completionRate = clampPercent(((summary.totalCompletedSessions ?? 0) / healthyRuns) * 100);
      const continuityRate = clampPercent((((summary.totalCorrectAnswers ?? 0) + 1) / ((summary.totalCorrectAnswers ?? 0) + (summary.totalWrongAnswers ?? 0) + 1)) * 100);
      const stabilityRate = clampPercent(((healthyRuns - (snapshot.observability?.recentErrors?.length ?? 0)) / healthyRuns) * 100);

      return {
        title: 'Centro de control del bot',
        refreshSeconds: 15,
        generatedAt: formatDateTime(snapshot.generatedAt),
        hero: {
          eyebrow: 'Supervisión operativa',
          title: 'Vista general de sesiones y salud del bot',
          subtitle: 'Una vista priorizada para profesores y administradores internos. Los filtros se alinean con el contenido visible para detectar rápido actividad, errores y rendimiento del proceso actual.'
        },
        bot,
        filters: buildFilterGroups(snapshot, bot),
        metrics: {
          activeSessions: counts.active ?? 0,
          trackedChats: summary.totalChats ?? 0,
          recentHistory: snapshot.observability?.sessionHistory?.length ?? 0,
          recentErrors: snapshot.observability?.recentErrors?.length ?? 0
        },
        trend: {
          title: 'Ritmo de sesiones',
          caption: 'Tendencia del proceso actual',
          points: buildTrendPoints(snapshot)
        },
        sessionBreakdown: buildSessionBreakdown(snapshot),
        activityBars: buildActivityBars(summary, counts, recentErrors, recentEvents),
        operationalKpis: [
          {
            label: 'Activas',
            value: counts.active ?? 0,
            detail: 'Sesiones vivas ahora',
            tone: 'primary'
          },
          {
            label: 'Chats visibles',
            value: summary.totalChats ?? 0,
            detail: 'Con interacción registrada',
            tone: 'cyan'
          },
          {
            label: 'Errores recientes',
            value: snapshot.observability?.recentErrors?.length ?? 0,
            detail: 'Incidentes del proceso',
            tone: 'accent'
          },
          {
            label: 'Eventos recientes',
            value: recentEvents.length,
            detail: 'Actividad visible',
            tone: 'neutral'
          }
        ],
        runtimeTargets: [
          {
            label: 'Continuidad del juego',
            value: `${continuityRate}%`,
            progress: continuityRate
          },
          {
            label: 'Cierres controlados',
            value: `${completionRate}%`,
            progress: completionRate
          },
          {
            label: 'Estabilidad del runtime',
            value: `${stabilityRate}%`,
            progress: stabilityRate
          }
        ],
        processStats: [
          {
            label: 'Inicios',
            ratio: `${summary.totalStarts ?? 0}:${summary.totalChats ?? 0}`,
            value: 'Sesiones por chat'
          },
          {
            label: 'Aciertos',
            ratio: `${summary.totalCorrectAnswers ?? 0}:${summary.totalWrongAnswers ?? 0}`,
            value: 'Correctas vs incorrectas'
          },
          {
            label: 'Activas',
            ratio: `${counts.active ?? 0}:${counts.ended ?? 0}`,
            value: 'Vivas vs terminadas'
          },
          {
            label: 'Tiempo',
            ratio: bot.uptime,
            value: 'Uptime del proceso'
          },
          {
            label: 'Eventos',
            ratio: `${recentEvents.length}:${recentErrors.length}`,
            value: 'Actividad vs incidentes'
          },
          {
            label: 'Webhook / Polling',
            ratio: bot.mode,
            value: bot.statusLabel
          }
        ],
        notes: {
          visibility: 'Los datos mostrados pertenecen al proceso actual. No existe persistencia histórica entre reinicios.',
          audience: 'Diseñado para supervisión interna de profesores y administradores.'
        },
        activeSessions,
        recentChats,
        topChats,
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
