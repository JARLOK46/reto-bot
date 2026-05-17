const { createTurnFlow } = require('./turn-flow');

// Handler del comando /start. Su única responsabilidad es delegar al flujo
// principal del juego, para no mezclar la lógica del dominio aquí.
function createStartHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function startHandler(ctx) {
    await turnFlow.startSession(ctx);
  };
}

module.exports = {
  createStartHandler
};
