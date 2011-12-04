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
      $('#canvas').append('<span class="mouse" id="mouse_' + data.id
                        + '">' + data.name + '</span>');
    }

    var style = $('#mouse_' + data.id)[0].style;
    style.left = (data.x - 2) + 'px';
    style.top = (data.y - 2) + 'px';
  }

  $('#canvas').mousemove(
    ratelimit(function (e) {
      socket.emit('mouse.move', {
        x: e.pageX - $('#canvas').offset().left
      , y: e.pageY - $('#canvas').offset().top
      , w: $('#canvas').width()
      , h: $('#canvas').height()
      , name: $('#user_name').val()
      });
    }, 40)
  );

  socket.on('players.delete', function (data) {
    $('#mouse_' + data.id).remove();
  });

  socket.on('mouse.move', function (data) {
    if (data.id !== socket.socket.sessionid) {
      move(data);
    }
  });
});
