const { createTurnFlow } = require('./turn-flow');

// Handler para mensajes de texto. Aquí no se valida la respuesta directamente;
// esa responsabilidad vive en turn-flow para mantener una sola fuente de verdad.
function createMessageHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function messageHandler(ctx) {
    await turnFlow.processTextAnswer(ctx);
  };
}

module.exports = {
  createMessageHandler
};
