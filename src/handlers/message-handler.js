const { createTurnFlow } = require('./turn-flow');

function createMessageHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function messageHandler(ctx) {
    await turnFlow.processTextAnswer(ctx);
  };
}

module.exports = {
  createMessageHandler
};
