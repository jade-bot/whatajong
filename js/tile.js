(function () {
  function _getPosition(z, y, x) {
    return ((APP.current_map[z] || {})[y] || {})[x];
  }

  APP.Tile = function (options) {
    var Tile = options;

    Tile.getTopTiles = function getTopTiles(Tile) {
      return _.compact([ _getPosition(Tile.z + 1, Tile.y, Tile.x)
                       , _getPosition(Tile.z + 1, Tile.y, Tile.x - 1)
                       , _getPosition(Tile.z + 1, Tile.y + 1, Tile.x)
                       , _getPosition(Tile.z + 1, Tile.y + 1, Tile.x - 1)]);
    }

    Tile.getLeftTiles = function getLeftTiles(Tile) {
      return _.compact([ _getPosition(Tile.z, Tile.y, Tile.x - 2)
                       , _getPosition(Tile.z, Tile.y + 1, Tile.x - 2)]);
    }

    Tile.hasTopTiles = function hasTopTiles(Tile) {
      return !!Tile.getTopTiles(Tile).length;
    }

    Tile.hasLeftTiles = function hasLeftTiles(Tile) {
      return !!Tile.getLeftTiles(Tile).length;
    }

    Tile.hasRightTiles = function hasRightTiles(Tile) {
      return !!(_getPosition(Tile.z, Tile.y, Tile.x + 1) || _getPosition(Tile.z, Tile.y + 1, Tile.x + 1));
    }

    Tile.isFree = function () {
      return !Tile.hasTopTiles(Tile) && (!Tile.hasLeftTiles(Tile) || !Tile.hasRightTiles(Tile));
    }

    Tile['delete'] = function () {
      Tile.is_deleted = true;
      APP.current_map[Tile.z][Tile.y][Tile.x] = null;
      APP.current_map[Tile.z][Tile.y][Tile.x - 1] = null;
      APP.current_map[Tile.z][Tile.y + 1][Tile.x] = null;
      APP.current_map[Tile.z][Tile.y + 1][Tile.x - 1] = null;
      APP.event.emit('tile.deleted', Tile);
    }

    Tile.setPosition = function (x, y, z) {
      Tile.x = x;
      Tile.y = y;
      Tile.z = z;
    };

    return Tile;
  };
}());
