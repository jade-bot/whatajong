var TOTAL_TILES = 144
  , POINTS_PER_SECOND = 2
  , _getDeck = require('./lib/get_deck')
  , _shuffle = require('./lib/shuffle');

GLOBAL._ = require('underscore');

module.exports.spawn = function (options) {
  var STATE = { tiles: []
              , time: 0
              , points: 250
              , selected_tile: null
              , players: {}
              , started: false
              }
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
      STATE.points = STATE.points <= 0 ? 0 : STATE.points - POINTS_PER_SECOND;
      room.emit('tick', {time: STATE.time, points: STATE.points});
    }

    function _isMatching(first_tile, second_tile) {
      if (first_tile.slice(0, 1) === second_tile.slice(0, 1)) {
        var is_honor = (first_tile.slice(0, 1) === "h")
          , first_num = first_tile.slice(1, 2)
          , second_num = second_tile.slice(1, 2);

        // honor exception
        if (is_honor) {
          return (+first_num <= 4 && +second_num <= 4) || (+first_num > 4 && +second_num > 4);
        } else {
          return first_num === second_num;
        }
      } else {
        return false;
      }
    }

    function _getFreeTiles() {
      var free_tiles = [], i, current_tile;

      for (i = 1; i <= TOTAL_TILES; i++) {
        current_tile = STATE.tiles[i];

        if (Tile.isFree(current_tile) && !current_tile.is_deleted) {
          free_tiles.push(current_tile);
        }
      }

      free_tiles = _.sortBy(free_tiles, function (el) {
        return el.cardface;
      });

      return free_tiles;
    }

    function _getNumPairs() {
      var free_tiles = _getFreeTiles(), num_pairs = 0, i;

      for (i = 0; i < free_tiles.length - 1; i++) {
        if (_isMatching(free_tiles[i].cardface, free_tiles[i + 1].cardface)) {
          i++;
          num_pairs++;
        }
      }
      return num_pairs;
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
      STATE.num_pairs = _getNumPairs();
      STATE.remaining_tiles = TOTAL_TILES;
      STATE.interval = setInterval(_eachSecond, 1000);
      STATE.started = true;
    }

    // when a tile is being clicked
    socket.on('tile.clicked', function (tile) {
      var points;

      if (Tile.isFree(tile)) {
        // First selection
        if (STATE.selected_tile === null) {
          STATE.selected_tile = tile;
          STATE.tiles[tile.i].selected = true;
          room.emit('tile.selected', STATE.tiles[tile.i]);
          // Second selection
        } else if (_isMatching(STATE.selected_tile.cardface, tile.cardface) && STATE.selected_tile.i !== tile.i) {
          // delete the tiles
          Tile['delete'](STATE.tiles[tile.i]);
          Tile['delete'](STATE.tiles[STATE.selected_tile.i]);
          room.emit('map.changed', STATE.current_map);

          STATE.remaining_tiles -= 2;
          STATE.num_pairs = _getNumPairs();
          points = (POINTS_PER_SECOND * 3) + Math.ceil(
                      (TOTAL_TILES - STATE.remaining_tiles) / TOTAL_TILES * POINTS_PER_SECOND * 60
                    );
          STATE.points += points;
          room.emit('tiles.deleted', {
            tiles: [
              STATE.tiles[tile.i]
            , STATE.tiles[STATE.selected_tile.i]
            ]
          , points: points
          });

          STATE.selected_tile = null;

          if (!STATE.num_pairs || !STATE.remaining_tiles) {
            // loose
            if (!STATE.num_pairs) {
              room.emit('game.loose');
            // win
            } else {
              room.emit('game.win');
            }
          }

          room.emit('num_pairs.changed', STATE.num_pairs);
          // don't match or the same tile
        } else {
          if (STATE.selected_tile.i !== tile.i) {
            STATE.tiles[STATE.selected_tile.i].selected = false;
            room.emit('tile.unselected', STATE.tiles[STATE.selected_tile.i]);
          }
          STATE.tiles[tile.i].selected = false;
          room.emit('tile.unselected', STATE.tiles[tile.i]);
          STATE.selected_tile = null;
        }
      }
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

      if (!Object.keys(STATE.players).length) {
        console.log('cleanup!');
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
  });
};
