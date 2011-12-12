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
    , gamesManager = require('./lib/games')(options, STATE)
    , Tile, room;

  room = options.io.of('/' + options.room_id).on('connection', function onSpawn(socket) {

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
              tiles[i] = {cardface: tiles[i], i: map[z][y][x], x: x, y: y, z: z};
              i++;
            }
          }
        }
      }
    }

    function _cleanState() {
      clearInterval(STATE.interval);
      STATE = _defaultState();
    }

    function _eachSecond() {
      STATE.time++;
      STATE.points = STATE.points <= 0 ? 0 : STATE.points - Tile.POINTS_PER_SECOND;
      room.emit('tick', {time: STATE.time, points: STATE.points});
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
        Tile['delete'](STATE.tiles[tile.i]);
        Tile['delete'](STATE.tiles[STATE.players[player_id].selected_tile.i]);
        cb(STATE.tiles[tile.i], STATE.tiles[STATE.players[player_id].selected_tile.i]);

        STATE.remaining_tiles -= 2;
        STATE.num_pairs = Tile.getNumPairs(STATE.tiles);
        points = (Tile.POINTS_PER_SECOND * 3) + Math.ceil(
                    (Tile.TOTAL_TILES - STATE.remaining_tiles) / Tile.TOTAL_TILES * Tile.POINTS_PER_SECOND * 60
                 );
        STATE.points += points;

        room.emit('tiles.deleted', {
          tile: tile
        , selected_tile: selected_tile
        , player_id: player_id
        , current_map: STATE.current_map
        , num_pairs: STATE.num_pairs
        });

        if (!STATE.num_pairs || !STATE.remaining_tiles) {
          STATE.finished = true;
          clearInterval(STATE.interval);

          // loose
          if (!STATE.remaining_tiles) {
            room.emit('game.win');
          // win
          } else {
            room.emit('game.loose');
          }

          gamesManager.saveGame(
            null
          , { finished: !STATE.remaining_tiles
            , remaining_tiles: STATE.remaining_tiles
            , points: STATE.points
            , time: STATE.time
          });
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
    socket.on('mouse.move', function (data) {
      socket.get('id', function (error, id) {
        if (error) throw Error('Error getting the id');
        data.id = id;
        data.color = STATE.players[id].color.slice(1).split(/(..)/).filter(Boolean).map(function (s) {
          return parseInt(s, 16);
        });
        socket.broadcast.emit('mouse.move', data);
      });
    });

    // player connection
    socket.on('disconnect', function () {
      socket.get('id', function (error, id) {
        if (error) throw Error('Error getting the id');

        socket.broadcast.emit('players.delete', {id: id});

        // save the unfinished game
        if (STATE.started && !STATE.finished) {
          gamesManager.saveGame(
            [id]
          , { finished: false
            , remaining_tiles: STATE.remaining_tiles
            , points: 0
            , time: STATE.time
          });
        }

        if (!Object.keys(STATE.players).length) {
          options.db.rooms.remove({_id: require('mongojs').ObjectId(options.room_id)});
          _cleanState();
        }
      });
    });

    socket.on('connect', function (data, cb) {
      socket.set('id', data._id, function () {
        data.id = data._id;
        if (!STATE.players[data.id]) {
          data.selected_tile = null;
          delete data._id;
          data.color = _.find(_player_colors, function (color) {
            return !_.any(STATE.players, function (player) {
              return player.color === color;
            });
          });
          STATE.players[data.id] = data;
        }
        room.emit('players.add', STATE.players[data.id]);
        cb(STATE.players);

        if (STATE.started) {
          socket.emit('init', STATE);
        }
      });
    });

    // game bootstrap! :)
    socket.on('start', function (data) {
      if (!STATE.started) {
        _initState();
      }
      room.emit('init', STATE);
    });

    socket.on('restart', function (data) {
      _cleanState();
      gamesManager = require('./lib/games')(options, STATE);
      _initState();
      room.emit('start', STATE);
    });
  });
};
