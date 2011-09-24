/*global EventEmitter2*/
var APP = {
  maps: {}
, tiles: []
, TOTAL_TILES: 144
};

(function () {
  APP.event = new EventEmitter2();

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
    var i, tile;

    for (i = 1; i <= APP.TOTAL_TILES; i++) {
      tiles[i] = APP.Tile({cardface: tiles[i], i: i});
    }
  }

  // first time
  APP.init = function () {
    APP.tiles = _getDeck();
    APP.setup();
  };

  // for each game
  APP.setup = function () {
    APP.tiles = _shuffle(APP.tiles);
    _instantiateTiles(APP.tiles);
    APP.event.emit('setup', APP.tiles);
  };

  // when a tile is being clicked
  APP.event.on('tile_clicked', function (tile) {
    console.log(tile);
  });
}());
