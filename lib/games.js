module.exports = function (options, STATE) {

  var MANAGER = {};

  /**
   * Saves a game result for the given players
   *
   * @param {Array} players_ids (null to add to all players on the given room)
   * @param {Object} game
   */
  MANAGER.saveGame = function (players_ids, game) {
    Object.keys(STATE.players).filter(function (player) {
      return players_ids ? players_ids.indexOf(player) : true;
    }).forEach(function (player) {
      options.db.users.update({_id: player._id}, {'$push': {games: game}});
    });
  };

  return MANAGER;
};
