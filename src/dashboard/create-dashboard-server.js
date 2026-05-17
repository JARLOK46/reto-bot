const http = require('node:http');

// Crea un servidor HTTP mínimo usando el módulo nativo de Node. El objetivo no
// es tener un framework web completo, sino un runtime simple para dashboard,
// webhook y health checks.
function createDashboardServer(options = {}) {
  const host = options.host ?? '0.0.0.0';
  const logger = options.logger ?? console;
  const server = http.createServer((request, response) => {
    options.controller.handle(request, response);
  });

  let listening = false;

  return {
    async start() {
      // Espera explícitamente a que el servidor quede “listening” antes de
      // devolver control, así otros módulos pueden usarlo con seguridad.
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
      // Si nunca llegó a iniciar, no intentamos cerrarlo porque Node lanzaría
      // errores innecesarios.
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
      // Útil en tests cuando se usa puerto 0 y Node asigna uno libre.
      return server.address();
    }
  };
}

module.exports = {
  createDashboardServer
};
