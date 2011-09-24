/*global EventEmitter2, MAPS*/
var APP = {
  maps: {}
, tiles: []
, selected_tile: null
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
    APP.current_map = MAPS['default']();
    _instantiateTiles(APP.tiles);
    APP.event.emit('setup', APP.tiles);
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

  // when a tile is being clicked
  APP.event.on('tile.clicked', function (tile) {
    if (tile.isFree()) {
      // First selection
      if (APP.selected_tile === null) {
        APP.selected_tile = tile;
        tile.selected = true;
        APP.event.emit('tile.selected', tile);
        // Second selection
      } else if (APP.isMatching(APP.selected_tile.cardface, tile.cardface) && APP.selected_tile.i !== tile.i) {
        // delete the tiles
        tile['delete']();
        APP.selected_tile['delete']();

        APP.selected_tile = null;
        APP.remainingTiles -= 2;
        // don't match or the same tile
      } else {
        APP.event.emit('tile.unselected', tile);
        APP.event.emit('tile.unselected', APP.selected_tile);
        tile.selected = false;
        APP.selected_tile.selected = false;
        APP.selected_tile = null;
      }
    }
  });
}());
