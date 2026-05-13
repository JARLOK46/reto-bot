const http = require('node:http');

function createDashboardServer(options = {}) {
  const host = options.host ?? '0.0.0.0';
  const logger = options.logger ?? console;
  const server = http.createServer((request, response) => {
    options.controller.handle(request, response);
  });

  let listening = false;

  return {
    async start() {
      await new Promise((resolve, reject) => {
        function cleanup() {
          server.off('error', onError);
          server.off('listening', onListening);
        }

        function onError(error) {
          cleanup();
          reject(error);
        }

        function onListening() {
          cleanup();
          listening = true;
          resolve();
        }

        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(options.port, host);
      });

      const address = server.address();
      logger.info?.('Dashboard runtime listening', {
        host,
        port: address?.port
      });

      return address;
    },
    async stop() {
      if (!listening) {
        return;
      }

      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }

          resolve();
        });
      });

      listening = false;
    },
    getAddress() {
      return server.address();
    }
  };
}

module.exports = {
  createDashboardServer
};
