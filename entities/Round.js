const connectionPool = require("../database");
const Card = require("./card");

module.exports = class Round {
  constructor(gameId, czarId, players) {
    this.gameId = gameId;
    this.czarId = czarId;

    this.moves = players.reduce((moves, player) => {
      if (player.id === czarId) {
        return moves;
      }

      moves[player.id] = null;
      return moves;
    }, {});
  }

  async start() {
    this.card = await this.getBlackCard();
    this.id = await this.create(this.card.id);
  }

  create(cardId) {
    // Create round in rounds table
    const { gameId, czarId } = this;

    return new Promise((resolve, reject) => {
      connectionPool.getConnection((error, connection) => {
        if (error) {
          // TODO: Pass error to frontend
          reject(error);
          return;
        }

        connection.query(
          "INSERT INTO rounds (game_id, card_id, czar_id) VALUES (?, ?, ?)",
          [gameId, cardId, czarId],
          (error, result) => {
            if (error) {
              // TODO: Pass error to frontend
              reject(error);
              return;
            }

            resolve(result.insertId);
          }
        );
      });
    });
  }

  getBlackCard() {
    return new Promise((resolve, reject) => {
      connectionPool.getConnection((error, connection) => {
        if (error) {
          // TODO: Pass error to frontend
          reject(error);
          return;
        }

        connection.query(
          "SELECT id, text FROM cards WHERE type = ? ORDER BY RAND() LIMIT 1",
          ["black"],
          (error, result) => {
            if (error) {
              // TODO: Pass error to frontend
              reject(error);
              return;
            }

            if (result.length < 1) {
              reject(error);
              return;
            }

            resolve(new Card(result[0]));
          }
        );
      });
    });
  }

  makeMove(cardId, player) {
    const { id } = this;

    return new Promise((resolve, reject) => {
      if (this.moves[player.id]) {
        reject("Player already made a move this round.");
        return;
      }

      connectionPool.getConnection((error, connection) => {
        if (error) {
          reject(error);
          return;
        }

        connection.query(
          "INSERT INTO moves (round_id, player_id, card_id) VALUES (?, ?, ?)",
          [id, player.id, cardId],
          (error, result) => {
            if (error) {
              // TODO: Pass error to frontend
              reject(error);
              return;
            }

            this.moves[player.id] = cardId;
            resolve();
          }
        );
      });
    });

  }
};
