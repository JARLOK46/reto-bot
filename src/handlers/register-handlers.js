const { createCallbackHandler } = require('./callback-handler');
const { createMessageHandler } = require('./message-handler');
const { createStartHandler } = require('./start-handler');

function registerHandlers(bot, dependencies) {
  const startHandler = createStartHandler(dependencies);
  const messageHandler = createMessageHandler(dependencies);
  const callbackHandler = createCallbackHandler(dependencies);

  bot.start(startHandler);
  bot.action(/^answer:/, callbackHandler);
  bot.on('text', messageHandler);
}

module.exports = {
  registerHandlers
};
