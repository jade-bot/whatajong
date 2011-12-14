$(function () {
  function showRoom() {
    $('.create_room').show();
    $('.new_room').hide();
  }

  $('.new_room').click(function () {
    showRoom();
    $('.create_room input.text')[0].focus();
    return false;
  });

  $('.create_room .blue').click(function () {
    $('.create_room').hide();
    $('.new_room').show();
    return false;
  });

  if ($('.create_room.error').length) {
    showRoom();
  }
});
