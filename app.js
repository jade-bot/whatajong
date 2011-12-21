var express = require('express')
  , everyauth = require('everyauth')
  , conf = require('./conf')
  , asereje = require('asereje')
  , db, io, http;

GLOBAL._ = require('underscore');

function parseUser(network, data, network_id) {
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
  user.network_id = network_id;
  return user;
}

function findOrCreateUser(network) {
  return function (session, access_token, token_extra, metadata) {
    var promise = this.Promise();

    db.users.findOne({network_id: metadata.id, network: network}, function (error, user) {
      function onUser(error, user) {
        if (error) return console.log(error);
        user.id = user._id;
        promise.fulfill(user);
      }

      if (!user) {
        db.users.insert(parseUser(network, metadata, metadata.id), function (error, user) {
          if (error) return console.log(error);
          user = user[0];
          db.statistics.insert({
            user: user
          , max_puntuation: 0
          , total_games: 0
          , total_puntuation: 0
          , total_time: 0
          , finished_games: 0
          , updated_at: null
          }, function (error, stat) {
            if (error) return console.log(error);
            onUser(null, user);
          });
        });
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
, humanize_time: function (time) {
    var hours = Math.floor(time / 3600)
      , minutes = Math.floor(time / 60)
      , seconds = time % 60;

    function left_zero(num) {
      return num < 10 ? '0' + num : num;
    }

    return hours !== 0
            ? left_zero(hours) + ':' + left_zero(minutes) + ':' + left_zero(seconds)
            : left_zero(minutes) + ':' + left_zero(seconds);
  }
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

http.get('/rules', function (req, res, next) {
  res.render('rules', {
    css: asereje.css()
  , js: asereje.js()
  });
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

http.get('/scores', authorize, function (req, res, next) {
  var funk = require('funk')('parallel');

  function onStats(error, stats) {
    if (error) return next(error);

    var my_stats = _.detect(stats, function (stat) {
          return !!stat.user;
        })
      , global_stats = _.detect(stats, function (stat) {
          return !stat.user;
        })
      , max_puntuation = my_stats.max_puntuation
      , base_query = {'$ne': {'user._id': my_stats.user._id}, user: {'$exists': true}, score: {'$exists': true}};

    funk.set('my_stats', my_stats);
    funk.set('global_stats', global_stats);

    function onCount(error, num_better_scores) {
      funk.set('num_better_scores', num_better_scores);

      if (num_better_scores >= 10) {
        // between 10 and 15 join top ten with better scores
        var index = num_better_scores < 15 ? num_better_scores - 11 : 4;
        funk.set('index', index);

        db.statistics.find(
          _.extend({'$lte': {max_puntuation: max_puntuation}}, base_query)
        , {sort: {max_puntuation: -1}, limit: 5}
        , funk.result('worse_scores')
        );

        if (index >= 0) {
          db.statistics.find(
            _.extend({'$gt': {max_puntuation: max_puntuation}}, base_query)
          , {sort: {max_puntuation: 1}, limit: 5}
          , funk.result('better_scores')
          );
        }
      }
    }

    db.statistics.count(
      _.extend({'$gt': {max_puntuation: max_puntuation}}, base_query)
      , funk.add(onCount)
    );
  }

  db.statistics.find({'$or': [{'user._id': req.user._id}, {user: {'$exists': false}}]}, funk.add(onStats));
  db.statistics.find(
    {user: {'$exists': true}, score: {'$exists': true}}
  , {sort: {max_puntuation: -1}, limit: 10}
  , funk.result('top_ten_scores')
  );

  funk.run(function () {
    var stats = [];

    if (this.better_scores) {
      stats = _.union(this.top_ten_scores, this.better_scores.slice(0, this.index).reverse()
                      , [this.my_stats], this.worse_scores);
    } else if (this.worse_scores) {
      stats = _.union(this.top_ten_scores, [this.my_stats], this.worse_scores);
    } else {
      stats = this.top_ten_scores;
    }

    res.render('scores_and_stats', {
      stats: stats
    , my_stats: this.my_stats
    , global_stats: this.global_stats
    , user: req.user
    , moment: require('moment')
    , css: asereje.css()
    , js: asereje.js()
    });

  }, next);
});

http.get('/game/single', authorize, function (req, res, next) {
  var js = ['vendor/uuid', 'tile', 'client', 'mouse', 'confirm']
    , options = { user: req.user
                , room: null
                , css: asereje.css()
                , js: asereje.js(js)
                };

  require('./game').spawn({
    io: io
  , single: true
  , user: req.user
  , db: db
  });

  res.render('room', options);
});

http.get('/game/:room_id', authorize, function (req, res, next) {
  var query = {_id: require('mongojs').ObjectId(req.param('room_id'))}
    , js = ['vendor/uuid', 'tile', 'client', 'mouse', 'confirm'];

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
    'flashsocket'
  , 'htmlfile'
  , 'xhr-polling'
  , 'jsonp-polling'
  ]);
});

db = require('mongojs').connect(conf.mongodb.connection_url, ['users', 'rooms', 'scores', 'statistics']);

db.statistics.findOne({user: {'$exists': false}}, function (error, stat) {
  if (!stat) {
    db.statistics.insert({
      max_puntuation: 0
    , total_games: 0
    , total_puntuation: 0
    , total_time: 0
    , finished_games: 0
    , updated_at: null
    });
  }

  db.rooms.remove({}, function (error) {
    http.listen(conf.port || 3000);
  });
});
