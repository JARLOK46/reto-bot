function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function writeText(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'text/plain; charset=utf-8' });
  response.end(payload);
}

function createDashboardController(options = {}) {
  const now = options.now ?? (() => Date.now());
  let webhookHandler = options.webhookHandler ?? null;

  function buildSnapshot() {
    return options.sessionStore.getSnapshot({
      now: now(),
      processStartedAt: options.processStartedAt,
      gameConfig: options.gameConfig
    });
  }

  function buildHealthPayload() {
    const snapshot = buildSnapshot();
    const botState = options.botState ?? {};

    return {
      ok: true,
      service: 'reto-bot',
      generatedAt: new Date(now()).toISOString(),
      uptimeSeconds: snapshot.uptimeSeconds,
      telegram: {
        mode: botState.mode ?? 'unknown',
        status: botState.status ?? 'unknown',
        launchAttempts: botState.launchAttempts ?? 0,
        connectedAt: botState.connectedAt ?? null,
        lastError: botState.lastError ?? null
      },
      sessions: {
        total: snapshot.counts?.total ?? 0,
        active: snapshot.counts?.active ?? 0,
        ended: snapshot.counts?.ended ?? 0,
        expired: snapshot.counts?.expired ?? 0
      }
    };
  }

  return {
    setWebhookHandler(handler) {
      webhookHandler = handler;
    },
    handle(request, response) {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');
      const isHealthRoute = requestUrl.pathname === '/' || requestUrl.pathname === '/health' || requestUrl.pathname === '/api/health';

      if (request.method === 'POST' && requestUrl.pathname === options.webhookPath) {
        if (!webhookHandler) {
          writeJson(response, 503, { ok: false, error: 'Webhook handler not ready' });
          return;
        }

        webhookHandler(request, response);
        return;
      }

      if (!['GET', 'HEAD'].includes(request.method)) {
        writeJson(response, 405, { error: 'Method Not Allowed' });
        return;
      }

      if (isHealthRoute) {
        writeJson(response, 200, buildHealthPayload());
        return;
      }

      if (requestUrl.pathname === '/api/snapshot') {
        writeJson(response, 200, {
          ...buildSnapshot(),
          telegram: options.botState ?? null
        });
        return;
      }

      if (requestUrl.pathname === '/dashboard') {
        writeText(response, 410, 'Dashboard removed. Use /health or /api/snapshot.');
        return;
      }

      writeJson(response, 404, { ok: false, error: 'Not Found' });
    }
  };
}

module.exports = {
  createDashboardController
};
