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
  const safePoints = points.length ? points : [{ label: 'P1', value: 0, percent: 0 }];
  const width = 280;
  const height = 122;
  const step = safePoints.length > 1 ? width / (safePoints.length - 1) : width;
  const line = safePoints
    .map((point, index) => {
      const x = Math.round(index * step);
      const y = Math.round(height - (point.percent / 100) * height);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const area = `${line} L ${width} ${height} L 0 ${height} Z`;

  return `
    <div class="trend-card-inner">
      <div class="trend-meta">
        <div>
          <strong>${escapeHtml(safePoints[safePoints.length - 1]?.value ?? 0)}</strong>
          <span>Puntaje operativo reciente</span>
        </div>
        <small>Proceso actual</small>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="trend-svg" role="img" aria-label="Tendencia operativa">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(99, 120, 255, 0.28)" />
            <stop offset="100%" stop-color="rgba(99, 120, 255, 0.03)" />
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#trend-fill)"></path>
        <path d="${line}" fill="none" stroke="#6378ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
        ${safePoints.map((point, index) => {
          const x = Math.round(index * step);
          const y = Math.round(height - (point.percent / 100) * height);
          return `<circle cx="${x}" cy="${y}" r="4.5" fill="#ff6f91"></circle>`;
        }).join('')}
      </svg>
      <div class="trend-axis">
        ${safePoints.map((point) => `<span>${escapeHtml(point.label)}</span>`).join('')}
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
        --page-bg: #eef2fb;
        --hero-bg: #4a5fa7;
        --hero-grid: rgba(255, 255, 255, 0.08);
        --sidebar-bg: linear-gradient(180deg, #7087dc 0%, #657ccf 100%);
        --surface: #ffffff;
        --surface-soft: #f8faff;
        --surface-tint: #edf2ff;
        --line: rgba(21, 28, 45, 0.08);
        --line-strong: rgba(21, 28, 45, 0.14);
        --text: #1a2030;
        --text-soft: #66708b;
        --text-muted: #8f96ab;
        --primary: #6378ff;
        --primary-soft: #dfe5ff;
        --accent: #ff6f91;
        --cyan: #31d4e5;
        --success: #2ea66d;
        --warning: #f2b450;
        --danger: #ef6c76;
        --shadow: 0 22px 48px rgba(28, 35, 61, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, #0a0f1b 0%, #0a0f1b 180px, var(--page-bg) 180px, var(--page-bg) 100%);
        color: var(--text);
        font-family: Inter, Arial, Helvetica, sans-serif;
      }
      .shell {
        max-width: 1440px;
        margin: 0 auto;
        padding: 22px 24px 40px;
      }
      .hero {
        position: relative;
        overflow: hidden;
        background: var(--hero-bg);
        border-radius: 0;
        box-shadow: var(--shadow);
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(var(--hero-grid) 0.7px, transparent 0.7px);
        background-size: 18px 18px;
      }
      .hero > * {
        position: relative;
        z-index: 1;
      }
      .menu-badge {
        display: inline-flex;
        margin: 14px 0 0 14px;
        padding: 7px 10px;
        border-radius: 6px;
        background: #ff6a89;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
        gap: 22px;
        padding: 26px 32px 30px;
      }
      .hero-copy p:first-child {
        margin: 0 0 12px;
        color: rgba(255,255,255,0.72);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .hero-copy h1 {
        margin: 0;
        max-width: 760px;
        color: #fff;
        font-size: 58px;
        line-height: 1.02;
      }
      .hero-copy .subtitle {
        margin: 16px 0 0;
        max-width: 720px;
        color: rgba(255,255,255,0.9);
        font-size: 18px;
        line-height: 1.55;
      }
      .hero-status {
        display: grid;
        gap: 12px;
        align-content: start;
      }
      .status-badge {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 9px 14px;
        border-radius: 999px;
        background: rgba(255,255,255,0.12);
        color: #fff;
        font-size: 13px;
        font-weight: 700;
      }
      .status-badge::before {
        content: '';
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: currentColor;
      }
      .status-badge.success { color: #8ef0ba; }
      .status-badge.warning { color: #ffd585; }
      .status-badge.danger { color: #ff9ca6; }
      .hero-status-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .hero-stat {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        color: #fff;
      }
      .hero-stat span {
        display: block;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: rgba(255,255,255,0.7);
      }
      .hero-stat strong {
        display: block;
        margin-top: 8px;
        font-size: 24px;
      }
      .main-layout {
        display: grid;
        grid-template-columns: 250px minmax(0, 1fr);
        gap: 22px;
        align-items: start;
        margin-top: 22px;
      }
      .filters {
        position: sticky;
        top: 18px;
        padding: 20px 18px 22px;
        border-radius: 14px;
        background: var(--sidebar-bg);
        color: #fff;
        box-shadow: var(--shadow);
      }
      .filters-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 22px;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .filters-header::before {
        content: '≡';
        font-size: 18px;
      }
      .filter-group + .filter-group {
        margin-top: 18px;
        padding-top: 18px;
        border-top: 1px solid rgba(255,255,255,0.12);
      }
      .filter-group h3 {
        margin: 0 0 10px;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .filter-list {
        display: grid;
        gap: 10px;
      }
      .filter-item {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        font-size: 14px;
        line-height: 1.35;
      }
      .filter-item span:last-child {
        color: rgba(255,255,255,0.82);
        text-align: right;
      }
      .content {
        display: grid;
        gap: 20px;
      }
      .section-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
      }
      .section-head h2 {
        margin: 0;
        font-size: 18px;
      }
      .section-head p {
        margin: 5px 0 0;
        color: var(--text-soft);
        font-size: 14px;
      }
      .section-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 92px;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid rgba(255, 106, 137, 0.45);
        background: rgba(255,255,255,0.72);
        color: #ff5f82;
        font-weight: 700;
        text-decoration: none;
      }
      .cards-row {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(260px, 0.85fr) minmax(280px, 0.8fr);
        gap: 16px;
      }
      .card,
      .panel,
      .stat-box,
      .agent-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: var(--shadow);
      }
      .card,
      .panel {
        padding: 18px;
      }
      .card h3,
      .panel h3 {
        margin: 0 0 12px;
        font-size: 16px;
      }
      .trend-card-inner {
        display: grid;
        gap: 10px;
      }
      .trend-meta {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .trend-meta strong {
        display: block;
        font-size: 42px;
        line-height: 1;
      }
      .trend-meta span,
      .trend-meta small {
        color: var(--text-soft);
      }
      .trend-svg {
        width: 100%;
        height: 130px;
        display: block;
      }
      .trend-axis {
        display: grid;
        grid-template-columns: repeat(${Math.max(1, 7)}, 1fr);
        color: var(--text-muted);
        font-size: 12px;
      }
      .split-kpis {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        min-height: 100%;
      }
      .split-kpi {
        padding: 18px 12px;
        text-align: center;
        border-right: 1px solid var(--line);
      }
      .split-kpi:last-child {
        border-right: none;
      }
      .split-kpi strong {
        display: block;
        font-size: 44px;
        line-height: 1;
      }
      .split-kpi span {
        display: block;
        margin-top: 8px;
        font-weight: 700;
      }
      .split-kpi small,
      .muted {
        color: var(--text-soft);
      }
      .progress-card {
        display: grid;
        gap: 16px;
      }
      .progress-block + .progress-block {
        border-top: 1px solid var(--line);
        padding-top: 12px;
      }
      .progress-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .progress-track {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--primary-soft);
      }
      .progress-fill {
        height: 100%;
        border-radius: 999px;
      }
      .progress-fill.primary { background: #b76cf1; }
      .progress-fill.cyan { background: var(--cyan); }
      .progress-fill.blue { background: var(--primary); }
      .process-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
      }
      .stat-box {
        padding: 18px 16px;
      }
      .stat-box strong {
        display: block;
        font-size: 36px;
        line-height: 1;
      }
      .stat-box span {
        display: block;
        margin-top: 10px;
        font-weight: 700;
      }
      .stat-box small {
        display: block;
        margin-top: 6px;
        color: var(--text-soft);
      }
      .agents-grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 14px;
      }
      .agent-card {
        padding: 20px 16px;
        text-align: center;
      }
      .avatar {
        width: 58px;
        height: 58px;
        display: grid;
        place-items: center;
        margin: 0 auto 14px;
        border-radius: 999px;
        background: linear-gradient(135deg, #ffd8e0 0%, #dfe5ff 100%);
        font-weight: 800;
        color: var(--text);
      }
      .agent-card strong {
        display: block;
        font-size: 17px;
      }
      .agent-card p {
        margin: 6px 0 0;
        color: var(--text-soft);
      }
      .full-empty {
        grid-column: 1 / -1;
      }
      .tables-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
        gap: 16px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        padding: 13px 10px;
        text-align: left;
        vertical-align: top;
        border-bottom: 1px solid var(--line);
      }
      th {
        color: var(--text-soft);
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      td {
        color: var(--text-soft);
        font-size: 14px;
      }
      td strong {
        color: var(--text);
      }
      .list {
        display: grid;
        gap: 12px;
      }
      .list-item {
        padding: 14px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: var(--surface-soft);
      }
      .list-item-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }
      .list-item p {
        margin: 0;
        line-height: 1.48;
        color: var(--text-soft);
      }
      .tone-error {
        border-color: rgba(239, 108, 118, 0.26);
        background: rgba(239, 108, 118, 0.05);
      }
      .tone-warning {
        border-color: rgba(242, 180, 80, 0.26);
        background: rgba(242, 180, 80, 0.08);
      }
      .tone-info {
        border-color: rgba(99, 120, 255, 0.14);
        background: rgba(99, 120, 255, 0.04);
      }
      .mono {
        font-family: Consolas, 'Courier New', monospace;
      }
      .empty-state {
        padding: 16px;
        border-radius: 14px;
        border: 1px dashed var(--line-strong);
        color: var(--text-soft);
        background: var(--surface-soft);
      }
      @media (max-width: 1280px) {
        .main-layout,
        .cards-row,
        .tables-grid,
        .hero-grid {
          grid-template-columns: 1fr;
        }
        .filters {
          position: static;
        }
      }
      @media (max-width: 1040px) {
        .process-grid,
        .agents-grid,
        .hero-status-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }
      @media (max-width: 760px) {
        .shell {
          padding: 14px;
        }
        .hero-grid {
          padding: 18px 18px 22px;
        }
        .hero-copy h1 {
          font-size: 36px;
        }
        .hero-copy .subtitle {
          font-size: 16px;
        }
        .split-kpis,
        .process-grid,
        .agents-grid,
        .hero-status-grid {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <span class="menu-badge">Menu</span>
        <div class="hero-grid">
          <div class="hero-copy">
            <p>${escapeHtml(viewModel.hero.eyebrow)}</p>
            <h1>${escapeHtml(viewModel.hero.title)}</h1>
            <p class="subtitle">${escapeHtml(viewModel.hero.subtitle)}</p>
          </div>
          <div class="hero-status">
            <span class="status-badge ${escapeHtml(statusTone)}">${escapeHtml(viewModel.bot.statusLabel)}</span>
            <div class="hero-status-grid">
              <article class="hero-stat">
                <span>Modo</span>
                <strong>${escapeHtml(viewModel.bot.mode)}</strong>
              </article>
              <article class="hero-stat">
                <span>Uptime</span>
                <strong>${escapeHtml(viewModel.bot.uptime)}</strong>
              </article>
              <article class="hero-stat">
                <span>Intentos</span>
                <strong>${escapeHtml(viewModel.bot.launchAttempts)}</strong>
              </article>
              <article class="hero-stat">
                <span>Actualizado</span>
                <strong>${escapeHtml(viewModel.generatedAt)}</strong>
              </article>
            </div>
          </div>
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
                  <div class="progress-block">
                    <div class="progress-head">
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
              ${viewModel.topChats.length
                ? viewModel.topChats.map((chat) => `
                    <article class="agent-card">
                      <div class="avatar">${escapeHtml(chat.avatarLabel)}</div>
                      <strong>Chat ${escapeHtml(chat.chatId)}</strong>
                      <p>${escapeHtml(chat.statusLabel)} · Nivel ${escapeHtml(chat.currentLevel)}</p>
                      <p>${escapeHtml(chat.currentScore)} pts · ${escapeHtml(chat.correctAnswers)} aciertos</p>
                    </article>
                  `).join('')
                : '<div class="empty-state full-empty">Aún no hay chats suficientes para destacar actividad.</div>'}
            </div>
          </section>

          <section class="tables-grid">
            <div class="panel">
              <div class="section-head">
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
              <div class="section-head">
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
              <div class="section-head">
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
              <div class="section-head">
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
            <div class="section-head">
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
