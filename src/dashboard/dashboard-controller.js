const { createDashboardPresenter } = require('./dashboard-presenter');
const { renderDashboardPage } = require('./dashboard-view');

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function writeHtml(response, statusCode, payload) {
  response.writeHead(statusCode, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(payload);
}

function createDashboardController(options = {}) {
  const now = options.now ?? (() => Date.now());
  const presenter = options.presenter ?? createDashboardPresenter();

  function buildSnapshot() {
    return options.sessionStore.getSnapshot({
      now: now(),
      processStartedAt: options.processStartedAt,
      gameConfig: options.gameConfig
    });
  }

  return {
    handle(request, response) {
      const requestUrl = new URL(request.url, 'http://127.0.0.1');

      if (request.method !== 'GET') {
        writeJson(response, 405, { error: 'Method Not Allowed' });
        return;
      }

      if (requestUrl.pathname === '/api/health') {
        writeJson(response, 200, {
          ok: true,
          uptimeSeconds: buildSnapshot().uptimeSeconds
        });
        return;
      }

      if (requestUrl.pathname === '/api/snapshot') {
        writeJson(response, 200, buildSnapshot());
        return;
      }

      if (requestUrl.pathname === '/dashboard') {
        const snapshot = buildSnapshot();
        const viewModel = presenter.present(snapshot);
        writeHtml(response, 200, renderDashboardPage(viewModel));
        return;
      }

      writeJson(response, 404, { error: 'Not Found' });
    }
  };
}

module.exports = {
  createDashboardController
};
