const connectionPool = require("./database");
const utils = require("./utils");
const Game = require('./entities/game');

// REPORT: Talk about the currentGames array and how it keeps state in the backend.
const currentGames = [];

const isInGame = socket => {
  if (Object.keys(socket.rooms).length > 1) {
    return true;
  }

  return false;
};

const createGame = socket => () => {
  // REPORT: Deny creating a game, if a room is joined.
  if (isInGame(socket)) {
    console.error(`Cannot create a game, when already connected to another.`);
    return;
  }

  const id = utils.makeId(6);

  createGameDB(id, (error, { code, id }) => {
    if (error) {
      return;
    }

    const game = new Game({ host: socket.id, code, id });
    currentGames.push(game);
    socket.join(code);
    socket.emit("game-created", { code });
    console.log(`Created a game with code: ${code}`);
  });
};

const createGameDB = (code, callback) => {
  connectionPool.getConnection((error, connection) => {
    if (error) {
      console.error(`Failed getting pool connection. ${error}`);
      callback(error, null);
      return;
    }

    connection.query(
      "INSERT INTO games (code) VALUES (?)",
      [code],
      (error, result) => {
        if (error) {
          console.error(`Could not create new game. ${error}`);
          callback(error, null);
          return;
        }

        callback(null, { code, id: result.insertId });
      }
    );
  });
};

const isValidGameCode = code => {
  if (!code) {
    return false;
  }

  if (code.length !== 6) {
    return false;
  }

  return true;
};

const joinGame = socket => ({ code }) => {
  if (isInGame(socket)) {
    console.error(`Cannot join a game, when already connected to another.`);
    return;
  }

  if (!isValidGameCode(code)) {
    // TODO: Send error message
    console.error("Invalid join code");
    return;
  }

  if (currentGames.length < 1) {
    // TODO: Send error
    console.error("Game does not exist.");
    return;
  }

  const unstartedGame = currentGames.find(
    game => game.started === false && game.code === code
  );

  if (!unstartedGame) {
    // TODO: Send error to client
    console.error("Game is already started.");
    return;
  }

  unstartedGame.addPlayer(socket.id, () => {
    socket.join(code);
    socket.emit("game-joined", { code });
    console.log(`Joined game with id: ${code}`);
  });
};

/* TODO: Start game
 */
const startGame = socket => () => {
  // Check if socket is a host
  const hostingGame = currentGames.find(game => game.host === socket.id);

  if (!hostingGame) {
    // TODO: Send error
    console.error("You are not hosting any games.");
    return;
  }

  console.log(hostingGame);

  if (hostingGame.players.length < 2) {
    // TODO: Send error
    console.error("At least 2 players need to join the game.");
    return;
  }

  hostingGame.start((error, game) => {
    if (error) {
      // TODO: Send error message
      console.log("Error:", error);
      return;
    }

    socket
      .emit("game-started")  // Emit to hosting socket.
      .to(game.code)
      .emit("game-started"); // Emit to all other sockets in game.
  });
};

module.exports = {
  createGame,
  joinGame,
  startGame
};
