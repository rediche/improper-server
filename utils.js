// https://stackoverflow.com/a/1349426
const makeId = (length) => {
  var text = "";
  var possible = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

module.exports = {
  makeId
};