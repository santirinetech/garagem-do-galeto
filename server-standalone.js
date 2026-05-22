const { startServer } = require('./src/server');

// Inicia o servidor Express em modo Headless (sem janela do Electron)
// Ideal para rodar no PM2 no servidor do cliente.
startServer();
