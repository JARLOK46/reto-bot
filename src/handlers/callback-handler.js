const { createTurnFlow } = require('./turn-flow');

function createCallbackHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function callbackHandler(ctx) {
    await turnFlow.processCallbackAnswer(ctx);
  };
}

module.exports = {
  createCallbackHandler
};
