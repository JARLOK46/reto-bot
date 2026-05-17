const { createDashboardPresenter } = require('./dashboard-presenter');
const { renderDashboardPage } = require('./dashboard-view');

// Estos helpers simplifican la salida HTTP. Así el controlador decide QUÉ
// responder sin repetir cómo serializar JSON o HTML cada vez.
function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function writeHtml(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(payload);
}

// Punto de entrada del runtime web. Decide si devolver salud, snapshot,
// dashboard o delegar el POST del webhook al bot de Telegram.
function createDashboardController(options = {}) {
  const now = options.now ?? (() => Date.now());
  let webhookHandler = options.webhookHandler ?? null;
  const presenter = options.presenter ?? createDashboardPresenter();

  // Obtiene un snapshot serializable del proceso actual. El estado sigue
  // siendo efímero: solo expone lo que vive en memoria en ESTE proceso.
  function buildSnapshot() {
    return options.sessionStore.getSnapshot({
      now: now(),
      processStartedAt: options.processStartedAt,
      gameConfig: options.gameConfig
    });
  }

  // Construye un payload corto para health checks humanos o automáticos.
  function buildHealthPayload() {
    const snapshot = buildDashboardSnapshot();
    const botState = snapshot.telegram ?? {};

    return {
      ok: true,
      service: 'reto-bot',
      generatedAt: new Date(now()).toISOString(),
      uptimeSeconds: snapshot.sessions?.uptimeSeconds ?? 0,
      telegram: {
        mode: botState.mode ?? 'unknown',
        status: botState.status ?? 'unknown',
        launchAttempts: botState.launchAttempts ?? 0,
        connectedAt: botState.connectedAt ?? null,
        lastError: botState.lastError ?? null
      },
      sessions: {
        total: snapshot.sessions?.counts?.total ?? 0,
        active: snapshot.sessions?.counts?.active ?? 0,
        ended: snapshot.sessions?.counts?.ended ?? 0,
        expired: snapshot.sessions?.counts?.expired ?? 0
      }
    };
  }

  function buildDashboardSnapshot() {
    // Junta en una sola “foto” todo lo que necesita el dashboard.
    return {
      generatedAt: new Date(now()).toISOString(),
      telegram: options.botState ?? null,
      sessions: buildSnapshot(),
      observability: options.observabilityStore?.getSnapshot() ?? null
    };
  }

  return {
    setWebhookHandler(handler) {
      // El webhook real solo se conecta cuando Telegram termina de registrarse.
      webhookHandler = handler;
    },
    handle(request, response) {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const isHealthRoute = requestUrl.pathname === '/' || requestUrl.pathname === '/health' || requestUrl.pathname === '/api/health';

      // En modo webhook, Telegram entrega updates por POST al path configurado.
      // Si el handler todavía no quedó listo, devuelve 503 para que sea obvio.
      if (request.method === 'POST' && requestUrl.pathname === options.webhookPath) {
        if (!webhookHandler) {
          writeJson(response, 503, { ok: false, error: 'Webhook handler not ready' });
          return;
        }

        webhookHandler(request, response);
        return;
      }

      // El resto de rutas son de solo lectura; cualquier otro método se rechaza.
      if (!['GET', 'HEAD'].includes(request.method)) {
        writeJson(response, 405, { error: 'Method Not Allowed' });
        return;
      }

      if (isHealthRoute) {
        writeJson(response, 200, buildHealthPayload());
        return;
      }

      if (requestUrl.pathname === '/api/snapshot') {
        writeJson(response, 200, buildDashboardSnapshot());
        return;
      }

      if (requestUrl.pathname === '/dashboard') {
        writeHtml(response, 200, renderDashboardPage(presenter.present(buildDashboardSnapshot())));
        return;
      }

      writeJson(response, 404, { ok: false, error: 'Not Found' });
    }
  };
}

module.exports = {
  createDashboardController
};
