const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: 'http://localhost:3000', // ou '*' en dev
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('Client connecté :', socket.id);

  socket.on('disconnect', (raison) => {
    console.log('Client déconnecté :', raison);
  });
});

httpServer.listen(3000, () => {
  console.log('Serveur démarré sur http://localhost:3000');
});