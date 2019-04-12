require('dotenv').config(); // Load environment variables straight away
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const game = require('./game');

const hostname = '127.0.0.1';
const port = 3000;

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/demo.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('create-game', game.createGame(socket));
  socket.on('join-game', game.joinGame(socket));
  socket.on('start-game', game.startGame(socket));
  /* TODO: Play a card
           - An entry is made for the player in the moves table.
  */
});

http.listen(3000, () => {
  console.log("Listening on *:3000");
});

/* const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end("Hello world"); */

  /* connectionPool.getConnection((error, connection) => {
    if (error) {
      console.error(`Failed getting pool connection. ${error}`);
      return;
    }

    connection.query('SELECT * FROM cards WHERE type = "white"', (error, results, fields) => {
      if (error) {
        console.error(error);
        return;
      }
    
      res.end(JSON.stringify(results));
    
      connection.release();
    });
  }); */
//});

/* server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
}); */