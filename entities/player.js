module.exports = class Player {
  constructor({ id, socketId, nickname = "" }) {
    this.id = id;
    this.socketId = socketId;
    this.nickname = nickname;
    this.cards = [];
    this.disconnected = false;
    this.reconnected = false;
  }
}