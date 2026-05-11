const { createTurnFlow } = require('./turn-flow');

function createStartHandler(dependencies) {
  const turnFlow = createTurnFlow(dependencies);

  return async function startHandler(ctx) {
    await turnFlow.startSession(ctx);
  };
}

module.exports = {
  createStartHandler
};
