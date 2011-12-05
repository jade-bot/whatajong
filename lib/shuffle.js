module.exports = function _shuffle(tiles) {
  var temp_arr = []
    , total_tiles = tiles.length - 1
    , i, r;
  for (i = 1; i <= total_tiles; i++) {
    r = Math.round(Math.random() * (total_tiles - i)) + 1;

    // filter repeated tiles in a row
    if (i > 3 && i < total_tiles - 4) {
      if (tiles[r] === temp_arr[i - 1] || tiles[r] === temp_arr[i - 2] || tiles[r] === temp_arr[i - 3]) {
        r = Math.round(Math.random() * (total_tiles - i)) + 1;
      }
    }

    temp_arr[i] = tiles[r];
    tiles.splice(r, 1);
  }

  return temp_arr;
};
