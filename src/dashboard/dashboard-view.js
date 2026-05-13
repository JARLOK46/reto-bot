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
  const width = 320;
  const height = 132;
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
      <div class="chart-topline">
        <div>
          <strong>${escapeHtml(safePoints[safePoints.length - 1]?.value ?? 0)}</strong>
          <span>Puntaje operativo reciente</span>
        </div>
        <small>Proceso actual</small>
      </div>
      <svg viewBox="0 0 ${width} ${height}" class="trend-svg" role="img" aria-label="Tendencia operativa">
        <defs>
          <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stop-color="rgba(84, 101, 255, 0.28)" />
            <stop offset="100%" stop-color="rgba(84, 101, 255, 0.03)" />
          </linearGradient>
        </defs>
        <path d="${area}" fill="url(#trend-fill)"></path>
        <path d="${line}" fill="none" stroke="#5465ff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
        ${safePoints.map((point, index) => {
          const x = Math.round(index * step);
          const y = Math.round(height - (point.percent / 100) * height);
          return `<circle cx="${x}" cy="${y}" r="4.5" fill="#ff6f91"></circle>`;
        }).join('')}
      </svg>
      <div class="trend-axis ${safePoints.length <= 4 ? 'axis-wide' : ''}">
        ${safePoints.map((point) => `<span>${escapeHtml(point.label)}</span>`).join('')}
      </div>
    </div>
  `;
}

function renderBreakdown(items) {
  return `
    <div class="breakdown-card-inner">
      ${items.map((item) => `
        <div class="breakdown-row">
          <div class="breakdown-label tone-${escapeHtml(item.color)}">
            <span class="dot"></span>
            <span>${escapeHtml(item.label)}</span>
          </div>
          <strong>${escapeHtml(item.value)}</strong>
        </div>
      `).join('')}
      <div class="stacked-progress">
        ${items.map((item) => `<span class="segment tone-${escapeHtml(item.color)}" style="width:${escapeHtml(item.percent)}%"></span>`).join('')}
      </div>
    </div>
  `;
}

function renderActivityBars(items) {
  return `
    <div class="bars-card-inner">
      ${items.map((item) => `
        <div class="bar-row">
          <div class="bar-head">
            <span>${escapeHtml(item.label)}</span>
            <strong>${escapeHtml(item.value)}</strong>
          </div>
          <div class="bar-track"><span class="bar-fill" style="width:${escapeHtml(item.percent)}%"></span></div>
        </div>
      `).join('')}
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
        --page-bg: #eff3fc;
        --dark-bg: #0b1120;
        --hero-bg: linear-gradient(135deg, #4e62b8 0%, #405194 100%);
        --hero-grid: rgba(255,255,255,0.08);
        --sidebar-bg: linear-gradient(180deg, #637ce0 0%, #566fd0 100%);
        --surface: #ffffff;
        --surface-soft: #f7f9ff;
        --surface-tint: #eef2ff;
        --line: rgba(18, 29, 59, 0.08);
        --line-strong: rgba(18, 29, 59, 0.14);
        --text: #171d2b;
        --text-soft: #66718d;
        --text-muted: #98a0b5;
        --primary: #5465ff;
        --primary-soft: #dfe5ff;
        --accent: #ff6f91;
        --cyan: #30d2e6;
        --success: #2fa66e;
        --warning: #f1b24e;
        --danger: #ee6a74;
        --shadow: 0 24px 48px rgba(24, 35, 63, 0.08);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: linear-gradient(180deg, var(--dark-bg) 0%, var(--dark-bg) 160px, var(--page-bg) 160px, var(--page-bg) 100%);
        color: var(--text);
        font-family: Inter, Arial, Helvetica, sans-serif;
      }
      .shell {
        max-width: 1480px;
        margin: 0 auto;
        padding: 22px 24px 40px;
      }
      .hero {
        position: relative;
        overflow: hidden;
        background: var(--hero-bg);
        border-radius: 24px;
        box-shadow: var(--shadow);
      }
      .hero::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: radial-gradient(var(--hero-grid) 0.7px, transparent 0.7px);
        background-size: 18px 18px;
      }
      .hero > * { position: relative; z-index: 1; }
      .menu-badge {
        display: inline-flex;
        margin: 16px 0 0 16px;
        padding: 8px 12px;
        border-radius: 8px;
        background: #ff6988;
        color: #fff;
        font-size: 12px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.35fr) minmax(320px, 0.65fr);
        gap: 28px;
        padding: 28px 32px 34px;
      }
      .hero-copy p:first-child {
        margin: 0 0 12px;
        color: rgba(255,255,255,0.7);
        font-size: 13px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .hero-copy h1 {
        margin: 0;
        color: #fff;
        font-size: 54px;
        line-height: 1.02;
        max-width: 760px;
      }
      .hero-copy .subtitle {
        margin: 16px 0 0;
        color: rgba(255,255,255,0.9);
        font-size: 18px;
        line-height: 1.55;
        max-width: 720px;
      }
      .hero-status {
        display: grid;
        gap: 14px;
        align-content: start;
      }
      .status-badge {
        justify-self: start;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 15px;
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
      .status-badge.success { color: #91f0bd; }
      .status-badge.warning { color: #ffd27a; }
      .status-badge.danger { color: #ff9ca8; }
      .hero-status-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .hero-stat {
        padding: 15px 16px;
        border-radius: 16px;
        background: rgba(255,255,255,0.09);
        border: 1px solid rgba(255,255,255,0.12);
        color: #fff;
      }
      .hero-stat span {
        display: block;
        color: rgba(255,255,255,0.72);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }
      .hero-stat strong {
        display: block;
        margin-top: 8px;
        font-size: 22px;
        line-height: 1.15;
      }
      .dashboard-grid {
        display: grid;
        grid-template-columns: 276px minmax(0, 1fr);
        gap: 24px;
        align-items: start;
        margin-top: 24px;
      }
      .sidebar {
        position: sticky;
        top: 18px;
        align-self: start;
        height: calc(100vh - 36px);
      }
      .sidebar-card {
        display: grid;
        grid-template-rows: auto 1fr auto;
        height: 100%;
        overflow: hidden;
        border-radius: 20px;
        background: var(--sidebar-bg);
        color: #fff;
        box-shadow: var(--shadow);
      }
      .sidebar-inner {
        overflow: auto;
        padding: 20px 18px 22px;
      }
      .sidebar-inner::-webkit-scrollbar { width: 8px; }
      .sidebar-inner::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 999px; }
      .filters-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 16px;
        font-size: 13px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .filters-header::before {
        content: '≡';
        font-size: 18px;
      }
      .sidebar-note {
        padding: 0 18px 18px;
        color: rgba(255,255,255,0.84);
        font-size: 12px;
        line-height: 1.45;
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
        align-items: start;
        font-size: 14px;
        line-height: 1.35;
      }
      .filter-item span:last-child {
        color: rgba(255,255,255,0.84);
        text-align: right;
      }
      .content {
        display: grid;
        gap: 22px;
      }
      .section-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        margin-bottom: 14px;
      }
      .section-head h2 {
        margin: 0;
        font-size: 18px;
      }
      .section-head p {
        margin: 6px 0 0;
        color: var(--text-soft);
        font-size: 14px;
      }
      .section-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 94px;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid rgba(255, 106, 137, 0.42);
        background: rgba(255,255,255,0.75);
        color: #ff5c81;
        font-weight: 700;
        text-decoration: none;
      }
      .kpi-strip {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
      }
      .kpi-card,
      .chart-card,
      .panel,
      .agent-card,
      .mini-card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: var(--shadow);
      }
      .kpi-card {
        padding: 18px;
      }
      .kpi-card small {
        display: block;
        color: var(--text-soft);
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .kpi-card strong {
        display: block;
        margin-top: 10px;
        font-size: 34px;
        line-height: 1;
      }
      .kpi-card p {
        margin: 10px 0 0;
        color: var(--text-soft);
        font-size: 14px;
      }
      .kpi-card.tone-primary strong { color: var(--primary); }
      .kpi-card.tone-cyan strong { color: var(--cyan); }
      .kpi-card.tone-accent strong { color: var(--accent); }
      .kpi-card.tone-neutral strong { color: var(--text); }
      .analytics-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.15fr) minmax(280px, 0.75fr) minmax(280px, 0.8fr);
        gap: 16px;
      }
      .chart-card,
      .panel {
        padding: 18px;
      }
      .chart-card h3,
      .panel h3 {
        margin: 0 0 12px;
        font-size: 16px;
      }
      .chart-topline {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }
      .chart-topline strong {
        display: block;
        font-size: 42px;
        line-height: 1;
      }
      .chart-topline span,
      .chart-topline small,
      .muted {
        color: var(--text-soft);
      }
      .trend-card-inner {
        display: grid;
        gap: 10px;
      }
      .trend-svg {
        width: 100%;
        height: 132px;
        display: block;
      }
      .trend-axis {
        display: grid;
        gap: 6px;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        color: var(--text-muted);
        font-size: 12px;
      }
      .trend-axis.axis-wide {
        grid-template-columns: repeat(4, 1fr);
      }
      .breakdown-card-inner,
      .bars-card-inner {
        display: grid;
        gap: 12px;
      }
      .breakdown-row,
      .bar-row {
        display: grid;
        gap: 8px;
      }
      .breakdown-row {
        grid-template-columns: 1fr auto;
        align-items: center;
      }
      .breakdown-label {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: currentColor;
      }
      .tone-primary { color: var(--primary); }
      .tone-cyan { color: var(--cyan); }
      .tone-accent { color: var(--accent); }
      .stacked-progress {
        display: flex;
        overflow: hidden;
        margin-top: 6px;
        height: 12px;
        border-radius: 999px;
        background: var(--primary-soft);
      }
      .segment {
        display: block;
        height: 100%;
      }
      .segment.tone-primary { background: var(--primary); }
      .segment.tone-cyan { background: var(--cyan); }
      .segment.tone-accent { background: var(--accent); }
      .bar-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }
      .bar-track {
        height: 10px;
        overflow: hidden;
        border-radius: 999px;
        background: var(--surface-tint);
      }
      .bar-fill {
        display: block;
        height: 100%;
        border-radius: 999px;
        background: linear-gradient(90deg, var(--primary) 0%, var(--cyan) 100%);
      }
      .process-grid {
        display: grid;
        grid-template-columns: repeat(6, minmax(0, 1fr));
        gap: 12px;
      }
      .mini-card {
        padding: 18px 16px;
      }
      .mini-card strong {
        display: block;
        font-size: 30px;
        line-height: 1;
      }
      .mini-card span {
        display: block;
        margin-top: 10px;
        font-weight: 700;
      }
      .mini-card small {
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
        background: linear-gradient(135deg, #ffd6de 0%, #dfe5ff 100%);
        color: var(--text);
        font-weight: 800;
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
        grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
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
      td strong { color: var(--text); }
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
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 8px;
      }
      .list-item p {
        margin: 0;
        color: var(--text-soft);
        line-height: 1.48;
      }
      .tone-error-soft {
        border-color: rgba(238, 106, 116, 0.24);
        background: rgba(238, 106, 116, 0.05);
      }
      .tone-warning-soft {
        border-color: rgba(241, 178, 78, 0.24);
        background: rgba(241, 178, 78, 0.08);
      }
      .tone-info-soft {
        border-color: rgba(84, 101, 255, 0.16);
        background: rgba(84, 101, 255, 0.05);
      }
      .empty-state {
        padding: 16px;
        border-radius: 14px;
        border: 1px dashed var(--line-strong);
        color: var(--text-soft);
        background: var(--surface-soft);
      }
      @media (max-width: 1360px) {
        .analytics-grid,
        .tables-grid,
        .dashboard-grid,
        .hero-grid {
          grid-template-columns: 1fr;
        }
        .sidebar {
          position: static;
          height: auto;
        }
        .sidebar-card {
          grid-template-rows: auto;
          height: auto;
        }
      }
      @media (max-width: 1080px) {
        .kpi-strip,
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
          padding: 20px;
        }
        .hero-copy h1 {
          font-size: 36px;
        }
        .hero-copy .subtitle {
          font-size: 16px;
        }
        .kpi-strip,
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

      <section class="dashboard-grid">
        <aside class="sidebar">
          <div class="sidebar-card">
            <div class="sidebar-inner">
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
            </div>
            <div class="sidebar-note">Filtros informativos fijos para mantener contexto mientras recorres métricas, gráficos, sesiones y actividad reciente.</div>
          </div>
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
            <div class="kpi-strip">
              ${viewModel.operationalKpis.map((item) => `
                <article class="kpi-card tone-${escapeHtml(item.tone)}">
                  <small>${escapeHtml(item.label)}</small>
                  <strong>${escapeHtml(item.value)}</strong>
                  <p>${escapeHtml(item.detail)}</p>
                </article>
              `).join('')}
            </div>
          </section>

          <section>
            <div class="analytics-grid">
              <article class="chart-card">
                <h3>${escapeHtml(viewModel.trend.title)}</h3>
                ${renderTrend(viewModel.trend.points)}
              </article>

              <article class="chart-card">
                <h3>Distribución de sesiones</h3>
                ${renderBreakdown(viewModel.sessionBreakdown)}
              </article>

              <article class="chart-card">
                <h3>Actividad comparada</h3>
                ${renderActivityBars(viewModel.activityBars)}
              </article>
            </div>
          </section>

          <section>
            <div class="section-head">
              <div>
                <h2>Proceso de juego</h2>
                <p>Bloques breves y más legibles, sin saturar la pantalla con texto corrido.</p>
              </div>
            </div>
            <div class="process-grid">
              ${viewModel.processStats.map((item) => `
                <article class="mini-card">
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
                <p>Resumen más agradable para detectar rápidamente los chats con mejor actividad.</p>
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
                  <p>Vista priorizada de turnos vivos, ordenados por tiempo restante.</p>
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
                    <article class="list-item tone-error-soft">
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
                  <p>Información más organizada en tabla, no dispersa en texto suelto.</p>
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
                  <p>Eventos ordenados y visualmente separados por tono.</p>
                </div>
              </div>
              <div class="list">
                ${renderRows(
                  viewModel.recentEvents,
                  'No hay eventos recientes todavía.',
                  (event) => `
                    <article class="list-item ${event.level === 'error' ? 'tone-error-soft' : event.level === 'warning' ? 'tone-warning-soft' : 'tone-info-soft'}">
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
