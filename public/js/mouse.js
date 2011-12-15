/*global socket*/
$(function () {
  var timeouts = {};

  function ratelimit(fn, ms) {
    var last = (new Date()).getTime();
    return function () {
      var now = (new Date()).getTime();
      if (now - last > ms) {
        last = now;
        fn.apply(null, arguments);
      }
    };
  }

  function move(data) {
    if (!$('#mouse_' + data.id).length) {
      $('#canvas').append('<span class="mouse color_' + data.color.slice(1) + '" id="mouse_' + data.id + '"></span>');
    }

    $('#mouse_' + data.id).animate({
      left: (data.x - 2) + 'px'
    , top: (data.y - 2) + 'px'
    }, 20, 'linear');
  }

  $('#canvas').mousemove(
    ratelimit(function (e) {
      socket.emit('mouse.move', {
        x: e.pageX - $('#canvas').offset().left
      , y: e.pageY - $('#canvas').offset().top
      });
    }, 40)
  );

  socket.on('players.delete', function (data) {
    $('#mouse_' + data.id).remove();
  });

  socket.on('mouse.move', move);
});
