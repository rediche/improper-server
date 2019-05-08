module.exports = class Player {
  constructor({ id, socketId }) {
    this.id = id;
    this.socketId = socketId;
    this.cards = [];
    this.disconnected = false;
  }
}