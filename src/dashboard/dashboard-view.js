function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMetric(label, value, accent = '') {
  return `
    <article class="metric ${accent}">
      <span class="metric-label">${escapeHtml(label)}</span>
      <strong class="metric-value">${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderPrimarySession(primarySession) {
  if (!primarySession) {
    return `
      <section class="panel signature-panel empty-panel">
        <div>
          <p class="eyebrow">Turno activo</p>
          <h2>No hay turno activo ahora</h2>
          <p>El dashboard no inventa actividad. Si solo quedan sesiones terminadas o expiradas, este es el ultimo snapshot veraz disponible.</p>
        </div>
      </section>
    `;
  }

  const choices = primarySession.turn?.choices?.map((choice) => `<li>${escapeHtml(choice)}</li>`).join('') ?? '';

  return `
    <section class="panel signature-panel">
      <div class="signature-header">
        <div>
          <p class="eyebrow">Turno activo</p>
          <h2>${escapeHtml(primarySession.turn?.prompt ?? 'Sin turno')}</h2>
        </div>
        <span class="badge badge-ephemeral">${escapeHtml(primarySession.ephemeralLabel)}</span>
      </div>
      <div class="signature-grid">
        <div>
          <span class="label">Chat</span>
          <strong>${escapeHtml(primarySession.chatId)}</strong>
        </div>
        <div>
          <span class="label">Estado</span>
          <strong>${escapeHtml(primarySession.statusLabel)}</strong>
        </div>
        <div>
          <span class="label">Nivel</span>
          <strong>${escapeHtml(primarySession.level)}</strong>
        </div>
        <div>
          <span class="label">Puntaje</span>
          <strong>${escapeHtml(primarySession.score)}</strong>
        </div>
        <div class="timer-block">
          <span class="label">Cronometro</span>
          <strong>${escapeHtml(primarySession.turn?.remainingLabel ?? 'Sin turno')}</strong>
        </div>
      </div>
      <div>
        <span class="label">Opciones visibles</span>
        <ul class="choice-list">${choices}</ul>
      </div>
    </section>
  `;
}

function renderSessionsTable(sessions, emptyState) {
  if (sessions.length === 0) {
    return `
      <section class="panel empty-panel">
        <p class="eyebrow">Sesiones</p>
        <h2>${escapeHtml(emptyState?.title ?? 'No hay sesiones en memoria')}</h2>
        <p>${escapeHtml(emptyState?.body ?? 'El MVP no ofrece historico persistente ni analytics acumulado. Solo ves lo que vive en este proceso ahora mismo.')}</p>
      </section>
    `;
  }

  const rows = sessions
    .map(
      (session) => `
        <tr>
          <td>${escapeHtml(session.chatId)}</td>
          <td><span class="badge ${session.status === 'active' ? 'badge-active' : 'badge-muted'}">${escapeHtml(session.statusLabel)}</span></td>
          <td>${escapeHtml(session.score)}</td>
          <td>${escapeHtml(session.level)}</td>
          <td>${escapeHtml(session.turn?.prompt ?? 'Sin turno')}</td>
          <td>${escapeHtml(session.turn?.remainingLabel ?? 'Sin cronometro')}</td>
        </tr>
      `
    )
    .join('');

  return `
    <section class="panel">
      <div class="panel-heading">
        <div>
          <p class="eyebrow">Sesiones visibles</p>
          <h2>Snapshot operativo</h2>
        </div>
        <span class="badge badge-ephemeral">Solo lectura</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Chat</th>
              <th>Estado</th>
              <th>Puntaje</th>
              <th>Nivel</th>
              <th>Turno</th>
              <th>Tiempo</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderDashboardPage(viewModel) {
  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="refresh" content="${escapeHtml(viewModel.refreshSeconds)}" />
    <title>${escapeHtml(viewModel.title)}</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #0e1a16;
        --panel: #14251f;
        --line: #29473e;
        --chalk: #dcefdc;
        --chalk-soft: #a9c5ad;
        --green: #7fbe8b;
        --amber: #f4b860;
        --danger: #ffcb8f;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Arial, Helvetica, sans-serif;
        background: radial-gradient(circle at top, #18342b 0%, var(--bg) 55%);
        color: var(--chalk);
      }
      main { max-width: 1200px; margin: 0 auto; padding: 24px; }
      .notice {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 18px;
        border-bottom: 1px solid var(--line);
        background: rgba(9, 15, 13, 0.7);
        color: var(--chalk-soft);
      }
      .hero { display: grid; grid-template-columns: 1.4fr 1fr; gap: 20px; margin: 24px 0; }
      .panel {
        background: rgba(20, 37, 31, 0.92);
        border: 1px solid var(--line);
        border-radius: 20px;
        padding: 20px;
        box-shadow: 0 18px 48px rgba(0,0,0,0.18);
      }
      .signature-panel { border-color: rgba(244, 184, 96, 0.45); }
      .signature-header, .panel-heading {
        display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
      }
      .eyebrow, .label, .metric-label {
        text-transform: uppercase; letter-spacing: 0.08em; font-size: 12px; color: var(--chalk-soft);
      }
      h1, h2, p { margin-top: 0; }
      h1 { margin-bottom: 10px; font-size: 40px; }
      h2 { margin-bottom: 12px; font-size: 28px; }
      .subtitle { color: var(--chalk-soft); max-width: 56rem; }
      .metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
      .metric { padding: 16px; border-radius: 16px; background: rgba(7, 12, 10, 0.28); border: 1px solid rgba(127, 190, 139, 0.18); }
      .metric.amber { border-color: rgba(244, 184, 96, 0.35); }
      .metric-value { display: block; margin-top: 10px; font-size: 28px; color: var(--green); }
      .metric.amber .metric-value, .timer-block strong { color: var(--amber); }
      .signature-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
      .badge { display: inline-flex; align-items: center; border-radius: 999px; padding: 6px 12px; font-size: 12px; font-weight: 700; }
      .badge-ephemeral { background: rgba(244, 184, 96, 0.16); color: var(--amber); }
      .badge-active { background: rgba(127, 190, 139, 0.14); color: var(--green); }
      .badge-muted { background: rgba(220, 239, 220, 0.08); color: var(--chalk-soft); }
      .choice-list { display: flex; flex-wrap: wrap; gap: 10px; list-style: none; padding: 0; margin: 10px 0 0; }
      .choice-list li { padding: 10px 12px; border-radius: 12px; background: rgba(7, 12, 10, 0.35); border: 1px solid var(--line); }
      .layout { display: grid; grid-template-columns: 1fr; gap: 20px; }
      .process-meta { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .table-wrap { overflow-x: auto; }
      table { width: 100%; border-collapse: collapse; }
      th, td { text-align: left; padding: 14px 12px; border-bottom: 1px solid rgba(220, 239, 220, 0.08); vertical-align: top; }
      th { color: var(--chalk-soft); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
      .empty-panel p:last-child { margin-bottom: 0; }
      @media (max-width: 960px) {
        .hero, .metrics, .signature-grid, .process-meta { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="notice">
      <strong>${escapeHtml(viewModel.notice)}</strong>
      <span>Generado: ${escapeHtml(viewModel.processMeta.generatedAt)}</span>
    </div>
    <main>
      <header>
        <h1>${escapeHtml(viewModel.title)}</h1>
        <p class="subtitle">${escapeHtml(viewModel.subtitle)}</p>
      </header>

      <section class="metrics">
        ${renderMetric('Sesiones visibles', viewModel.processMeta.sessionCount)}
        ${renderMetric('Sesiones activas', viewModel.processMeta.activeCount, 'amber')}
        ${renderMetric('Sesiones terminadas', viewModel.processMeta.endedCount)}
        ${renderMetric('Sesiones expiradas', viewModel.processMeta.expiredCount)}
      </section>

      <section class="hero">
        ${renderPrimarySession(viewModel.primarySession)}
        <aside class="panel">
          <p class="eyebrow">Proceso</p>
          <h2>Verdad operativa</h2>
          <div class="process-meta">
            <div><span class="label">Levantado</span><p>${escapeHtml(viewModel.processMeta.startedAt)}</p></div>
            <div><span class="label">Uptime</span><p>${escapeHtml(viewModel.processMeta.uptime)}</p></div>
            <div><span class="label">Puntos por acierto</span><p>${escapeHtml(viewModel.config.scoreIncrement)}</p></div>
            <div><span class="label">Timeout turno</span><p>${escapeHtml(viewModel.config.turnTimeoutSeconds)}s</p></div>
          </div>
          <p class="subtitle">Sin historico persistente, sin tendencias y sin agregados entre reinicios. Este tablero solo refleja memoria efimera del proceso actual.</p>
        </aside>
      </section>

      <section class="layout">
        ${renderSessionsTable(viewModel.sessions, viewModel.emptyState)}
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderDashboardPage
};
