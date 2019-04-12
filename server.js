require('dotenv').config(); // Load environment variables straight away
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const gameEvents = require('./game-events');

const hostname = '127.0.0.1';
const port = 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/demo.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });

  socket.on('create-game', gameEvents.createGame(socket));
  socket.on('join-game', gameEvents.joinGame(socket));
  socket.on('start-game', gameEvents.startGame(socket));
});

http.listen(3000, () => {
  console.log("Listening on *:3000");
});