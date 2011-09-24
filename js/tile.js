(function () {
  var ALPHA_HIDE = 0.25;

  APP.Tile = function (options) {
    var Tile = options;


    function _showFreedom() {
    }

    function _hideFreedom() {
    }

    function _getPosition(z, y, x) {
      return ((APP.maps['default'][z] || {})[y] || {})[x];
    }

    function _hasTopTiles() {
      return !!(_getPosition(Tile.z + 1, Tile.y, Tile.x)
          || _getPosition(Tile.z + 1, Tile.y, Tile.x - 1)
          || _getPosition(Tile.z + 1, Tile.y + 1, Tile.x)
          || _getPosition(Tile.z + 1, Tile.y + 1, Tile.x - 1));
    }

    function _hasLeftTiles() {
      return !!(_getPosition(Tile.z, Tile.y, Tile.x - 2) || _getPosition(Tile.z, Tile.y + 1, Tile.x - 2));
    }

    function _hasRightTiles() {
      return !!(_getPosition(Tile.z, Tile.y, Tile.x + 1) || _getPosition(Tile.z, Tile.y + 1, Tile.x + 1));
    }

    Tile.isFree = function () {
      return !_hasTopTiles() && (!_hasLeftTiles() || !_hasRightTiles());
    }

    Tile.setPosition = function (x, y, z) {
      Tile.x = x;
      Tile.y = y;
      Tile.z = z;
    };

    return Tile;
  };
}());
