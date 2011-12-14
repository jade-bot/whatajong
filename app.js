var express = require('express')
  , everyauth = require('everyauth')
  , conf = require('./conf')
  , asereje = require('asereje')
  , db, io, http;

function parseUser(network, data) {
  var user = {};

  switch (network) {
  case 'facebook':
    user.name = data.name;
    user.picture = 'https://graph.facebook.com/' + data.id + '/picture';
    break;
  case 'twitter':
    user.name = data.name;
    user.picture = data.profile_image_url;
    break;
  }

  user.network = network;
  return user;
}

function findOrCreateUser(network) {
  return function (session, access_token, access_token_extra, metadata) {
    var promise = this.Promise();

    db.users.findOne({access_token: access_token, network: network}, function (error, user) {
      function onUser(error, user) {
        if (error) return console.log(error);
        if (Array.isArray(user)) {
          user = user[0];
        }
        user.id = user._id;
        promise.fulfill(user);
      }

      if (!user) {
        db.users.insert(parseUser(network, metadata), onUser);
      } else {
        onUser(null, user);
      }
    });

    return promise;
  };
}

function authorize(req, res, next) {
  if (!req.user) {
    if (req.param('room_id')) {
      req.session.redirect = '/game/' + req.param('room_id');
    }
    res.redirect('/');
  } else {
    next();
  }
}

everyauth.everymodule.findUserById(function (_id, callback) {
  db.users.findOne({_id: require('mongojs').ObjectId(_id)}, callback);
});

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

http = express.createServer();

http.use(express.favicon());
http.use(express.bodyParser());
http.use(express['static'](__dirname + "/public"));
http.use(express.cookieParser());
http.use(express.session({secret: conf.session.secret}));
http.use(everyauth.middleware());

http.use(express.errorHandler(
  http.set('env') === 'development'
    ? {showStack: true, dumpExceptions: true}
    : {}
));

http.configure(function () {
  http.set('view engine', 'jade');
  http.set('views', __dirname + '/views');
});

http.helpers({
  assets_host: conf.assets_host || ''
});

asereje.config({
  active: http.set('env') === 'production' // enable it just for production
, js_globals: [ 'vendor/jquery'            // js files that will be present always
              , 'vendor/raphael'
              , 'vendor/underscore']
, css_globals: ['global']                  // css files that will be present always
, js_path: __dirname + '/public/js'        // javascript folder path
, css_path: __dirname + '/public/css'      // css folder path
});

http.get('/', function (req, res, next) {
  var query;

  // logged + redirect
  if (req.user && req.session.redirect) {
    res.redirect(req.session.redirect);
    delete req.session.redirect;

  // just logged
  } else if (req.user) {
    db.rooms.find({}, function (error, rooms) {
      if (error) return next(error);

      res.render('welcome', {
        rooms: rooms
      , error: req.param('error') || ''
      , connect_error: req.param('connect_error') || ''
      , css: asereje.css()
      , js: asereje.js(['welcome'])
      });
    });

  // Home
  } else {
    res.render('index', {
      css: asereje.css()
    , js: []
    });
  }
});

http.post('/room', authorize, function (req, res, next) {
  var name = req.param('room').name;

  if (name && name.length) {
    // foo
    db.rooms.insert({name: name, host_id: req.user._id}, function (error, rooms) {
      if (error) return next(error);
      require('./game').spawn({
        io: io
      , room_id: rooms[0]._id
      , host_id: req.user._id
      , db: db
      });
      res.redirect('/game/' + rooms[0]._id);
    });
  } else {
    res.redirect('/?error=Room name is mandatory');
  }
});

http.get('/game/:room_id', authorize, function (req, res, next) {
  var query = {_id: require('mongojs').ObjectId(req.param('room_id'))}
    , js = ['tile', 'client', 'mouse', 'confirm']
    , options;

  db.rooms.findOne(query, function (error, room) {
    if (error) return next(error);

    var options = { room: room
                  , user: req.user
                  , css: asereje.css()
                  , js: asereje.js(js)
                  };

    if (room) {
      res.render('room', options);
    } else {
      res.render('inexistant_room', options);
    }
  });
});

everyauth.helpExpress(http);

io = require('socket.io').listen(http);
io.set('log level', 1);
io.configure('production', function () {
  io.enable('browser client minification'); // send minified client
  io.enable('browser client etag');         // apply etag caching logic based on version number
  io.enable('browser client gzip');         // gzip the file
  io.set('log level', 1);                   // reduce logging
  io.set('transports', [                    // enable all transports (optional if you want flashsocket)
    'websocket'
  , 'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

db = require('mongojs').connect(conf.mongodb.connection_url, ['users', 'rooms']);
db.rooms.remove({}, function (error) {
  if (error) throw(error);

  http.listen(conf.port || 3000);
});
