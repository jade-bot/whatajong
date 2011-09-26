var app = require('./http')
  , io
  , node_static = require('node-static')
  , file_server = new node_static.Server('./public')
  , APP = { tiles: []
          , time: 0
          , points: 250
          , selected_tile: null
          , TOTAL_TILES: 144
          }
  , POINTS_PER_SECOND = 2
  , Tile;

GLOBAL._ = require('underscore');

io = require('socket.io').listen(app);
io.set('log level', 1);

io.sockets.on('connection', function (socket) {
  // when a tile is being clicked
  socket.on('restart', function (tile) {
    APP.setup();
  });

  socket.on('tile.clicked', function (tile) {
    var points;

    if (Tile.isFree(tile)) {
      // First selection
      if (APP.selected_tile === null) {
        APP.selected_tile = tile;
        APP.tiles[tile.i].selected = true;
        io.sockets.emit('tile.selected', APP.tiles[tile.i]);
        // Second selection
      } else if (APP.isMatching(APP.selected_tile.cardface, tile.cardface) && APP.selected_tile.i !== tile.i) {
        // delete the tiles
        Tile['delete'](APP.tiles[tile.i]);
        Tile['delete'](APP.tiles[APP.selected_tile.i]);
        io.sockets.emit('map.changed', APP.current_map);

        APP.remaining_tiles -= 2;
        APP.num_pairs = APP.getNumPairs();
        points = (POINTS_PER_SECOND * 3) + Math.ceil(
                    (APP.TOTAL_TILES - APP.remaining_tiles) / APP.TOTAL_TILES * POINTS_PER_SECOND * 60
                  );
        APP.points += points;
        io.sockets.emit('tiles.deleted', {
          tiles: [
            APP.tiles[tile.i]
          , APP.tiles[APP.selected_tile.i]
          ]
        , points: points
        });

        APP.selected_tile = null;

        if (!APP.num_pairs || !APP.remaining_tiles) {
          // loose
          if (!APP.num_pairs) {
            io.sockets.emit('game.loose');
          // win
          } else {
            io.sockets.emit('game.win');
          }
        }

        io.sockets.emit('num_pairs.changed', APP.num_pairs);
        // don't match or the same tile
      } else {
        if (APP.selected_tile.i !== tile.i) {
          io.sockets.emit('tile.unselected', APP.tiles[APP.selected_tile.i]);
        }
        io.sockets.emit('tile.unselected', APP.tiles[tile.i]);
        APP.tiles[tile.i].selected = false;
        APP.tiles[APP.selected_tile.i].selected = false;
        APP.selected_tile = null;
      }
    }
  });

  socket.on('client.connected', function (fn) {
    fn({tiles: APP.tiles, current_map: APP.current_map});
    socket.emit('num_pairs.changed', APP.num_pairs);
    socket.emit('tick', {time: APP.time, points: APP.points});
  });

  // mouse.js
  socket.on('zpeak', function (data) {
    socket.emit('zpeak', data);
  });

  socket.on('mouse.move', function (data) {
    data.id = socket.id;
    io.sockets.emit('mouse.move', data);
  });

  socket.on('disconnect', function () {
    io.sockets.emit('close', {id: socket.id});
  });
});

function _getDeck() {
  var i, j, tiles = [];

  for (i = 1; i <= 9; i++) {
    //Bambu
    for (j = 0; j < 4; j++) {
      tiles[i + 9 * j] = "b" + i;
    }
    //Caracter
    for (j = 0; j < 4; j++) {
      tiles[36 + i + 9 * j] = "c" + i;
    }
    //Cercle
    for (j = 0; j < 4; j++) {
      tiles[72 + i + 9 * j] = "o" + i;
    }
  }

  //Winds
  for (i = 1; i <= 4; i++) {
    tiles[108 + i] = "w1";
    tiles[112 + i] = "w2";
    tiles[116 + i] = "w3";
    tiles[120 + i] = "w4";
  }

  //Honors
  for (i = 1; i <= 8; i++) {
    tiles[124 + i] = "h" + i;
  }

  //Dragons
  for (i = 1; i <= 4; i++) {
    tiles[132 + i] = "dc";
    tiles[136 + i] = "df";
    tiles[140 + i] = "dp";
  }
  return tiles;
}

function _shuffle(tiles) {
  var temp_arr = [], i, r;
  for (i = 1; i <= APP.TOTAL_TILES; i++) {
    r = Math.round(Math.random() * (APP.TOTAL_TILES - i)) + 1;

    // filter repeated tiles in a row
    if (i > 3 && i < APP.TOTAL_TILES - 4) {
      if (tiles[r] === temp_arr[i - 1] || tiles[r] === temp_arr[i - 2] || tiles[r] === temp_arr[i - 3]) {
        r = Math.round(Math.random() * (APP.TOTAL_TILES - i)) + 1;
      }
    }

    temp_arr[i] = tiles[r];
    tiles.splice(r, 1);
  }

  return temp_arr;
}

function _instantiateTiles(tiles) {
  var map = APP.current_map
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
  APP.time++;
  APP.points = APP.points <= 0 ? 0 : APP.points - POINTS_PER_SECOND;
  io.sockets.emit('tick', {time: APP.time, points: APP.points});
}

APP.getNumPairs = function () {
  var free_tiles = APP.getFreeTiles()
    , num_pairs = 0
    , i;

  for (i = 0; i < free_tiles.length - 1; i++) {
    if (APP.isMatching(free_tiles[i].cardface, free_tiles[i + 1].cardface)) {
      i++;
      num_pairs++;
    }
  }
  return num_pairs;
}

APP.getFreeTiles = function () {
  var free_tiles = [], i, current_tile;

  for (i = 1; i <= APP.TOTAL_TILES; i++) {
    current_tile = APP.tiles[i];

    if (Tile.isFree(current_tile) && !current_tile.is_deleted) {
      free_tiles.push(current_tile);
    }
  }

  free_tiles = _.sortBy(free_tiles, function (el) {
    return el.cardface;
  });

  return free_tiles;
}

// for each game
APP.setup = function () {
  APP.tiles = _shuffle(_getDeck());
  APP.current_map = require('./maps/default')();
  Tile = require('./public/js/tile').Tile(APP.current_map);
  _instantiateTiles(APP.tiles);
  APP.tiles = _.sortBy(APP.tiles, function (el) {
    return el && el.i;
  });
  APP.tiles.unshift(undefined);
  io.sockets.emit('setup', {tiles: APP.tiles, current_map: APP.current_map});
  APP.num_pairs = APP.getNumPairs();
  APP.remaining_tiles = APP.TOTAL_TILES;
  io.sockets.emit('num_pairs.changed', APP.num_pairs);
  APP.interval = setInterval(_eachSecond, 1000);
};

APP.isMatching = function (first_tile, second_tile) {
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
};

// start!
APP.setup();
app.listen(3000);
