const connectionPool = require("./database");
const utils = require("./utils");
const Game = require('./entities/game');

// REPORT: Talk about the currentGames array and how it keeps state in the backend.
const currentGames = [];

const disconnect = socket => () => {
  console.log('A user disconnected');

  const hostedGame = currentGames.find(game => game.host === socket.id);

  if (hostedGame) {
    console.log("Host disconnected. Stopping game.");
    endGame(socket)({ gameCode: hostedGame.code });
    return;
  }

  const playingGame = currentGames.find(game => game.hasConnectedSocket(socket.id));

  if (!playingGame) {
    return;
  }

  const player = playingGame.getPlayerBySocketId(socket.id);

  if (!player) {
    console.log("Could not disconnect player from game.");
    return;
  }

  player.disconnected = true;
}

const isInGame = socket => {
  return !!currentGames.find(game => game.hasConnectedSocket(socket.id));
};

const createGame = socket => () => {
  // REPORT: Deny creating a game, if a room is joined.
  if (isInGame(socket)) {
    sendError(socket)("You are already connected to a game.");
    return;
  }

  const id = utils.makeId(6);

  createGameDB(id, (error, { code, id }) => {
    if (error) {
      sendError(socket)("Could not create the game.");
      return;
    }

    const game = new Game({ host: socket.id, code, id });
    currentGames.push(game);
    socket.join(code);
    socket.emit("game-created", { code });
  });
};

const createGameDB = (code, callback) => {
  connectionPool.query(
    "INSERT INTO games (code) VALUES (?)",
    [code],
    (error, result) => {
      if (error) {
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

const joinGame = socket => ({ code, nickname }, callback) => {
  if (isInGame(socket)) {
    sendError(socket)("You are already connected to a game.");
    return;
  }
  
  if (!isValidGameCode(code)) {
    sendError(socket)("Invalid game code.");
    return;
  }

  if (currentGames.length < 1) {
    sendError(socket)("Game does not exist.");
    return;
  }

  const unstartedGame = currentGames.find(
    game => game.started === false && game.code.toLowerCase() === code.toLowerCase()
  );

  if (!unstartedGame) {
    sendError(socket)("Game is already started.");
    return;
  }

  unstartedGame.addPlayer(socket.id, (error, playerId) => {
    if (error) {
      sendError(socket)("Could not add player to game.");
      return;
    };

    socket.join(code);
    socket.to(unstartedGame.host).emit("player-connected", { playerCount: unstartedGame.players.length });
    callback({ gameCode: code, playerId, nickname });
  }, { nickname });
};

const startGame = socket => () => {
  // Check if socket is a host
  const hostingGame = currentGames.find(game => game.host === socket.id);
  
  if (!hostingGame) {
    sendError(socket)("You are not hosting any games.");
    return;
  }
  
  if (hostingGame.players.length < 3) {
    sendError(socket)("At least 3 players needs to join the game.");
    return;
  }
  
  hostingGame.start((error, game) => {
    if (error) {
      sendError(socket)("Could not start the game.");
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
    sendError(socket)("Could not start new round.");
    return;
  }

  game.players.map(player => player.reconnected = false);

  game.newRound(newRoundEmits(socket));
}

const newRoundEmits = (socket) => (error, game) => {
  if (error) {
    sendError(socket)("Could not start new round.");
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
    sendError(socket)("Failed to select card.");
    return;
  }

  const player = game.players.find(player => player.socketId === socket.id);

  if (!player) {
    sendError(socket)("Failed to select card.");
    return;
  }

  game.currentRound.makeMove(id, player)
    .then(() => {
      socket.emit('card-played', { id });

      const playedCards = game.currentRound.getPlayedCards(game.players);
      socket.to(game.host).emit('card-played-host', { playedCards });

      if (game.currentRound.allMovesMade(game.players)) {
        socket
          .emit('find-winner', { playedCards })
          .to(game.code)
          .emit('find-winner', { playedCards });
      }
    })
    .catch(error => sendError(socket)("Failed to select card."));
}

const winnerSelected = (socket) => ({ cardId, gameCode }) => {
  const game = findGameByCode(gameCode);

  if (!game) {
    sendError(socket)("Failed to select winner.");
    return;
  }

  const player = game.getPlayerByPlayedCard(cardId);

  if (!player) {
    sendError(socket)("Failed to select winner.");
    return;
  }

  game.currentRound.setWinner(player, game.players)
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
        .catch(error => sendError(socket)("Failed to select winner."));
    })
    .catch(error => sendError(socket)("Failed to select winner."));
}

const findGameByCode = (code) => {
  return currentGames.find(game => game.code.toLowerCase() === code.toLowerCase());
}

const endGame = (socket) => ({ gameCode }) => {
  const game = findGameByCode(gameCode);

  if (!game) {
    sendError(socket)("Could not end the game.");
    return; 
  }

  const gameIndex = currentGames.findIndex(lookupGame => lookupGame.id === game.id);

  if (!game.started) {
    socket
      .emit('game-ended')
      .to(game.code)
      .emit('game-ended');

    if (gameIndex !== -1) {
      currentGames.splice(gameIndex, 1);
    }

    return;
  }

  game.end()
    .then((winnerInfo) => {
      socket
        .emit('game-ended', { winner: winnerInfo.winner_id, wins: winnerInfo.wins })
        .to(game.code)
        .emit('game-ended', { winner: winnerInfo.winner_id, wins: winnerInfo.wins });

      const gameIndex = currentGames.findIndex(lookupGame => lookupGame.id === game.id);

      if (gameIndex !== -1) {
        currentGames.splice(gameIndex, 1);
      }
    })
    .catch(error => sendError(socket)("Could not end the game."));
}

const sendError = (socket) => (errorMessage) => {
  socket.emit("error-message", { errorMessage });
}

const reconnectGame = (socket) => ({ gameCode, playerId }, callback) => {
  const game = findGameByCode(gameCode);

  if (!game) {
    callback({ reconnected: false });
    return;
  }

  const player = game.getPlayerById(playerId);

  if (!player) {
    callback({ reconnected: false });
    return;
  }

  player.socketId = socket.id;
  player.disconnected = false;
  player.reconnected = true;

  socket.join(gameCode);

  callback({ reconnected: true });
}

module.exports = {
  createGame,
  joinGame,
  startGame,
  disconnect,
  cardSelected,
  winnerSelected,
  endGame,
  reconnectGame
};
