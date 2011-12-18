(typeof exports === 'undefined' ? this : exports).Tile = function (current_map) {
  var TILE = {};

  TILE.POINTS_PER_SECOND = 2;
  TILE.TOTAL_TILES = 144;

  function _getPosition(z, y, x) {
    return ((current_map[z] || {})[y] || {})[x];
  }

  TILE.getTopTiles = function getTopTiles(tile) {
    return _.compact(_.uniq([ _getPosition(tile.z + 1, tile.y, tile.x)
                            , _getPosition(tile.z + 1, tile.y, tile.x - 1)
                            , _getPosition(tile.z + 1, tile.y + 1, tile.x)
                            , _getPosition(tile.z + 1, tile.y + 1, tile.x - 1)]));
  };

  TILE.getTopCoveringTile = function getTopCoveringTile(tile) {
    var top_tile = _getPosition(tile.z + 1, tile.y, tile.x)
        && _getPosition(tile.z + 1, tile.y, tile.x - 1)
        && _getPosition(tile.z + 1, tile.y + 1, tile.x)
        && _getPosition(tile.z + 1, tile.y + 1, tile.x - 1);

    return top_tile || null;
  };

  TILE.getDownTiles = function getDownTiles(tile) {
    return _.compact(_.uniq([ _getPosition(tile.z, tile.y + 2, tile.x)
                            , _getPosition(tile.z, tile.y + 2, tile.x - 1)]));
  };

  TILE.getUpTiles = function getUpTiles(tile) {
    return _.compact(_.uniq([ _getPosition(tile.z, tile.y - 1, tile.x)
                            , _getPosition(tile.z, tile.y - 1, tile.x - 1)]));
  };

  TILE.getRightTiles = function getRightTiles(tile) {
    return _.compact(_.uniq([ _getPosition(tile.z, tile.y, tile.x + 1)
                            , _getPosition(tile.z, tile.y + 1, tile.x + 1)]));
  };

  TILE.getLeftTiles = function getLeftTiles(tile) {
    return _.compact(_.uniq([ _getPosition(tile.z, tile.y, tile.x - 2)
                            , _getPosition(tile.z, tile.y + 1, tile.x - 2)]));
  };

  TILE.hasTopTiles = function hasTopTiles(tile) {
    return !!TILE.getTopTiles(tile).length;
  };

  TILE.hasLeftTiles = function hasLeftTiles(tile) {
    return !!TILE.getLeftTiles(tile).length;
  };

  TILE.hasRightTiles = function hasRightTiles(tile) {
    return !!TILE.getRightTiles(tile).length;
  };

  TILE.isFree = function (tile) {
    return !TILE.hasTopTiles(tile) && (!TILE.hasLeftTiles(tile) || !TILE.hasRightTiles(tile));
  };

  TILE['delete'] = function (tile) {
    tile.is_deleted = true;
    current_map[tile.z][tile.y][tile.x] = null;
    current_map[tile.z][tile.y][tile.x - 1] = null;
    current_map[tile.z][tile.y + 1][tile.x] = null;
    current_map[tile.z][tile.y + 1][tile.x - 1] = null;
  };

  TILE.setPosition = function (tile, x, y, z) {
    tile.x = x;
    tile.y = y;
    tile.z = z;
  };

  TILE.areMatching = function (first_tile, second_tile) {
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

  TILE.getFreeTiles = function (tiles) {
    var free_tiles = [], i, current_tile;

    for (i = 1; i <= TILE.TOTAL_TILES; i++) {
      current_tile = tiles[i];

      if (TILE.isFree(current_tile) && !current_tile.is_deleted) {
        free_tiles.push(current_tile);
      }
    }

    free_tiles = _.sortBy(free_tiles, function (el) {
      return el.cardface;
    });

    return free_tiles;
  };

  TILE.getNumPairs = function (tiles) {
    var free_tiles = TILE.getFreeTiles(tiles), num_pairs = 0, i;

    for (i = 0; i < free_tiles.length - 1; i++) {
      if (TILE.areMatching(free_tiles[i].cardface, free_tiles[i + 1].cardface)) {
        i++;
        num_pairs++;
      }
    }
    return num_pairs;
  };

  TILE.onClicked = function (STATE, firstSelection, secondSelection, notMatching) {
    return function (tile, player_id) {
      var points
        , player = STATE.players[player_id];

      tile = STATE.tiles[tile.i];

      if (TILE.isFree(tile)) {

        // First selection
        if (player.selected_tile === null) {
          player.selected_tile = tile;
          tile.selected = true;
          tile.player_ids.push(player_id);

          firstSelection(tile);

        // Second selection
        } else if (TILE.areMatching(player.selected_tile.cardface, tile.cardface)
                && !(player.selected_tile.is_deleted || tile.is_deleted)
                && player.selected_tile.i !== tile.i) {

          TILE['delete'](tile);
          TILE['delete'](STATE.tiles[player.selected_tile.i]);

          tile.selected = true;
          secondSelection(tile, player.selected_tile, points);
          _.each(tile.player_ids.concat(player.selected_tile.player_ids), function (player_id) {
            STATE.players[player_id].selected_tile = null;
          });
        // don't match or the same tile
        } else {
          if (player.selected_tile.i !== tile.i) {
            delete STATE.tiles[player.selected_tile.i].selected;
          }
          STATE.tiles[player.selected_tile.i].player_ids = _.without(
            STATE.tiles[player.selected_tile.i].player_ids
          , player_id
          );
          delete STATE.tiles[tile.i].selected;
          notMatching(tile, player.selected_tile);
          player.selected_tile = null;
        }
      }
    };
  };

  return TILE;
};
