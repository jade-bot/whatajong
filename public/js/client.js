/*global Raphael, io, Tile*/

var socket;

$(function () {
  var SIDE_SIZE = 8
    , TILE_HEIGHT = 65
    , TILE_WIDTH = 45
    , TILE_THEIGHT = TILE_HEIGHT + SIDE_SIZE
    , TILE_TWIDTH = TILE_WIDTH + SIDE_SIZE
    , COLUMNS = 8
    , ROWS = 15
    , ALPHA_HIDE = 0.25
    , CANVAS_WIDTH = (ROWS * TILE_WIDTH) + (2 * SIDE_SIZE)
    , CANVAS_HEIGHT = (COLUMNS * TILE_HEIGHT) + (2 * SIDE_SIZE)
    , paper = Raphael($('#canvas').get(0), CANVAS_WIDTH, CANVAS_HEIGHT)
    , user_data = { _id: $('#user_id').val()
                  , name: $('#user_name').val()
                  , img: $('#user_picture').val()
                  }
    , svgs = [], images = [], shapes = [], shadows = [];

  socket = io.connect('http://localhost/' + $('#room_id').val());

  /**
   * Adds the new player to the room view
   * unless its yourself
   *
   * @param {Object} user
   */
  function addPlayer(user) {
    $('#players').append('<li id="player_' + user.id + '">'
                       + '<span class="name">' + user.name + '</span>'
                       + '<span class="points"></span>'
                       + '<img src="' + user.img + '" width="48" height="48" />'
                       + '</li>');
  }

  /**
   * Inits the state and set up the board
   *
   * @param {Object} STATE
   */
  function startGame(STATE) {
    var TILE = Tile(STATE.current_map);

    function formatTime(val) {
      var hours = val / 3600 | 0
        , minutes = (val - (hours * 3600)) / 60 | 0
        , seconds = val - (hours * 3600) - (minutes * 60)
        , hours_s = hours < 10 ? "0" + hours : hours
        , minutes_s = minutes < 10 ? "0" + minutes : minutes
        , seconds_s = seconds < 10 ? "0" + seconds : seconds;

      hours_s = hours === 0 ? "" : hours_s + ":";

      return hours_s + minutes_s + ":" + seconds_s;
    }

    function numPairsChanged(num_pairs) {
      $('#num_pairs')
        .animate({left: num_pairs < 13 ? 100 - (num_pairs * 100 / 12) : 0}, 300)
        .text(num_pairs);
    }

    function updateTileState(cb) {
      return function (tile) {
        STATE.tiles[tile.i] = tile;
        cb(tile);
      };
    }

    function updateMapState(cb) {
      return function (map) {
        STATE.current_map = map;
        cb(map);
      };
    }

    function setShadows(tile) {
      var shadow = shadows[tile.i]
        , up = TILE.getUpTiles(tile)
        , right = TILE.getRightTiles(tile)
        , some
        , has_living_up = false
        , has_living_right = false;

      // init
      shadow.up.show();
      shadow.right.show();
      _.each(['up_both', 'right_both', 'up_climb', 'right_climb'], function (el) {
        shadow[el].hide();
      });

      // check up
      _.each(up, function (el) {
        if (!STATE.tiles[el].is_deleted) {
          shadow.up.hide();
          has_living_up = true;
        }
      });

      // check right
      _.each(right, function (el) {
        if (!STATE.tiles[el].is_deleted) {
          shadow.right.hide();
          has_living_right = true;
        }
      });

      // check right-up
      if (!has_living_up) {
        shadow.up_both.show();
        shadow.up_climb.show();
        some = _.some(right, function (el) {
          var some = _.some(TILE.getUpTiles(STATE.tiles[el]), function (el) {
            return !STATE.tiles[el].is_deleted;
          });

          return some;
        });

        if (!some) {
          shadow.up_climb.hide();
        } else {
          shadow.up_both.hide();
        }
      }

      // check up-right
      if (!has_living_right) {
        shadow.right_both.show();
        shadow.right_climb.show();
        some = _.some(up, function (el) {
          var some = _.some(TILE.getRightTiles(STATE.tiles[el]), function (el) {
            return !STATE.tiles[el].is_deleted;
          });

          return some;
        });

        if (!some) {
          shadow.right_climb.hide();
        } else {
          shadow.right_both.hide();
        }
      }
    }

    function makeBetterVisibility(tile, val) {
      var left_tiles = TILE.getLeftTiles(tile);

      function hide(left_top, left) {
        if (!left_top.is_deleted) {
          svgs[left_top].attr({opacity: val ? ALPHA_HIDE : 1});
          images[left].attr({opacity: val ? 0 : 1});
        }
      }

      if (left_tiles.length) {
        // 1 level
        _.each(left_tiles, function (left) {
          var left_top_tiles = TILE.getTopTiles(STATE.tiles[left]);

          _.each(left_top_tiles, function (left_top) {
            hide(left_top, left);
            // level 2
            var left_top_top_tiles = TILE.getTopTiles(STATE.tiles[left_top]);
            _.each(left_top_top_tiles, function (left_top_top) {
              hide(left_top_top, left_top);
              // level 3
              var left_top_top_top_tiles = TILE.getTopTiles(STATE.tiles[left_top_top]);
              _.each(left_top_top_tiles, function (left_top_top_top) {
                hide(left_top_top_top, left_top_top);
              });
            });
          });
        });
      }
    }

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

    function _getRealCoordinates(tile) {
      var x = (tile.x - 1) * TILE_WIDTH / 2 | 0
        , y = SIDE_SIZE + (tile.y * TILE_HEIGHT / 2 | 0)
        , z = tile.z;

      x = z ? x + (z * SIDE_SIZE) : x;
      y = z ? y - (z * SIDE_SIZE) : y;

      return {x: x, y: y};
    }

    function renderTile(tile) {
      var coords = _getRealCoordinates(tile)
        , x = coords.x
        , y = coords.y
        , z = tile.z
        , shadow_attr = {stroke: '', fill: '#000', 'fill-opacity': 0.1}
        , set = paper.set()
        , image_loc = getImageLocation(tile.cardface)
        , left_side, bottom_side, body, shape, shadow_right, shadow_up
        , shadow_up_climb, shadow_right_climb, shadow_up_both, shadow_right_both, image;

      left_side = paper.path([ 'M', x, y + SIDE_SIZE, 'L', x + SIDE_SIZE, y, 'L', x + SIDE_SIZE, y + TILE_HEIGHT
                             , 'L', x, y + TILE_THEIGHT, 'L', x, y + SIDE_SIZE].join(' '));
      bottom_side = paper.path([ 'M', x, y + TILE_THEIGHT, 'L', x + SIDE_SIZE, y + TILE_HEIGHT
                               , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_WIDTH, y + TILE_THEIGHT
                               , 'L', x, y + TILE_THEIGHT].join(' '));
      body = paper.path([ 'M', x + SIDE_SIZE, y, 'L', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH, y + TILE_HEIGHT
                        , 'L', x + SIDE_SIZE, y + TILE_HEIGHT, 'L', x + SIDE_SIZE, y].join(' '));
      image = paper.image("/images/tiles.png", x + SIDE_SIZE - image_loc.x, y - image_loc.y, TILE_WIDTH * 9, TILE_HEIGHT * 5);
      shape = paper.path([ 'M', x, y + SIDE_SIZE, 'L', x + SIDE_SIZE, y, 'L', x + TILE_TWIDTH, y
                         , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_WIDTH, y + TILE_THEIGHT
                         , 'L', x, y + TILE_THEIGHT, 'L', x, y + SIDE_SIZE].join(' '));
      shadow_up = paper.path([ 'M', x + SIDE_SIZE, y, 'L', x + (2 * SIDE_SIZE), y - SIDE_SIZE
                             , 'L', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE, 'L', x + TILE_TWIDTH - SIDE_SIZE, y
                             , 'L', x + SIDE_SIZE, y].join(' '));
      shadow_up_climb = paper.path([ 'M', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE, 'L', x + TILE_TWIDTH, y - SIDE_SIZE * 2
                                   , 'L', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH - SIDE_SIZE, y
                                   , 'L', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE].join(' '));
      shadow_right_climb = paper.path([ 'M', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH + 2 * SIDE_SIZE, y
                                      , 'L', x + TILE_TWIDTH + SIDE_SIZE, y + SIDE_SIZE, 'L', x + TILE_TWIDTH, y + SIDE_SIZE
                                      , 'L', x + TILE_TWIDTH, y].join(' '));
      shadow_up_both = paper.path([ 'M', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE, 'L', x + TILE_TWIDTH + SIDE_SIZE, y - SIDE_SIZE
                                  , 'L', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH - SIDE_SIZE, y
                                  , 'L', x + TILE_TWIDTH - SIDE_SIZE, y - SIDE_SIZE].join(' '));
      shadow_right_both = paper.path([ 'M', x + TILE_TWIDTH, y, 'L', x + TILE_TWIDTH + SIDE_SIZE, y - SIDE_SIZE
                                     , 'L', x + TILE_TWIDTH + SIDE_SIZE, y + SIDE_SIZE, 'L', x + TILE_TWIDTH, y + SIDE_SIZE
                                     , 'L', x + TILE_TWIDTH, y - SIDE_SIZE].join(' '));
      shadow_right = paper.path([ 'M', x + TILE_TWIDTH, y + SIDE_SIZE, 'L', x + TILE_TWIDTH + SIDE_SIZE, y + SIDE_SIZE
                                , 'L', x + TILE_TWIDTH + SIDE_SIZE, y + TILE_HEIGHT - SIDE_SIZE
                                , 'L', x + TILE_TWIDTH, y + TILE_HEIGHT, 'L', x + TILE_TWIDTH, y + SIDE_SIZE
                                ].join(' '));

      left_side.attr({fill: '#FFBB89', stroke: ''});
      bottom_side.attr({fill: '#FF9966', stroke: ''});
      body.attr({fill: '#FEE1A9', stroke: ''});
      image.attr({'clip-rect': [x + SIDE_SIZE, y, TILE_WIDTH, TILE_HEIGHT]});
      shape.attr({stroke: '#664433', 'stroke-width': 2, cursor: 'pointer', fill: '#fff', 'fill-opacity': 0});

      $.each([ shadow_up, shadow_right, shadow_up_climb, shadow_right_climb
             , shadow_up_both, shadow_right_both], function (i, el) {
        el.attr(shadow_attr);
        el.node.style['pointer-events'] = 'none';
      });

      set.push(left_side, bottom_side, body, image, shape
              , shadow_up, shadow_right, shadow_up_climb, shadow_right_climb
              , shadow_up_both, shadow_right_both);

      svgs[tile.i] = set;
      images[tile.i] = image;
      shapes[tile.i] = shape;
      shadows[tile.i] = {
        up: shadow_up
      , right: shadow_right
      , up_climb: shadow_up_climb
      , right_climb: shadow_right_climb
      , up_both: shadow_up_both
      , right_both: shadow_right_both
      };

      shape.click(function () {
        socket.emit('tile.clicked', tile);
      });

      shape.hover(function () {
        if (!STATE.tiles[tile.i].selected && TILE.isFree(STATE.tiles[tile.i])) {
          this.attr({'fill-opacity': 0.3});
        }
        makeBetterVisibility(STATE.tiles[tile.i], true);
      }, function () {
        if (!STATE.tiles[tile.i].selected) {
          this.attr({'fill-opacity': 0});
        }
        makeBetterVisibility(STATE.tiles[tile.i], false);
      });
    }

    function onSelected(tile) {
      shapes[tile.i].attr({fill: '#FFCC33', 'fill-opacity': 0.5});
    }

    function onUnselected(tile) {
      shapes[tile.i].attr({fill: '#FFFFFF', 'fill-opacity': 0});
      svgs[tile.i].animate({
        '20%': {transform: 'T3,0'}
      , '40%': {transform: 'T-3,0'}
      , '60%': {transform: 'T3,0'}
      , '80%': {transform: 'T-3,0'}
      , '100%': {transform: 'T0,0'}
      }, 500);
    }

    function onDelete(data) {
      var coords = _getRealCoordinates(data.tiles[0])
        , $points = $('<span class="points">+' + data.points + '</span>');

      $points.css({left: coords.x, top: coords.y});
      $('#canvas').append($points);
      $points.animate({top: '-=100', opacity: 0}, 2000, function () {
        $points.remove();
      });

      function shadowing(tile) {
        _.each(TILE.getLeftTiles(tile), function (el) {
          if (!STATE.tiles[el].is_deleted) {
            setShadows(STATE.tiles[el]);
            _.each(TILE.getDownTiles(STATE.tiles[el]), function (el) {
              if (!STATE.tiles[el].is_deleted) {
                setShadows(STATE.tiles[el]);
              }
            });
          }
        });

        _.each(TILE.getDownTiles(tile), function (el) {
          if (!STATE.tiles[el].is_deleted) {
            setShadows(STATE.tiles[el]);
            _.each(TILE.getLeftTiles(STATE.tiles[el]), function (el) {
              if (!STATE.tiles[el].is_deleted) {
                setShadows(STATE.tiles[el]);
              }
            });
          }
        });
      }

      _.each(data.tiles, updateTileState(function (tile) {
        shadowing(tile);

        svgs[tile.i].animate({opacity: 0}, 300, '>', function () {
          svgs[tile.i].remove();
          makeBetterVisibility(tile, false);
        });
      }));
    }

    function drawBoard(tiles) {
      var i, tile;

      for (i = 1; i <= tiles.length; i++) {
        if (tiles[i] && !tiles[i].is_deleted) {
          renderTile(tiles[i]);
          setShadows(tiles[i]);
          if (tiles[i].selected) {
            onSelected(tiles[i]);
          }
        }
      }
    }

    // bootstrap
    $('#time').text('00:00');
    $('#points').text('0');
    $('#container').removeClass('paused').addClass('playing');

    numPairsChanged(STATE.num_pairs);

    drawBoard(STATE.tiles);

    // game events
    socket.on('tile.selected', updateTileState(onSelected));
    socket.on('tile.unselected', updateTileState(onUnselected));
    socket.on('tiles.deleted', onDelete);

    socket.on('map.changed', updateMapState(function (map) {
      STATE.current_map = map;
      TILE = Tile(STATE.current_map);
    }));

    socket.on('tick', function (data) {
      $('#time').text(formatTime(data.time));
      $('#points').text(data.points);
    });

    socket.on('num_pairs.changed', numPairsChanged);
  }

  // room dom events
  $('.start').click(function () {
    socket.emit('start');
    return false;
  });

  // room socket events
  socket.on('start', startGame);
  socket.on('players.add', addPlayer);
  socket.on('players.delete', function (data) {
    if (data.id !== socket.socket.sessionid) {
      $('#player_' + data.id).remove();
    }
  });

  socket.emit('connect', user_data, function (players) {
    _.each(players, function (user) {
      if (user.id !== socket.socket.sessionid) {
        addPlayer(user);
      }
    });
  });
});
