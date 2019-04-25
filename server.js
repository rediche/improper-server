require('dotenv').config(); // Load environment variables straight away
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const gameEvents = require('./game-events');

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/demo.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', gameEvents.disconnect(socket));

  socket.on('create-game', gameEvents.createGame(socket));
  socket.on('join-game', gameEvents.joinGame(socket));
  socket.on('start-game', gameEvents.startGame(socket));
  socket.on('card-selected', gameEvents.cardSelected(socket));
  socket.on('winner-selected', gameEvents.winnerSelected(socket));
  socket.on('end-game', gameEvents.endGame(socket));
});

http.listen(PORT, () => {
  console.log(`Listening on *:${PORT}`);
});