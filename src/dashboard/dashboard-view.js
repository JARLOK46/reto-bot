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

function renderRows(items, emptyMessage, rowRenderer) {
  if (!items.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return items.map(rowRenderer).join('');
}

function renderDashboardPage(viewModel) {
  const statusTone = viewModel.bot.status === 'connected'
    ? 'success'
    : viewModel.bot.status === 'retrying' || viewModel.bot.status === 'connecting'
      ? 'warning'
      : 'danger';

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
        --bg: #0c1513;
        --surface: #111d1a;
        --surface-raised: #162521;
        --surface-soft: #1a2b26;
        --line: rgba(194, 223, 210, 0.12);
        --line-strong: rgba(194, 223, 210, 0.22);
        --text: #edf7f1;
        --text-soft: #a8c0b5;
        --text-muted: #7f968d;
        --success: #81c995;
        --warning: #f2bb71;
        --danger: #e18b7d;
        --info: #88b2c8;
        --shadow: 0 20px 50px rgba(0, 0, 0, 0.2);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        background: radial-gradient(circle at top, #173028 0%, var(--bg) 55%);
        color: var(--text);
        font-family: Inter, Arial, Helvetica, sans-serif;
      }
      .shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 24px;
      }
      .topbar {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 20px 24px;
        background: rgba(14, 24, 21, 0.76);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }
      .eyebrow, .metric-label, th, .label {
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
        color: var(--text-soft);
      }
      h1, h2, h3, p { margin: 0; }
      h1 { font-size: 34px; line-height: 1.05; }
      .subtitle { margin-top: 10px; max-width: 60ch; color: var(--text-soft); }
      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 8px 14px;
        border: 1px solid var(--line-strong);
        background: rgba(255,255,255,0.03);
        color: var(--text);
        font-size: 13px;
        font-weight: 700;
      }
      .badge::before {
        content: '';
        width: 8px;
        height: 8px;
        border-radius: 999px;
        background: currentColor;
        box-shadow: 0 0 0 4px rgba(255,255,255,0.03);
      }
      .badge.success { color: var(--success); }
      .badge.warning { color: var(--warning); }
      .badge.danger { color: var(--danger); }
      .top-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 12px;
        min-width: 380px;
      }
      .meta-card,
      .panel,
      .metric {
        background: rgba(17, 29, 26, 0.92);
        border: 1px solid var(--line);
        border-radius: 22px;
        box-shadow: var(--shadow);
      }
      .meta-card {
        padding: 16px;
      }
      .meta-card strong {
        display: block;
        margin-top: 8px;
        font-size: 18px;
      }
      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        margin: 18px 0 22px;
      }
      .metric { padding: 18px; }
      .metric-value {
        display: block;
        margin-top: 10px;
        font-size: 30px;
        color: var(--text);
      }
      .metric.emphasis .metric-value { color: var(--success); }
      .metric.warning .metric-value { color: var(--warning); }
      .metric.danger .metric-value { color: var(--danger); }
      .dashboard {
        display: grid;
        grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.95fr);
        gap: 18px;
      }
      .stack {
        display: grid;
        gap: 18px;
      }
      .panel {
        padding: 20px;
      }
      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 16px;
      }
      .panel-header p {
        margin-top: 8px;
        color: var(--text-soft);
      }
      .info-note {
        padding: 14px 16px;
        border-radius: 16px;
        border: 1px solid rgba(136, 178, 200, 0.18);
        background: rgba(136, 178, 200, 0.08);
        color: var(--text-soft);
        line-height: 1.55;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 14px 12px;
        border-bottom: 1px solid rgba(194, 223, 210, 0.08);
        vertical-align: top;
      }
      td {
        color: var(--text-soft);
      }
      td strong { color: var(--text); }
      .list {
        display: grid;
        gap: 12px;
      }
      .list-item {
        padding: 14px;
        border-radius: 18px;
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(194, 223, 210, 0.08);
      }
      .list-item-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .list-item p {
        margin-top: 6px;
        color: var(--text-soft);
        line-height: 1.45;
      }
      .tone-error { border-color: rgba(225, 139, 125, 0.26); background: rgba(225, 139, 125, 0.08); }
      .tone-warning { border-color: rgba(242, 187, 113, 0.26); background: rgba(242, 187, 113, 0.08); }
      .tone-info { border-color: rgba(136, 178, 200, 0.22); }
      .mono { font-family: Consolas, 'Courier New', monospace; }
      .muted { color: var(--text-muted); }
      .empty-state {
        padding: 18px;
        border-radius: 16px;
        border: 1px dashed rgba(194, 223, 210, 0.16);
        color: var(--text-soft);
        background: rgba(255,255,255,0.02);
      }
      @media (max-width: 1120px) {
        .dashboard { grid-template-columns: 1fr; }
      }
      @media (max-width: 960px) {
        .topbar, .metrics, .top-meta { grid-template-columns: 1fr; display: grid; }
        .top-meta { min-width: 0; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="topbar">
        <div>
          <p class="eyebrow">Bitácora operativa del bot</p>
          <h1>${escapeHtml(viewModel.title)}</h1>
          <p class="subtitle">${escapeHtml(viewModel.notes.audience)} ${escapeHtml(viewModel.notes.visibility)}</p>
        </div>
        <div>
          <span class="badge ${escapeHtml(statusTone)}">${escapeHtml(viewModel.bot.statusLabel)}</span>
        </div>
      </section>

      <section class="metrics">
        ${renderMetric('Sesiones activas', viewModel.metrics.activeSessions, 'emphasis')}
        ${renderMetric('Chats visibles', viewModel.metrics.trackedChats)}
        ${renderMetric('Historial reciente', viewModel.metrics.recentHistory, 'warning')}
        ${renderMetric('Errores recientes', viewModel.metrics.recentErrors, 'danger')}
      </section>

      <section class="dashboard">
        <div class="stack">
          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Estado general</p>
                <h2>Resumen del runtime</h2>
                <p>Supervisión del proceso actual en Render y de la conexión con Telegram.</p>
              </div>
            </div>
            <div class="top-meta">
              <article class="meta-card">
                <span class="label">Modo</span>
                <strong>${escapeHtml(viewModel.bot.mode)}</strong>
              </article>
              <article class="meta-card">
                <span class="label">Uptime</span>
                <strong>${escapeHtml(viewModel.bot.uptime)}</strong>
              </article>
              <article class="meta-card">
                <span class="label">Última conexión</span>
                <strong>${escapeHtml(viewModel.bot.connectedAt)}</strong>
              </article>
              <article class="meta-card">
                <span class="label">Intentos de arranque</span>
                <strong>${escapeHtml(viewModel.bot.launchAttempts)}</strong>
              </article>
              <article class="meta-card">
                <span class="label">Actualizado</span>
                <strong>${escapeHtml(viewModel.generatedAt)}</strong>
              </article>
              <article class="meta-card">
                <span class="label">Último error</span>
                <strong class="mono">${escapeHtml(viewModel.bot.lastError?.code ?? 'Sin errores')}</strong>
              </article>
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Sesiones activas</p>
                <h2>Turnos en vivo</h2>
                <p>Lo más importante para profesores y administradores: quién está jugando ahora mismo.</p>
              </div>
            </div>
            ${viewModel.activeSessions.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>Chat</th>
                      <th>Puntaje</th>
                      <th>Nivel</th>
                      <th>Turno</th>
                      <th>Tiempo</th>
                      <th>Respuestas</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${viewModel.activeSessions.map((session) => `
                      <tr>
                        <td><strong>${escapeHtml(session.chatId)}</strong><br /><span class="muted">${escapeHtml(session.startedAt)}</span></td>
                        <td>${escapeHtml(session.score)}</td>
                        <td>${escapeHtml(session.level)}</td>
                        <td>${escapeHtml(session.prompt)}</td>
                        <td>${escapeHtml(session.remainingLabel)}</td>
                        <td>${escapeHtml(session.answeredCount)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>`
              : '<div class="empty-state">No hay sesiones activas en este momento.</div>'}
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Chats visibles</p>
                <h2>Actividad reciente por chat</h2>
                <p>Resumen administrativo para entender quién interactuó con el bot dentro del proceso actual.</p>
              </div>
            </div>
            ${viewModel.recentChats.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>Chat</th>
                      <th>Estado</th>
                      <th>Puntaje</th>
                      <th>Inicios</th>
                      <th>Aciertos</th>
                      <th>Último evento</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${viewModel.recentChats.map((chat) => `
                      <tr>
                        <td><strong>${escapeHtml(chat.chatId)}</strong><br /><span class="muted">${escapeHtml(chat.lastSeenAt)}</span></td>
                        <td>${escapeHtml(chat.statusLabel)}</td>
                        <td>${escapeHtml(chat.currentScore)} · Nivel ${escapeHtml(chat.currentLevel)}</td>
                        <td>${escapeHtml(chat.starts)}</td>
                        <td>${escapeHtml(chat.correctAnswers)}</td>
                        <td>${escapeHtml(chat.lastEvent)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>`
              : '<div class="empty-state">Todavía no hay chats registrados en esta ejecución.</div>'}
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Historial del proceso</p>
                <h2>Sesiones terminadas o expiradas</h2>
                <p>Registro útil para entender cómo terminó cada partida observada en esta ejecución.</p>
              </div>
            </div>
            ${viewModel.history.length
              ? `<table>
                  <thead>
                    <tr>
                      <th>Chat</th>
                      <th>Resultado</th>
                      <th>Puntaje final</th>
                      <th>Respuestas</th>
                      <th>Inicio</th>
                      <th>Cierre</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${viewModel.history.map((item) => `
                      <tr>
                        <td><strong>${escapeHtml(item.chatId)}</strong></td>
                        <td>${escapeHtml(item.statusLabel)}<br /><span class="muted">${escapeHtml(item.reason ?? 'Sin detalle')}</span></td>
                        <td>${escapeHtml(item.finalScore)} · Nivel ${escapeHtml(item.level)}</td>
                        <td>${escapeHtml(item.answeredCount)}</td>
                        <td>${escapeHtml(item.startedAtLabel)}</td>
                        <td>${escapeHtml(item.endedAtLabel)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>`
              : '<div class="empty-state">Aún no hay sesiones cerradas dentro de este proceso.</div>'}
          </section>
        </div>

        <aside class="stack">
          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Salud técnica</p>
                <h2>Último estado del bot</h2>
                <p>Diagnóstico rápido para confirmar si Telegram está operativo.</p>
              </div>
            </div>
            <div class="info-note">
              <strong class="label">Estado actual</strong>
              <p>${escapeHtml(viewModel.bot.statusLabel)} en modo ${escapeHtml(viewModel.bot.mode)}.</p>
              <p>Intentos: ${escapeHtml(viewModel.bot.launchAttempts)} · Última conexión: ${escapeHtml(viewModel.bot.connectedAt)}</p>
            </div>
            ${viewModel.bot.lastError
              ? `<div class="list-item tone-error" style="margin-top: 14px;">
                  <div class="list-item-header">
                    <strong>Error más reciente</strong>
                    <span class="muted">${escapeHtml(viewModel.bot.lastError.atLabel)}</span>
                  </div>
                  <p><span class="mono">${escapeHtml(viewModel.bot.lastError.code ?? 'sin código')}</span> · ${escapeHtml(viewModel.bot.lastError.message)}</p>
                </div>`
              : '<div class="empty-state" style="margin-top: 14px;">No hay errores recientes reportados por el runtime.</div>'}
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Errores</p>
                <h2>Incidentes recientes</h2>
                <p>Últimos fallos detectados sin necesidad de abrir logs crudos.</p>
              </div>
            </div>
            <div class="list">
              ${renderRows(
                viewModel.recentErrors,
                'No se registran errores recientes en esta ejecución.',
                (error) => `
                  <article class="list-item tone-error">
                    <div class="list-item-header">
                      <strong>${escapeHtml(error.code ?? 'Error sin código')}</strong>
                      <span class="muted">${escapeHtml(error.atLabel)}</span>
                    </div>
                    <p>${escapeHtml(error.message)}</p>
                    <p class="muted">Scope: ${escapeHtml(error.scope)}${error.chatId ? ` · Chat ${escapeHtml(error.chatId)}` : ''}</p>
                  </article>
                `
              )}
            </div>
          </section>

          <section class="panel">
            <div class="panel-header">
              <div>
                <p class="eyebrow">Bitácora</p>
                <h2>Eventos recientes</h2>
                <p>Secuencia corta para entender qué pasó sin perderse en el detalle.</p>
              </div>
            </div>
            <div class="list">
              ${renderRows(
                viewModel.recentEvents,
                'No hay eventos recientes todavía.',
                (event) => `
                  <article class="list-item ${event.level === 'error' ? 'tone-error' : event.level === 'warning' ? 'tone-warning' : 'tone-info'}">
                    <div class="list-item-header">
                      <strong>${escapeHtml(event.title)}</strong>
                      <span class="muted">${escapeHtml(event.atLabel)}</span>
                    </div>
                    <p>${escapeHtml(event.message)}</p>
                    <p class="muted">${escapeHtml(event.type)}${event.chatId ? ` · Chat ${escapeHtml(event.chatId)}` : ''}</p>
                  </article>
                `
              )}
            </div>
          </section>
        </aside>
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderDashboardPage
};
