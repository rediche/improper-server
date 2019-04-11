require('dotenv').config(); // Load environment variables straight away
const app = require('express')();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const connectionPool = require('./database');
const utils = require('./utils');

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

  socket.on('create-game', () => {
    console.log('Create a new game!');
    const id = utils.makeId(6);

    // TODO: If already existing with not ended_at value, try again.
    const query = "INSERT INTO games (code) VALUES (?)";
    const values = [id];
    connectionPool.getConnection((error, connection) => {
      if (error) {
        console.error(`Failed getting pool connection. ${error}`);
        return;
      }

      connection.query(query, values, (error, result) => {
        if (error) {
          console.error(`Could not create new game. ${error}`);
          return;
        }
        
        console.log(id);
        socket.join(id);
        socket.emit('game-created', { id });
      });
    });

  });
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