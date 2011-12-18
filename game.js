var _getDeck = require('./lib/get_deck')
  , _player_colors = ['#ff6666', '#6666ff', '#66ff66', '#ffff66', '#66ffff', '#ff66ff']
  , _shuffle = require('./lib/shuffle');

GLOBAL._ = require('underscore');

module.exports.spawn = function (options) {

  function _defaultState() {
    return { tiles: []
           , time: 0
           , points: 250
           , players: {}
           , started: false
           , finished: false
           };
  }

  var STATE = _defaultState()
    , gamesManager = require('./lib/gamesManager')(options, STATE)
    , socket_namespace = (options.single
                          ? options.user._id
                          : options.room_id
                         ).toString()
    , room = options.io.of('/' + socket_namespace)
    , Tile;

  function _instantiateTiles(tiles) {
    var map = STATE.current_map
      , i = 1
      , same_as_prev, same_as_above, z, y, x;

    for (z = 0; z < map.length; z++) {
      for (y = 0; y < map[z].length; y++) {
        for (x = map[z][y].length - 1; x > 0 ; x--) {
          same_as_prev = map[z][y][x + 1] ? map[z][y][x + 1] === map[z][y][x] : false;
          same_as_above = map[z][y - 1] ? map[z][y - 1][x] === map[z][y][x] : false;
          if (map[z][y][x] && !same_as_prev && !same_as_above) {
            tiles[i] = {
              cardface: tiles[i]
            , player_ids: []
            , i: map[z][y][x]
            , x: x
            , y: y
            , z: z
            };
            i++;
          }
        }
      }
    }
  }

  function _cleanState() {
    clearInterval(STATE.interval);
    STATE = _defaultState();
    room.removeAllListeners();
  }

  // be sure than we only have one listener
  room.removeAllListeners();

  room.on('connection', function onSpawn(socket) {

    var room_socket = options.single ? socket : room;

    function _eachSecond() {
      STATE.time++;
      STATE.points = STATE.points <= 0 ? 0 : STATE.points - Tile.POINTS_PER_SECOND;
      room_socket.emit('tick', {time: STATE.time, points: STATE.points});
    }

    // for each game
    function _initState() {
      STATE.tiles = _shuffle(_getDeck());
      STATE.current_map = require('./maps/default')();
      Tile = require('./public/js/tile').Tile(STATE.current_map);
      _instantiateTiles(STATE.tiles);
      STATE.tiles = _.sortBy(STATE.tiles, function (el) {
        return el && el.i;
      });
      STATE.tiles.unshift(undefined);
      STATE.num_pairs = Tile.getNumPairs(STATE.tiles);
      STATE.remaining_tiles = Tile.TOTAL_TILES;
      STATE.interval = setInterval(_eachSecond, 1000);
      STATE.started = true;
      _.each(STATE.players, function (player) {
        player.selected_tile = null;
        player.num_pairs = 0;
      });
    }

    // when a tile is being clicked
    socket.on('tile.clicked', function (data, cb) {
      var tile = data.tile
        , player_id = data.player_id;

      cb = cb || function () {};

      Tile.onClicked(STATE
      , function (tile) {
          socket.broadcast.emit('tile.selected', {tile: STATE.tiles[tile.i], player_id: player_id});
          cb(STATE.tiles[tile.i]);
        }
      , function secondSelection(tile, selected_tile, points) {
        cb(STATE.tiles[tile.i], STATE.tiles[STATE.players[player_id].selected_tile.i]);

        STATE.remaining_tiles -= 2;
        STATE.num_pairs = Tile.getNumPairs(STATE.tiles);
        points = (Tile.POINTS_PER_SECOND * 3) + Math.ceil(
                    (Tile.TOTAL_TILES - STATE.remaining_tiles) / Tile.TOTAL_TILES * Tile.POINTS_PER_SECOND * 60
                 );
        STATE.points += points;
        STATE.players[player_id].num_pairs++;

        room_socket.emit('tiles.deleted', {
          tile: tile
        , selected_tile: selected_tile
        , player_id: player_id
        , current_map: STATE.current_map
        , num_pairs: STATE.num_pairs
        , player_num_pairs: STATE.players[player_id].num_pairs
        });

        if (!STATE.num_pairs || !STATE.remaining_tiles) {
          STATE.finished = true;
          clearInterval(STATE.interval);

          // loose
          if (!STATE.remaining_tiles) {
            room_socket.emit('game.win', {players: STATE.players, points: STATE.points});
          // win
          } else {
            room_socket.emit('game.loose', {players: STATE.players, points: STATE.points});
          }

          if (options.single) {
            gamesManager.updateScore(
              options.user
            , STATE.score
            , STATE.points
            , STATE.time
            , !STATE.remaining_tiles
            );
          }
        }
      }
      , function noMatching(tile, selected_tile) {
          cb(STATE.tiles[tile.i], STATE.tiles[STATE.players[player_id].selected_tile.i]);
          socket.broadcast.emit('tiles.unselected', {
            tile: STATE.tiles[tile.i]
          , selected_tile: STATE.tiles[selected_tile.i]
          });
        }
      )(tile, player_id);
    });

    // mouse.js
    if (!options.single) {
      socket.on('mouse.move', function (data) {
        socket.get('id', function (error, id) {
          if (error) throw Error('Error getting the id');
          data.id = id;
          if (STATE.players[id]) {
            data.color = STATE.players[id].color;
          } else {
            data.color = '#fff';
          }
          socket.broadcast.emit('mouse.move', data);
        });
      });
    }

    // player connection
    socket.on('disconnect', function () {
      socket.get('id', function (error, id) {
        if (error) throw Error('Error getting the id');

        socket.broadcast.emit('players.delete', {id: id});

        delete STATE.players[id];

        if (options.single && !STATE.finished) {
          gamesManager.updateScore(
            options.user
          , STATE.score
          , STATE.points
          , STATE.time
          , !STATE.remaining_tiles
          );
          _cleanState();
        } else {
          if (!Object.keys(STATE.players).length) {
            options.db.rooms.remove({_id: options.room_id});
            _cleanState();
          } else {
            options.db.rooms.update({_id: options.room_id}, {'$pull': {players: {id: id}}});
          }
        }
      });
    });

    socket.on('connect', function (data, cb) {
      if (STATE.players[data._id]) {
        return cb('You are already participating on that room');
      }

      socket.set('id', data._id, function () {
        data.id = data._id;
        delete data._id;
        data.selected_tile = null;
        data.num_pairs = 0;
        data.joined_at = Date.now();
        data.color = _.find(_player_colors, function (color) {
          return !_.any(STATE.players, function (player) {
            return player.color === color;
          });
        });
        data.rgba_color = data.color.slice(1).split(/(..)/).filter(Boolean).map(function (s) {
          return parseInt(s, 16);
        });
        STATE.players[data.id] = data;

        if (options.single) {
          gamesManager.createScore(options.user, function (error, score) {
            if (error) return cb(error);

            STATE.score = score;
            cb(null, STATE.players);
            _initState();
            socket.emit('init', STATE);
          });
        } else {
          options.db.rooms.update({_id: options.room_id}, {'$addToSet': {players: data}}, function (error) {
            if (error) return cb(error);

            socket.broadcast.emit('players.add', STATE.players[data.id]);
            cb(null, _.sortBy(STATE.players, function (player) {
              return (player.id === options.host_id.toString()) ? 0 : player.joined_at;
            }));

            if (STATE.started) {
              socket.emit('init', STATE);
            }
          });
        }
      });
    });

    // game bootstrap! :)
    socket.on('start', function (data) {
      if (!STATE.started) {
        _initState();
      }
      room_socket.emit('init', STATE);
    });

    socket.on('restart', function (data) {
      var players = STATE.players;
      STATE = _defaultState();
      STATE.players = players;
      gamesManager = require('./lib/gamesManager')(options, STATE);

      if (options.single) {
        gamesManager.createScore(options.user, function (error, score) {
          if (error) return cb(error);

          STATE.score = score;
          _initState();
          socket.emit('init', STATE);
        });
      } else {
        _initState();
        room_socket.emit('init', STATE);
      }
    });
  });
};
