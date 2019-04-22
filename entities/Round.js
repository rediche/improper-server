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

  getCzarSocketId(players) {
    const { czarId } = this;
    return players.find(player => player.id === czarId).socketId;
  }

  create(cardId) {
    // Create round in rounds table
    const { gameId, czarId } = this;

    return new Promise((resolve, reject) => {
      connectionPool.query(
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
  }

  getBlackCard() {
    return new Promise((resolve, reject) => {
      connectionPool.query(
        "SELECT id, text FROM cards WHERE type = ? ORDER BY RAND() LIMIT 1",
        ["black"],
        (error, result) => {
          if (error) {
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
  }

  makeMove(cardId, player) {
    const { id, moves } = this;

    return new Promise((resolve, reject) => {
      if (moves[player.id]) {
        reject("Player already made a move this round.");
        return;
      }

      const hasCardOnHand = player.cards.find(card => card.id === cardId);
      if (!hasCardOnHand) {
        reject("Player does not have the card on hand.");
        return;
      }

      connectionPool.query(
        "INSERT INTO moves (round_id, player_id, card_id) VALUES (?, ?, ?)",
        [id, player.id, cardId],
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          this.moves[player.id] = player.cards.find(card => card.id === cardId);
          player.cards = player.cards.filter(card => card.id !== cardId);

          resolve();
        }
      );
    });
  }

  setWinner(player) {
    const { id } = this;

    console.log("Pre promise");
    return new Promise((resolve, reject) => {
      console.log("In promise");
      if (!this.allMovesMade()) {
        reject("Not all moves have been made this round.");
        return;
      }
      
      console.log("All moves made");

      connectionPool.query(
        "UPDATE rounds SET winner_id = ? WHERE id = ?",
        [player.id, id],
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          console.log("RESOLVE");

          resolve();
        }
      );
    });
  }

  getPlayedCards(players) {
    const { moves } = this;
  
    return Object.keys(moves).reduce((playedCards, key) => {
      return [...playedCards, moves[key]];
    }, []);
  }

  allMovesMade() {
    const { moves } = this;

    return Object.keys(moves).every(key => moves[key] !== null);
  }
};
