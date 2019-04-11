const connectionPool = require('./database');
const utils = require('./utils');

const createGame = (socket) => () => {
  // REPORT: Deny creating a game, if a room is joined.
  if (Object.keys(socket.rooms).length > 1) {
    console.error(`Cannot create a game, when already connected to another.`);
    return;
  }

  const id = utils.makeId(6);

  // TODO: If already existing with not ended_at value, try again.
  connectionPool.getConnection((error, connection) => {
    if (error) {
      console.error(`Failed getting pool connection. ${error}`);
      return;
    }

    connection.query("INSERT INTO games (code) VALUES (?)", [id], (error, result) => {
      if (error) {
        console.error(`Could not create new game. ${error}`);
        return;
      }
      
      socket.join(id);
      socket.emit('game-created', { id });
      console.log(`Created a game with ID: ${id}`);
    });
  });
}

module.exports = {
  createGame
}