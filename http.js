var node_static = require('node-static')
  , express = require('express')
  , everyauth = require('everyauth')
  , file_server = new node_static.Server('./public')
  , conf = require('./conf')
  , app

  , usersById = {}
  , nextUserId = 0
  , usersByFbId = {}
  , usersByTwitId = {};

function encode(i) {
  var ALPHA = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  return i < ALPHA.length ? ALPHA.charAt(i) : encode(Math.floor(i / ALPHA.length)) + ALPHA.charAt(i % ALPHA.length);
}

function addUser(source, sourceUser) {
  var user = usersById[++nextUserId] = {id: nextUserId};
  user[source] = sourceUser;
  user.room = encode(Date.now()) + Math.random().toString(36).substr(2);
  return user;
}

everyauth
  .facebook
  .appId(conf.facebook.appId)
  .appSecret(conf.facebook.appSecret)
  .findOrCreateUser(function (session, accessToken, accessTokenExtra, fbUserMetadata) {
    return usersByFbId[fbUserMetadata.id] ||
      (usersByFbId[fbUserMetadata.id] = addUser('facebook', fbUserMetadata));
  })
  .redirectPath('/');

everyauth
  .twitter
  .consumerKey(conf.twitter.consumerKey)
  .consumerSecret(conf.twitter.consumerSecret)
  .findOrCreateUser(function (sess, accessToken, accessSecret, twitUser) {
    return usersByTwitId[twitUser.id] || (usersByTwitId[twitUser.id] = addUser('twitter', twitUser));
  })
  .redirectPath('/');

app = express.createServer(
  express.favicon()
, express.bodyParser()
, express['static'](__dirname + "/public")
, express.cookieParser()
, express.session({secret: 'charlieparker'})
, everyauth.middleware()
);

app.configure(function () {
  app.set('view engine', 'jade');
});

app.get('/', function (req, res) {
  if (req.session.auth && req.session.redirect) {
    res.redirect('/' + req.session.redirect);
    delete req.session.redirect;
  } else {
    res.render('index', {room: false});
  }
});

app.get('/:room', function (req, res) {
  if (req.session.auth) {
    res.render('room', {room: true});
  } else {
    req.session.redirect = req.param('room');
    res.redirect('/');
  }
});

everyauth.helpExpress(app);

module.exports = app;
