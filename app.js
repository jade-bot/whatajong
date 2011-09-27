var node_static = require('node-static')
  , express = require('express')
  , everyauth = require('everyauth')
  , file_server = new node_static.Server('./public')
  , conf = require('./conf')
  , db = require('mongojs').connect(conf.mongodb.connection_url, ['users', 'rooms'])
  , io, http;

function findOrCreateUser(network) {
  return function (session, access_token, access_token_extra, metadata) {
    var promise = this.Promise();
    db.users.findOne({access_token: access_token, network: network}, function (error, user) {
      if (!user) {
        metadata.access_token = access_token;
        metadata.network = network;
        db.users.insert(metadata);
      }
      promise.fulfill(user || metadata);
    });

    return promise;
  }
}

function authorize(req, res, next) {
  if (!req.session.auth) {
    if (!req.param('room_id')) {
      req.session.redirect = '/' + req.param('room_id');
    }
    res.redirect('/');
  } else {
    next();
  }
}

everyauth.facebook
  .appId(conf.facebook.appId)
  .appSecret(conf.facebook.appSecret)
  .findOrCreateUser(findOrCreateUser('facebook'))
  .redirectPath('/');

everyauth.twitter
  .consumerKey(conf.twitter.consumerKey)
  .consumerSecret(conf.twitter.consumerSecret)
  .findOrCreateUser(findOrCreateUser('twitter'))
  .redirectPath('/');

http = express.createServer(
  express.favicon()
, express.bodyParser()
, express['static'](__dirname + "/public")
, express.cookieParser()
, express.session({secret: 'charlieparker'})
, everyauth.middleware()
);

http.configure(function () {
  http.set('view engine', 'jade');
});

http.get('/', function (req, res, next) {
  if (req.session.auth && req.session.redirect) {
    res.redirect(req.session.redirect);
    delete req.session.redirect;
  } else if (req.session.auth) { // just redirected
    db.rooms.insert({host: req.session.auth}, function (error, rooms) {
      if (error) return next(error);
      // spawn a game
      require('./game').spawn({io: io, room_id: rooms[0]._id.toString()});
      res.redirect('/' + rooms[0]._id.toString());
    });
  } else {
    res.render('index', {room: null});
  }
});

http.get('/:room_id', authorize, function (req, res, next) {
  db.rooms.findOne({_id: require('mongojs').ObjectId(req.param('room_id'))}, function (error, room) {
    if (error) return next(error);
    if (!room) {
      res.render('inexistant_room', {room: null, room_id: req.param('room_id')});
    } else {
      res.render('room', {room: room});
    }
  });
});

everyauth.helpExpress(http);

db.rooms.remove({}, function () {
  io = require('socket.io').listen(http);
  io.set('log level', 1);
  http.listen(3000);
});
