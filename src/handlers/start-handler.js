const { createTurnFlow } = require('./turn-flow');

// Handler de /start. No mezcla lógica del juego aquí; solo delega al flujo principal.
function createStartHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function startHandler(ctx) {
    await turnFlow.startSession(ctx);
  };
}

module.exports = {
  createStartHandler
};
