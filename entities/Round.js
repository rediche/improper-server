const connectionPool = require("../database");
const Card = require("./card");

module.exports = class Round {
  constructor(gameId) {
    this.gameId = gameId;
  }

  async start() {
    this.card = await this.getBlackCard();
    this.id = await this.create(this.card.id);
  }

  create(cardId) {
    // Create round in rounds table
    const { gameId } = this;

    return new Promise((resolve, reject) => {
      connectionPool.getConnection((error, connection) => {
        if (error) {
          // TODO: Pass error to frontend
          reject(error);
          return;
        }

        connection.query(
          "INSERT INTO rounds (game_id, card_id) VALUES (?, ?)",
          [gameId, cardId],
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
};
