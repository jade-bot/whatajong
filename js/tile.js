(function () {
  var ALPHA_HIDE = 0.25;

  APP.Tile = function (options) {
    var Tile = options;

    function _isFree() {
    }

    function _showFreedom() {
    }

    function _hideFreedom() {
    }

    Tile.setPosition = function (x, y, z) {
      Tile.x = x;
      Tile.y = y;
      Tile.z = z;
    };

    return Tile;
  };
}());
