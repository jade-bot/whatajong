/*global EventEmitter2*/
var APP = {maps: {}};

(function () {
  var _tiles;

  APP.event = new EventEmitter2();

  // TODO: implement
  function _getDeck() {
    return [];
  }

  // TODO: implement
  function _shuffle(_tiles) {
    return _tiles;
  }

  // first time
  APP.init = function () {
    _tiles = _getDeck();
    APP.setup();
  };

  // for each game
  APP.setup = function () {
    _tiles = _shuffle(_tiles);
    APP.event.emit('setup', _tiles);
  };

  // when a tile is being clicked
  APP.event.on('tile_clicked', function (tile) {
    console.log(tile);
  });
}());
