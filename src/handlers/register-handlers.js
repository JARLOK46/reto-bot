const { createCallbackHandler } = require('./callback-handler');
const { createMessageHandler } = require('./message-handler');
const { createStartHandler } = require('./start-handler');

// Conecta cada tipo de update de Telegram con la parte correcta del flujo.
// En la práctica, este archivo funciona como tabla de enrutamiento del bot.
function registerHandlers(bot, dependencies) {
  const startHandler = createStartHandler(dependencies);
  const messageHandler = createMessageHandler(dependencies);
  const callbackHandler = createCallbackHandler(dependencies);

  // /start crea o reinicia una sesión.
  bot.start(startHandler);
  // Los botones inline de respuesta usan un payload answer:...
  bot.action(/^answer:/, callbackHandler);
  // Cualquier texto normal se intenta interpretar como respuesta escrita.
  bot.on('text', messageHandler);
}

module.exports = {
  registerHandlers
};
