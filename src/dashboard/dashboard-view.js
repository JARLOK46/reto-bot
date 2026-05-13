function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderRows(items, emptyMessage, rowRenderer) {
  if (!items.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }

  return items.map(rowRenderer).join('');
}

function renderTrend(points) {
  const width = 250;
  const height = 104;
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const path = points
    .map((point, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (point.percent / 100) * height);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  return `
    <div class="trend-card-inner">
      <div class="trend-legend">
        <strong>${escapeHtml(points[points.length - 1]?.value ?? 0)}</strong>
        <span>puntaje acumulado reciente</span>
      </div>
      <svg viewBox="0 0 250 104" class="trend-svg" role="img" aria-label="Tendencia operativa">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(111,126,255,0.28)" />
            <stop offset="100%" stop-color="rgba(111,126,255,0.02)" />
          </linearGradient>
        </defs>
        <path d="M 0 104 ${path.replace(/M\s0\s104\s?/, '')} L 250 104 Z" fill="url(#trend-fill)"></path>
        <path d="${path}" fill="none" stroke="#6f7eff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
        ${points.map((point, index) => {
          const x = Math.round(index * step);
          const y = Math.round(height - (point.percent / 100) * height);
          return `<circle cx="${x}" cy="${y}" r="4" fill="#f86f8f"></circle>`;
        }).join('')}
      </svg>
      <div class="trend-axis">
        ${points.map((point) => `<span>${escapeHtml(point.label)}</span>`).join('')}
      </div>
    </div>
  `;
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
        --canvas: #f3f5fb;
        --hero: #425391;
        --hero-grid: rgba(255,255,255,0.08);
        --surface: #ffffff;
        --surface-soft: #edf1ff;
        --surface-strong: #6e86db;
        --line: rgba(26, 34, 63, 0.08);
        --line-strong: rgba(26, 34, 63, 0.14);
        --ink: #1b1d2a;
        --ink-soft: #687089;
        --ink-muted: #9298ac;
        --primary: #6f7eff;
        --primary-soft: #dfe5ff;
        --accent: #f86f8f;
        --cyan: #2fd3e7;
        --success: #39b67a;
        --warning: #f3b35d;
        --danger: #ef6a72;
        --shadow: 0 20px 45px rgba(27, 29, 42, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, #070b15 0%, #090d17 18%, var(--canvas) 18%, var(--canvas) 100%);
        color: var(--ink);
        font-family: Inter, Arial, Helvetica, sans-serif;
      }
      .shell {
        max-width: 1500px;
        margin: 0 auto;
        padding: 28px 28px 36px;
      }
      .hero {
        position: relative;
        overflow: hidden;
        padding: 14px 18px 42px;
        border-radius: 0;
        background: var(--hero);
        box-shadow: var(--shadow);
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(var(--hero-grid) 0.7px, transparent 0.7px);
        background-size: 18px 18px;
        opacity: 0.75;
      }
      .hero > * { position: relative; z-index: 1; }
      .menu-badge {
        display: inline-flex;
        padding: 7px 10px;
        border-radius: 6px;
        background: #ff6987;
        color: #fff;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.05em;
        text-transform: uppercase;
      }
      .hero-content {
        padding: 42px 44px 28px;
        color: #fff;
      }
      .hero-content h1 {
        margin: 0;
        font-size: 58px;
        line-height: 1.02;
        max-width: 760px;
      }
      .hero-content p {
        margin: 14px 0 0;
        max-width: 760px;
        color: rgba(255,255,255,0.86);
        font-size: 20px;
        line-height: 1.5;
      }
      .main-layout {
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        gap: 28px;
        align-items: start;
        margin-top: 26px;
      }
      .filters {
        padding: 22px 22px 26px;
        border-radius: 10px;
        background: var(--surface-strong);
        color: #fff;
        box-shadow: var(--shadow);
        position: sticky;
        top: 18px;
      }
      .filters-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 26px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        font-size: 13px;
      }
      .filters-header::before {
        content: '≡';
        font-size: 18px;
        line-height: 1;
      }
      .filter-group + .filter-group { margin-top: 22px; }
      .filter-group h3 {
        margin: 0 0 10px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .filter-list {
        display: grid;
        gap: 8px;
      }
      .filter-item {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        font-size: 14px;
        color: rgba(255,255,255,0.92);
      }
      .filter-item span:last-child {
        color: rgba(255,255,255,0.76);
        text-align: right;
      }
      .content { display: grid; gap: 22px; }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
      }
      .section-head h2 {
        margin: 0;
        font-size: 21px;
      }
      .section-head p {
        margin: 6px 0 0;
        color: var(--ink-soft);
        font-size: 14px;
      }
      .section-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 94px;
        padding: 10px 16px;
        border-radius: 8px;
        border: 1px solid rgba(248, 111, 143, 0.6);
        color: #ff5d7f;
        background: rgba(255,255,255,0.66);
        font-weight: 700;
        text-decoration: none;
      }
      .cards-row {
        display: grid;
        grid-template-columns: minmax(0, 1.1fr) minmax(280px, 0.9fr) minmax(280px, 0.75fr);
        gap: 16px;
      }
      .card,
      .stat-box,
      .mini-card,
      .agent-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: var(--shadow);
      }
      .card { padding: 16px 18px; }
      .card h3 {
        margin: 0 0 12px;
        font-size: 16px;
      }
      .trend-card-inner { display: grid; gap: 10px; }
      .trend-legend strong { font-size: 36px; line-height: 1; }
      .trend-legend span { color: var(--ink-soft); font-size: 13px; }
      .trend-svg { width: 100%; height: 130px; display: block; }
      .trend-axis {
        display: grid;
        grid-template-columns: repeat(${viewModel.trend.points.length}, 1fr);
        color: var(--ink-muted);
        font-size: 12px;
      }
      .split-kpis {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 0;
        min-height: 100%;
      }
      .split-kpi {
        padding: 16px 12px;
        text-align: center;
        border-right: 1px solid var(--line);
      }
      .split-kpi:last-child { border-right: none; }
      .split-kpi strong {
        display: block;
        font-size: 46px;
        line-height: 1;
        margin-bottom: 8px;
      }
      .split-kpi span,
      .progress-card small,
      .muted { color: var(--ink-soft); }
      .progress-card { display: grid; gap: 16px; }
      .progress-track {
        height: 10px;
        border-radius: 999px;
        background: var(--primary-soft);
        overflow: hidden;
      }
      .progress-fill {
        height: 100%;
        border-radius: 999px;
      }
      .progress-fill.primary { background: #b96bf2; }
      .progress-fill.cyan { background: var(--cyan); }
      .progress-fill.blue { background: var(--primary); }
      .progress-meta {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
      }
      .progress-meta strong { display: block; font-size: 26px; }
      .process-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 0;
      }
      .stat-box {
        padding: 22px 18px;
        border-radius: 0;
        border-right: none;
      }
      .process-grid .stat-box:first-child { border-radius: 14px 0 0 14px; }
      .process-grid .stat-box:last-child { border-radius: 0 14px 14px 0; }
      .stat-box strong {
        display: block;
        font-size: 46px;
        line-height: 1;
      }
      .stat-box span { display: block; margin-top: 8px; font-weight: 700; }
      .stat-box small { display: block; margin-top: 6px; color: var(--ink-soft); }
      .agents-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0;
      }
      .agent-card {
        padding: 22px 18px;
        border-radius: 0;
        text-align: center;
      }
      .agents-grid .agent-card:first-child { border-radius: 14px 0 0 14px; }
      .agents-grid .agent-card:last-child { border-radius: 0 14px 14px 0; }
      .avatar {
        width: 56px;
        height: 56px;
        margin: 0 auto 14px;
        border-radius: 999px;
        display: grid;
        place-items: center;
        background: linear-gradient(135deg, #ffd6de 0%, #dfe5ff 100%);
        color: var(--ink);
        font-weight: 800;
      }
      .agent-card strong { display: block; font-size: 18px; }
      .agent-card p { margin: 6px 0 0; color: var(--ink-soft); }
      .tables-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
        gap: 18px;
      }
      .panel {
        padding: 18px;
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 14px;
        box-shadow: var(--shadow);
      }
      .panel + .panel { margin-top: 0; }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 13px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }
      th {
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ink-soft);
      }
      td { color: var(--ink-soft); font-size: 14px; }
      td strong { color: var(--ink); }
      .list { display: grid; gap: 12px; }
      .list-item {
        padding: 14px;
        border-radius: 12px;
        border: 1px solid var(--line);
        background: #fbfcff;
      }
      .list-item-header {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .list-item p { margin: 0; color: var(--ink-soft); line-height: 1.45; }
      .tone-error { border-color: rgba(239, 106, 114, 0.3); background: rgba(239, 106, 114, 0.06); }
      .tone-warning { border-color: rgba(243, 179, 93, 0.3); background: rgba(243, 179, 93, 0.08); }
      .tone-info { border-color: rgba(111, 126, 255, 0.18); background: rgba(111, 126, 255, 0.04); }
      .mono { font-family: Consolas, 'Courier New', monospace; }
      .empty-state {
        padding: 16px;
        border-radius: 12px;
        border: 1px dashed var(--line-strong);
        color: var(--ink-soft);
        background: #fbfcff;
      }
      @media (max-width: 1280px) {
        .cards-row,
        .tables-grid,
        .main-layout { grid-template-columns: 1fr; }
        .filters { position: static; }
      }
      @media (max-width: 1120px) {
        .process-grid,
        .agents-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .stat-box, .agent-card { border-radius: 14px; }
        .hero-content h1 { font-size: 44px; }
      }
      @media (max-width: 760px) {
        .shell { padding: 18px; }
        .hero-content { padding: 30px 18px 18px; }
        .hero-content h1 { font-size: 34px; }
        .hero-content p { font-size: 16px; }
        .split-kpis,
        .process-grid,
        .agents-grid,
        .progress-meta { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <span class="menu-badge">Menu</span>
        <div class="hero-content">
          <p style="margin:0 0 12px; font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:rgba(255,255,255,.7);">${escapeHtml(viewModel.hero.eyebrow)}</p>
          <h1>${escapeHtml(viewModel.hero.title)}</h1>
          <p>${escapeHtml(viewModel.hero.subtitle)}</p>
        </div>
      </section>

      <section class="main-layout">
        <aside class="filters">
          <div class="filters-header">Filter</div>
          ${viewModel.filters.map((group) => `
            <section class="filter-group">
              <h3>${escapeHtml(group.title)}</h3>
              <div class="filter-list">
                ${group.items.map((item) => `
                  <div class="filter-item">
                    <span>${escapeHtml(item.label)}</span>
                    <span>${escapeHtml(item.value)}</span>
                  </div>
                `).join('')}
              </div>
            </section>
          `).join('')}
        </aside>

        <div class="content">
          <section>
            <div class="section-head">
              <div>
                <h2>KPIs</h2>
                <p>${escapeHtml(viewModel.notes.audience)} ${escapeHtml(viewModel.notes.visibility)}</p>
              </div>
              <a class="section-link" href="/api/snapshot">View all</a>
            </div>

            <div class="cards-row">
              <article class="card">
                <h3>${escapeHtml(viewModel.trend.title)}</h3>
                ${renderTrend(viewModel.trend.points)}
              </article>

              <article class="card">
                <h3>Sesiones del proceso</h3>
                <div class="split-kpis">
                  ${viewModel.operationalKpis.map((item) => `
                    <div class="split-kpi">
                      <strong>${escapeHtml(item.value)}</strong>
                      <span>${escapeHtml(item.label)}</span>
                      <small>${escapeHtml(item.detail)}</small>
                    </div>
                  `).join('')}
                </div>
              </article>

              <article class="card progress-card">
                <h3>Objetivos del runtime</h3>
                ${viewModel.runtimeTargets.map((item, index) => `
                  <div>
                    <div style="display:flex;justify-content:space-between;gap:12px;margin-bottom:6px;">
                      <span>${escapeHtml(item.label)}</span>
                      <strong>${escapeHtml(item.value)}</strong>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill ${index === 0 ? 'primary' : index === 1 ? 'cyan' : 'blue'}" style="width:${escapeHtml(item.progress)}%"></div>
                    </div>
                  </div>
                `).join('')}
              </article>
            </div>
          </section>

          <section>
            <div class="section-head">
              <div>
                <h2>Proceso de juego</h2>
                <p>Indicadores resumidos del rendimiento operativo durante esta ejecución.</p>
              </div>
              <span class="section-link">Runtime</span>
            </div>
            <div class="process-grid">
              ${viewModel.processStats.map((item) => `
                <article class="stat-box">
                  <strong>${escapeHtml(item.ratio)}</strong>
                  <span>${escapeHtml(item.label)}</span>
                  <small>${escapeHtml(item.value)}</small>
                </article>
              `).join('')}
            </div>
          </section>

          <section>
            <div class="section-head">
              <div>
                <h2>Chats destacados</h2>
                <p>Los chats con mayor actividad o mejor rendimiento dentro del proceso actual.</p>
              </div>
              <a class="section-link" href="#recent-chats">View all</a>
            </div>
            <div class="agents-grid">
              ${renderRows(
                viewModel.topChats,
                'Aún no hay chats suficientes para destacar actividad.',
                (chat) => `
                  <article class="agent-card">
                    <div class="avatar">${escapeHtml(chat.avatarLabel)}</div>
                    <strong>Chat ${escapeHtml(chat.chatId)}</strong>
                    <p>${escapeHtml(chat.statusLabel)} · Nivel ${escapeHtml(chat.currentLevel)}</p>
                    <p>${escapeHtml(chat.currentScore)} pts · ${escapeHtml(chat.correctAnswers)} aciertos</p>
                  </article>
                `
              )}
            </div>
          </section>

          <section class="tables-grid">
            <div class="panel">
              <div class="section-head" style="margin-bottom:14px;">
                <div>
                  <h2>Sesiones activas</h2>
                  <p>Turnos en vivo ordenados por tiempo restante.</p>
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
                        <th>Resp.</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${viewModel.activeSessions.map((session) => `
                        <tr>
                          <td><strong>${escapeHtml(session.chatId)}</strong><br><span class="muted">${escapeHtml(session.startedAt)}</span></td>
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
            </div>

            <div class="panel">
              <div class="section-head" style="margin-bottom:14px;">
                <div>
                  <h2>Errores recientes</h2>
                  <p>Incidentes visibles sin abrir logs crudos.</p>
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
                      <p class="muted">${escapeHtml(error.scope)}${error.chatId ? ` · Chat ${escapeHtml(error.chatId)}` : ''}</p>
                    </article>
                  `
                )}
              </div>
            </div>
          </section>

          <section class="tables-grid">
            <div class="panel" id="recent-chats">
              <div class="section-head" style="margin-bottom:14px;">
                <div>
                  <h2>Chats y usuarios visibles</h2>
                  <p>Resumen administrativo por chat con última actividad registrada.</p>
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
                        <th>Evento</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${viewModel.recentChats.map((chat) => `
                        <tr>
                          <td><strong>${escapeHtml(chat.chatId)}</strong><br><span class="muted">${escapeHtml(chat.lastSeenAt)}</span></td>
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
            </div>

            <div class="panel">
              <div class="section-head" style="margin-bottom:14px;">
                <div>
                  <h2>Bitácora reciente</h2>
                  <p>Actividad corta priorizada según lo que aparece en la página.</p>
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
            </div>
          </section>

          <section class="panel">
            <div class="section-head" style="margin-bottom:14px;">
              <div>
                <h2>Historial reciente</h2>
                <p>Cierres observados durante la ejecución actual del bot.</p>
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
                        <td>${escapeHtml(item.statusLabel)}<br><span class="muted">${escapeHtml(item.reason ?? 'Sin detalle')}</span></td>
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
      </section>
    </main>
  </body>
</html>`;
}

module.exports = {
  renderDashboardPage
};
