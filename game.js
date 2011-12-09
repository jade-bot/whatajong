var _getDeck = require('./lib/get_deck')
  , _shuffle = require('./lib/shuffle');

GLOBAL._ = require('underscore');

function _defaultState() {
  return { tiles: []
         , time: 0
         , points: 250
         , selected_tile: null
         , players: {}
         , started: false
         , finished: false
         };
}

module.exports.spawn = function (options) {
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
    socket.on('tile.clicked', function (data) {
      var tile = data.tile
        , origin = data.origin
        , noop = function () {};

      room.emit('tile.clicked', {tile: tile, origin: origin});

      Tile.onClicked(STATE
      , noop
      , function secondSelection(tile, selected_tile, points) {
        // TODO: group this three events
        room.emit('map.changed', STATE.current_map);
        room.emit('num_pairs.changed', STATE.num_pairs);

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
      , noop
      )(tile);
    });

    // mouse.js
    socket.on('mouse.move', function (data) {
      data.id = socket.id;
      room.emit('mouse.move', data);
    });

    // player connection
    socket.on('disconnect', function () {
      room.emit('players.delete', {id: socket.id});
      delete STATE.players[socket.id];

      // save the unfinished game
      if (STATE.started && !STATE.finished) {
        gamesManager.saveGame(
          [socket.id]
        , { finished: false
          , remaining_tiles: STATE.remaining_tiles
          , points: 0
          , time: STATE.time
        });
      }

      if (!Object.keys(STATE.players).length) {
        options.db.rooms.remove({_id: require('mongojs').ObjectId(options.room_id)});
        clearInterval(STATE.interval);
        STATE = null;
      }
    });

    socket.on('connect', function (data, cb) {
      data.id = socket.id;
      STATE.players[socket.id] = data;
      room.emit('players.add', data);
      cb(STATE.players);

      if (STATE.started) {
        socket.emit('start', STATE);
      }
    });

    // game bootstrap! :)
    socket.on('start', function (data) {
      if (!STATE.started) {
        _initState();
      }
      room.emit('start', STATE);
    });

    socket.on('restart', function (data) {
      clearInterval(STATE.interval);
      STATE = _defaultState();
      gamesManager = require('./lib/games')(options, STATE);
      _initState();
      room.emit('start', STATE);
    });
  });
};
