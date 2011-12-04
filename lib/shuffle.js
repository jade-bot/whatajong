module.exports = function _shuffle(tiles) {
  var temp_arr = [], i, r;
  for (i = 1; i <= TOTAL_TILES; i++) {
    r = Math.round(Math.random() * (TOTAL_TILES - i)) + 1;

    // filter repeated tiles in a row
    if (i > 3 && i < TOTAL_TILES - 4) {
      if (tiles[r] === temp_arr[i - 1] || tiles[r] === temp_arr[i - 2] || tiles[r] === temp_arr[i - 3]) {
        r = Math.round(Math.random() * (TOTAL_TILES - i)) + 1;
      }
    }

    temp_arr[i] = tiles[r];
    tiles.splice(r, 1);
  }

  return temp_arr;
};
