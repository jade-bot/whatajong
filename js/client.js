/*global Raphael*/
$(function () {
  var SIDE_SIZE = 8
    , TILE_HEIGHT = 65
    , TILE_WIDTH = 45
    , TILE_THEIGHT = TILE_HEIGHT + SIDE_SIZE
    , TILE_TWIDTH = TILE_WIDTH + SIDE_SIZE
    , COLUMNS = 8
    , ROWS = 15
    , paper = Raphael(
        $('#canvas').get(0)
      , (ROWS * TILE_WIDTH) + (2 * SIDE_SIZE), (COLUMNS * TILE_HEIGHT) + (2 * SIDE_SIZE)
      );

  function getImageLocation(cardface) {
    var type = cardface.slice(0, 1)
      , number = cardface.slice(1, 2);

    switch (type) {
    case 'b':
      return {y: 0, x: (+number - 1) * TILE_WIDTH};
    case 'c':
      return {y: TILE_HEIGHT, x: (+number - 1) * TILE_WIDTH};
    case 'o':
      return {y: 2 * TILE_HEIGHT, x: (+number - 1) * TILE_WIDTH};
    case 'h':
      return {y: 3 * TILE_HEIGHT, x: (+number - 1) * TILE_WIDTH};
    case 'w':
      return {y: 4 * TILE_HEIGHT, x: (+number + 2) * TILE_WIDTH};
    case 'd':
      switch (number) {
      case 'c':
        return {y: 4 * TILE_HEIGHT, x: 0};
      case 'f':
        return {y: 4 * TILE_HEIGHT, x: TILE_WIDTH};
      case 'p':
        return {y: 4 * TILE_HEIGHT, x: 2 * TILE_WIDTH};
      }
    }
  }

  function renderTile(tile) {
    var x = (tile.x - 1) * 45 / 2
      , y = tile.y * 65 / 2
      , z = tile.z
      , shadow_attr = {stroke: '', fill: '#000', 'fill-opacity': 0.1}
      , set = paper.set()
      , image_loc = getImageLocation(tile.cardface)
      , left_side, bottom_side, body, shape, shadow_right, shadow_up, image;

    x = z ? x + (z * SIDE_SIZE) : x;
    y = SIDE_SIZE + (z ? y - (z * SIDE_SIZE) : y);

    left_side = paper.path([ 'M', x, y + SIDE_SIZE, 'L', x + SIDE_SIZE, y, 'L', x + SIDE_SIZE, y + TILE_HEIGHT
                           , 'L', x, y + TILE_THEIGHT, 'L', x, y + SIDE_SIZE].join(' '));
    bottom_side = paper.path([ 'M', x, y + TILE_THEIGHT, 'L', x + SIDE_SIZE, y + TILE_HEIGHT
                             , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_WIDTH, y + TILE_THEIGHT
                             , 'L', x, y + TILE_THEIGHT].join(' '));
    body = paper.path([ 'M', x + SIDE_SIZE, y, 'L', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH, y + TILE_HEIGHT
                      , 'L', x + SIDE_SIZE, y + TILE_HEIGHT, 'L', x + SIDE_SIZE, y].join(' '));
    image = paper.image("tiles.png", x + SIDE_SIZE - image_loc.x, y - image_loc.y, TILE_WIDTH * 9, TILE_HEIGHT * 5);
    shape = paper.path([ 'M', x, y + SIDE_SIZE, 'L', x + SIDE_SIZE, y, 'L', x + TILE_TWIDTH, y
                       , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_WIDTH, y + TILE_THEIGHT
                       , 'L', x, y + TILE_THEIGHT, 'L', x, y + SIDE_SIZE].join(' '));
    shadow_up = paper.path([ 'M', x + SIDE_SIZE, y, 'L', x + (2 * SIDE_SIZE), y - SIDE_SIZE
                           , 'L', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE, 'L', x + TILE_TWIDTH - SIDE_SIZE, y
                           , 'L', x + SIDE_SIZE, y].join(' '));
    shadow_right = paper.path([ 'M', x + TILE_TWIDTH, y + SIDE_SIZE, 'L', x + TILE_TWIDTH + SIDE_SIZE, y + SIDE_SIZE
                              , 'L', x + TILE_TWIDTH + SIDE_SIZE, y + TILE_HEIGHT - SIDE_SIZE
                              , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_TWIDTH, y + SIDE_SIZE
                              ].join(' '));

    left_side.attr({fill: '#FFBB89', stroke: ''});
    bottom_side.attr({fill: '#FF9966', stroke: ''});
    body.attr({fill: '#FEE1A9', stroke: ''});
    image.attr({'clip-rect': [x + SIDE_SIZE, y, TILE_WIDTH, TILE_HEIGHT]});
    shape.attr({stroke: '#664433', 'stroke-width': 2, cursor: 'pointer', fill: '#fff', 'fill-opacity': 0});

    // shadow attr
    $.each([shadow_up, shadow_right], function (i, el) {
      el.attr(shadow_attr);
    });

    set.push(left_side, bottom_side, body, shape, shadow_up, shadow_right, image);

    tile.svg = set;

    shape.click(function () {
      APP.event.emit('tile_clicked', tile);
    });

    shape.hover(function () {
      this.attr({'fill-opacity': 0.3});
    }, function () {
      this.attr({'fill-opacity': 0});
    });
  }

  function drawBoard(tiles) {
    var map = APP.maps['default']
      , i = 0
      , same_as_prev, same_as_above, z, y, x;

    for (z = 0; z < map.length; z++) {
      for (y = 0; y < map[z].length; y++) {
        for (x = map[z][y].length - 1; x > 0 ; x--) {
          same_as_prev = map[z][y][x + 1] ? map[z][y][x + 1] === map[z][y][x] : false;
          same_as_above = map[z][y - 1] ? map[z][y - 1][x] === map[z][y][x] : false;
          if (map[z][y][x] && !same_as_prev && !same_as_above) {
            i++;
            tiles[i].setPosition(x, y, z);
            renderTile(tiles[i]);
          }
        }
      }
    }
  }

  // init
  APP.event.on('setup', function (tiles) {
    drawBoard(tiles);
  });
});
