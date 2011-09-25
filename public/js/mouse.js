/*global io*/
(function () {
  var socket = io.connect('http://localhost')
    , timeouts = {};

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
      $('body').append('<span class="mouse" id="mouse_' + data.id
                      + '"><span style="display:none;" class="chat"/></span>');
    }

    var style = $('#mouse_' + data.id)[0].style;
    style.left = (data.x - 2) + 'px';
    style.top = (data.y - 2) + 'px';
  };

  $(document).mousemove(
    ratelimit(function (e) {
      socket.emit('mouse.move', {
        x: e.pageX
      , y: e.pageY
      , w: $(window).width()
      , h: $(window).height()
      });
    }, 40)
  );

  socket.on('close', function (data) {
    $('#mouse_' + data.id).remove();
  });

  socket.on('mouse.move', function (data) {
    if (data.id !== socket.socket.sessionid) {
      move(data);
    }
  });
}());
