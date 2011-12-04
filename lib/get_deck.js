module.exports = function _getDeck() {
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
};
