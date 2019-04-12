const connectionPool = require("./database");
const utils = require("./utils");
const io = require("./server").io;

// REPORT: Talk about the currentGames array and how it keeps state in the backend.
const currentGames = [];

class Game {
  constructor({ host, code, id }) {
    this.host = host;
    this.code = code;
    this.id = id;
    this.started = false;
    this.players = [];
  }

  start(callback) {
    const { id, started } = this;

    if (started) {
      callback("Game is already started.", this);
      return;
    }

    connectionPool.getConnection((error, connection) => {
      if (error) {
        // TODO: Send error to frontend
        console.error("Failed to get connection to database.", error);
        callback(error, this);
        return;
      }
      
      // - Give all players 10 white cards. (Only in memory?)
      connection.query(
        "UPDATE games SET started_at = NOW() WHERE id = ?",
        [id],
        (error, result) => {
          if (error) {
            console.error("Failed to start game.", error);
            callback(error, this);
            return;
          }

          this.started = true;

          callback(null, this);
        }
      );
    });
  }

  addPlayer(socketId, callback) {
    const { id } = this;

    connectionPool.getConnection((error, connection) => {
      if (error) {
        console.error(`Failed getting pool connection. ${error}`);
        callback(error);
        return;
      }

      connection.query(
        "INSERT INTO players (session_id, game_id) VALUES (?, ?)",
        [socketId, id],
        (error, result) => {
          if (error) {
            console.error("Could not create player for game.", error);
            callback(error);
            return;
          }

          this.players.push(new Player({ id: socketId }));
          callback(null);
        }
      );
    });
  }
}

class Player {
  constructor({ id }) {
    this.id = id;
    this.cards = [];
  }
}

class Card {
  constructor({ id, text }) {
    this.id = id;
    this.text = text;
  }
}

const isInGame = socket => {
  // TODO: Do a better check here.
  // - If in more rooms.
  // - Then check for socket ID in DB to get game.
  // - And check if game is not ended.
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

  // TODO: If already existing with not ended_at value, try again.
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

// TODO: Add more checks. Should only allows letters and numbers.
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
    console.log("Game is started!", game.code);
    socket
      .emit("game-started")
      .to(game.code)
      .emit("game-started");
  });
};

module.exports = {
  createGame,
  joinGame,
  startGame
};
