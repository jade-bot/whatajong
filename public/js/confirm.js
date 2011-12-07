(function ($) {
  var Confirm = {};

  /**
   * Shows the Confirm
   *
   * @param {Object} el
   */
  Confirm.open = function (el, callback) {
    function onClickYes(evt) {
      evt.preventDefault();
      Confirm.close(el);
      callback();
    }

    $(el).find('.dialog_yes').click(onClickYes);
    $(el).show();

    // ESC
    $(document).bind('keyup.Confirm', function (event) {
      if (event.keyCode === 27) {
        onClickYes(event);
      }
      if (event.keyCode === 13) {
        onClickYes(event);
      }
    });
  };

  /**
   * Hides the Confirm
   *
   * @param {Object} el
   */
  Confirm.close = function (el) {
    $(el).hide();
    $(document).unbind('keyup.Confirm');
    $(el).find('.dialog_yes').unbind('click');
  };

  // exports
  APP.Confirm = Confirm;
}(jQuery));
