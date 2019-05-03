const connectionPool = require("../database");
const Player = require('./player');
const Card = require('./card');
const Round = require('./round');

module.exports = class Game {
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

    // - Give all players 10 white cards. (Only in memory?)
    connectionPool.query(
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
  }

  /**
   * End the game.
   * @returns Promise<void>
   */
  end() {
    const { id } = this;
    return new Promise((resolve, reject) => {
      // Set ended_at in DB
      connectionPool.query(
        'UPDATE games SET ended_at = NOW() WHERE id = ?',
        [id],
        (error, result) => {
          if (error) {
            console.error("Failed to end the game.", error);
            reject(error);
            return;
          }

          // Find winner of game
          this.currentWinner()
            .then((winnerInfo) => {
              resolve(winnerInfo);
            })
            .catch(error => reject(error));
        }
      )
    });
  }

  /**
   * Returns the player who won the most rounds in this game.
   * @returns Promise<void>
   */
  currentWinner() {
    const { id } = this;

    return new Promise((resolve, reject) => {
      connectionPool.query(
        'SELECT COUNT(*) as wins, winner_id FROM `rounds` WHERE game_id = ? GROUP BY winner_id ORDER BY wins DESC LIMIT 1',
        [id],
        (error, result) => {
          if (error) {
            console.error("Could not get current winner of the game.", error);
            reject(error);
            return;
          }

          if (result.length < 1) {
            reject("No winner found.");
            return;
          }

          resolve(result[0]);
        }
      );
    });
  }

  newRound(callback) {
    const { id } = this;

    this.currentRound = new Round(id, this.getNextCzar().id, this.players);
    this.currentRound.start()
      .then(() => {
        this.dealCardsToPlayers(error => {
          if (error) {
            callback(error, this);
            return;
          }
  
          callback(null, this);
        });
      })
      .catch(error => callback(error, this));
  }

  getNextCzar() {
    const { currentRound, players } = this;
    
    if (currentRound) {
      const currentCzarIndex = players.findIndex(player => player.id === currentRound.czarId);

      if (players.length === currentCzarIndex + 1) {
        return players[0];
      } else {
        return players[currentCzarIndex + 1];
      }
    } else {
      return players[0];
    }
  }

  // REPORT: Talk about thoughts for query speed in the DB. 1 request per player, vs 1 big request.
  dealCardsToPlayers(callback) {
    const { started, players } = this;
    const CARD_MAX = 10;

    if (!started) {
      callback("Game has to be started, before cards can be dealt.", this);
      return;
    }

    const missingWhiteCards = players.reduce(
      (total, player) => (total += player.cards.length),
      players.length * CARD_MAX
    );

    connectionPool.query(
      "SELECT id, text FROM cards WHERE type = ? ORDER BY RAND() LIMIT ?",
      ["white", missingWhiteCards],
      (error, result) => {
        if (error) {
          console.error(
            "Could not find random white cards for players.",
            error
          );
          callback(error, this);
          return;
        }

        this.players.map(player => {
          const missingAmount = CARD_MAX - player.cards.length;

          for (let i = 0; i < missingAmount; i++) {
            player.cards.push(new Card(result.splice(0, 1)[0]));
          }
        });

        callback(null, this);
      }
    );
  }

  addPlayer(socketId, callback) {
    const { id } = this;

    connectionPool.query(
      "INSERT INTO players (session_id, game_id) VALUES (?, ?)",
      [socketId, id],
      (error, result) => {
        if (error) {
          console.error("Could not create player for game.", error);
          callback(error);
          return;
        }

        this.players.push(new Player({ id: result.insertId, socketId }));
        callback(null);
      }
    );
  }

  getPlayerBySocket(socketId) {
    const { players } = this;
    return players.find(player => player.socketId === socketId);
  }

  getPlayerById(id) {
    const { players } = this;
    return players.find(player => player.id === id);
  }

  getPlayerByPlayedCard(cardId) {
    const { moves } = this.currentRound;
    const playerId = Number(Object.keys(moves).find(playerId => moves[playerId].id === cardId));

    if (isNaN(playerId)) {
      return null;
    }
    
    return this.getPlayerById(playerId);
  }

  getCardById(cardId) {
    return new Promise((resolve, reject) => {
      connectionPool.query(
        'SELECT * FROM cards WHERE id = ? LIMIT 1',
        [cardId],
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          if (result.length < 1) {
            reject("No card was found.");
            return;
          }

          resolve(result[0]);
        }
      );
    });
  }

  /**
   * Check if a socket is in a game.
   * @param {String} socketId
   * @returns {Boolean}
   */
  hasConnectedSocket(socketId) {
    return !!(this.players.find(player => player.socketId === socketId) || this.host === socketId);
  }
}