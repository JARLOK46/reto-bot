const { createTurnFlow } = require('./turn-flow');

// Handler para respuestas por botones inline. Igual que el de texto, delega el
// trabajo real al flujo compartido del juego.
function createCallbackHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function callbackHandler(ctx) {
    await turnFlow.processCallbackAnswer(ctx);
  };
}

module.exports = {
  createCallbackHandler
};
