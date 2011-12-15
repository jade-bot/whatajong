module.exports = function (options, STATE) {

  var MANAGER = {}
    , db = options.db;

  /**
   * Creates an empty score
   *
   * @param {Number} user_id
   * @param {Function} cb
   */
  MANAGER.createScore = function (user, cb) {
    var funk = require('funk')('parallel');

    db.scores.insert({user: user, created_at: Date.now()}, funk.result('score'));
    db.statistics.update(
      {'$or': [{'user._id': user._id}, {user: {'$exists': false}}]}
    , {'$inc': {total_games: 1}, '$set': {updated_at: Date.now()}}
    , {multi: true}
    , funk.nothing()
    );

    funk.run(function () {
      cb(null, this.score[0]);
    }, cb);
  };

  /**
   * Saves the puntuation of the finished game
   *
   * @param {Number} user_id
   * @param {Number} score_id
   * @param {Number} puntuation
   * @param {Number} time
   * @param {Boolean} finished
   * @param {Function} cb
   */
  MANAGER.updateScore = function (user, score, puntuation, time, finished, cb) {
    var funk = require('funk')('parallel')
      , new_score = { puntuation: puntuation
                    , time: time
                    , finished: finished
                    , updated_at: Date.now()
                    };

    cb = cb || function () {};

    db.scores.update({'user._id': user._id, _id: score._id}, {'$set': new_score}, funk.nothing());

    function updateStats(stat, cb) {
      var max_puntuation = (puntuation > stat.max_puntuation) ? puntuation : stat.max_puntuation
        , total_puntuation = stat.total_puntuation + puntuation
        , total_time = stat.total_time + time
        , finished_games = (finished) ? stat.finished_games + 1 : stat.finished_games
        , _score = (puntuation > stat.max_puntuation) ? _.extend(score, new_score) : stat.score;

      delete _score.user;

      db.statistics.update(
        {_id: stat._id}
      , {'$set': { score: _score
                 , max_puntuation: max_puntuation
                 , total_puntuation: total_puntuation
                 , total_time: total_time
                 , finished_games: finished_games
                 , updated_at: Date.now()
                 }
        }
      , cb
      );
    }

    db.statistics.find({'$or': [{'user._id': user._id}, {user: {'$exists': false}}]}, funk.add(function (error, stats) {
      stats.forEach(function (stat) {
        updateStats(stat, funk.nothing());
      });
    }));

    funk.run(cb, cb);
  };

  return MANAGER;
};
