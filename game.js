const connectionPool = require('./database');
const utils = require('./utils');

const isInGame = (socket) => {
  // TODO: Do a better check here.
  // - If in more rooms.
  // - Then check for socket ID in DB to get game.
  // - And check if game is not ended.
  if (Object.keys(socket.rooms).length > 1) {
    return true;
  }

  return false;
}

const createGame = (socket) => () => {
  // REPORT: Deny creating a game, if a room is joined.
  if (isInGame(socket)) {
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

// TODO: Add more checks. Should only allows letters and numbers.
const isValidGameId = (id) => {
  if (!id) {
    return false;
  }

  if (id.length !== 6) {
    return false;
  }

  return true;
}

const joinGame = (socket) => ({ gameId }) => {
  if (isInGame(socket)) {
    console.error(`Cannot join a game, when already connected to another.`);
    return;
  }

  if (!isValidGameId(gameId)) {
    // TODO: Send error message
    console.error('Invalid join code');
    return;
  }

  connectionPool.getConnection((error, connection) => {
    if (error) {
      console.error(`Failed getting pool connection. ${error}`);
      return;
    }

    connection.query("SELECT id, started_at FROM games WHERE code = ?", [gameId], (error, result) => {
      if (error) {
        console.error(`Error while checking if game is started and exists. ${error}`);
        return;
      }

      if (result.length < 1) {
        // TODO: Send error
        console.error('Game does not exist.');
        return;
      }

      const unstartedGame = result.find(game => game.started_at === null);

      if (!unstartedGame) {
        // TODO: Send error
        console.error('Game is already started.');
        return;
      }

      connection.query('INSERT INTO players (session_id, game_id) VALUES (?, ?)', [socket.id, unstartedGame.id], (error, result) => {
        if (error) {
          console.error('Could not create player for game.', error);
          return;
        }

        socket.join(gameId);
        socket.emit('game-joined', { gameId });
        console.log(`Joined game with id: ${gameId}`);
      });
    });
  }); 

}

module.exports = {
  createGame,
  joinGame
}