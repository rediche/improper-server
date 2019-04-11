require('dotenv').config(); // Load environment variables straight away

const http = require('http');
const connectionPool = require('./database');

const hostname = '127.0.0.1';
const port = 3000;

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');

  connectionPool.getConnection((error, connection) => {
    if (error) {
      console.error(`Failed getting pool connection. ${error}`);
      return;
    }

    connection.query('SELECT * FROM cards WHERE type = "white"', (error, results, fields) => {
      if (error) {
        console.error(error);
        return;
      }
    
      console.log(results);
      res.end(JSON.stringify(results));
    
      connection.release();
    });
  });
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}`);
});