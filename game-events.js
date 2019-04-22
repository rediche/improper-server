const connectionPool = require("./database");
const utils = require("./utils");
const Game = require('./entities/game');

// REPORT: Talk about the currentGames array and how it keeps state in the backend.
const currentGames = [];

const disconnect = socket => () => {
  console.log('A user disconnected');

  const hostedGameIndex = currentGames.findIndex(game => game.host === socket.id);

  // TODO: End the game, in the DB too.
  // TODO: Emit to all players, that the host has disconnected.
  if (hostedGameIndex !== -1) {
    currentGames.splice(hostedGameIndex, 1);
    console.log("Game has been stopped. Host disconnected.");
  }
}

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
      console.error('Could not create game', error);
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
  connectionPool.query(
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

const startGame = socket => () => {
  // Check if socket is a host
  const hostingGame = currentGames.find(game => game.host === socket.id);
  
  if (!hostingGame) {
    // TODO: Send error
    console.error("You are not hosting any games.");
    return;
  }
  
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

    newRound(socket)();
  });
};

const newRound = (socket) => () => {
  // Find game
  const game = currentGames.find(game => game.host === socket.id);

  if (!game) {
    // TODO: Emit error
    console.error('Could not find game');
    return;
  }

  game.newRound(newRoundEmits(socket));
}

const newRoundEmits = (socket) => (error, game) => {
  if (error) {
    console.error("Could not start new game", error);
    return;
  }

  if (game.host === socket.id) {
    socket.emit("new-round-host", { blackCard: game.currentRound.card });
  } else {
    socket.to(game.host).emit("new-round-host", { blackCard: game.currentRound.card });
  }

  // Emit each individual player.
  const czar = game.currentRound.getCzarSocketId(game.players);
  game.players.map(player =>  {
    if (player.socketId === socket.id) {
      socket.emit("new-round", { cards: player.cards, czar });
    } else {
      socket
        .to(player.socketId)
        .emit("new-round", { cards: player.cards, czar });
    }
  });
}

const cardSelected = (socket) => ({ id }) => {
  const game = currentGames.find(game => {
    return game.players.find(player => player.socketId === socket.id);
  });

  if (!game) {
    // TODO: Emit error
    console.error("Could not find game.");
    return;
  }

  const player = game.players.find(player => player.socketId === socket.id);

  if (!player) {
    // TODO: Emit error
    console.error("Player not found.");
    return;
  }

  game.currentRound.makeMove(id, player)
    .then(() => {
      socket.emit('card-played', { id });

      const playedCards = game.currentRound.getPlayedCards(game.players);
      socket.to(game.host).emit('card-played-host', { playedCards });
      
      if (game.currentRound.allMovesMade()) {
        socket
          .emit('find-winner', { playedCards })
          .to(game.code)
          .emit('find-winner', { playedCards });
      }
    })
    .catch(error => console.error(error)); // TODO: Send error to frontend;
}

const winnerSelected = (socket) => ({ cardId, gameCode }) => {
  const game = findGameByCode(gameCode);

  if (!game) {
    console.error("Game was not found."); // TODO: Send error to frontend.
    return;
  }

  const player = game.getPlayerByPlayedCard(cardId);

  if (!player) {
    console.error("Player was not found."); // TODO: Send error to frontend.
    return;
  }

  game.currentRound.setWinner(player)
    .then(() => {
      game.getCardById(cardId)
        .then((winningCard) => {
          socket
            .emit('winner-found', { card: winningCard })
            .to(game.code)
            .emit('winner-found', { card: winningCard });
    
          setTimeout(() => {
            game.newRound(newRoundEmits(socket));
          }, 3000);
        })
        .catch(error => console.error(error)); // TODO: Send error to frontend.
    })
    .catch(error => console.error(error)); // TODO: Send error to frontend.
}

const findGameByCode = (code) => {
  return currentGames.find(game => game.code === code);
}

const endGame = (socket) => ({ gameCode }) => {
  const game = findGameByCode(gameCode);

  if (!game) {
    console.error("Could not find game."); // TODO: Send error to frontend.
    return; 
  }

  game.end()
    .then((winnerInfo) => {
      console.log("Game ended!", winnerInfo);
      socket
        .emit('game-ended', { winner: winnerInfo.winner_id, wins: winnerInfo.wins })
        .to(game.code)
        .emit('game-ended', { winner: winnerInfo.winner_id, wins: winnerInfo.wins });
      

      const gameIndex = currentGames.findIndex(lookupGame => lookupGame.id === game.id);

      if (gameIndex !== -1) {
        currentGames.splice(gameIndex, 1);
      }
    })
    .catch(error => console.error(error)); // TODO: Send error to frontend.
}

module.exports = {
  createGame,
  joinGame,
  startGame,
  disconnect,
  cardSelected,
  winnerSelected,
  endGame
};
