var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var passport = require('passport');
var oauth = require('passport-oauth');
var GitHubStrategy = require('passport-github2').Strategy

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

Users.create({username:'bob',password:'tacular'});

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

app.use(partials());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'Blahedgpeth'}));
app.use(passport.initialize());
app.use(passport.session());

var GITHUB_CLIENT_ID = "dde0c8a94abfeff68112";
var GITHUB_CLIENT_SECRET = "5928f72853f71c05104c039e3bf39f7bb6b3070c";

passport.serializeUser(function(user, done) {
  done(null, user);
});

passport.deserializeUser(function(obj, done) {
  done(null, obj);
});

passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {
      // To keep the example simple, the user's GitHub profile is returned to
      // represent the logged-in user.  In a typical application, you would want
      // to associate the GitHub account with a user record in your database,
      // and return that user instead.
      return done(null, profile);
    });
  }
));

var ensureAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}

var  restrict = function(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
    //res.render('login');

  }
};

// app.get('/login',
//   function(req, res) {
//     res.render('login');
// });

// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /auth/github/callback
app.get('/login',
  passport.authenticate('github', { scope: [ 'user:email' ] }),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this
    // function will not be called.
  });

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/', ensureAuthenticated, 
  function(req, res) {
    console.log('empty page .get ')
  //need to login.
  res.render('index');
});

app.get('/create', ensureAuthenticated,
function(req, res) {
  //need to be logged in.
  res.render('index');
});

app.get('/links', ensureAuthenticated,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    //if exists, you're good.  If not, need to log in and then go to create page.
    res.send(200, links.models);
  });
});

app.get('/signup',
  function(req,res){
    res.render('signup');
  });

app.post('/login', function(req, res) {
    console.log('logging in Post');
    var username = req.body.username;
    var password = req.body.password;
    
    //query DB for password
    new User({
      username: username,
      password: password
    }).fetch().then(function(found){
      if(found){
          req.session.regenerate(function(){
          req.session.user = username;
          res.redirect('/');
          });
      }
      else {
         res.redirect('/login');
      } 
    }); 
});

app.get('/logout',
  function(req,res){
   console.log('logout function');
   req.session.destroy(function(){
    console.log('session destroy callback');
    res.redirect('/login');
   });
});

app.post('/signup',
  function(req,res){
    var username = req.body.username;
    var password = req.body.password;

    Users.create({username:username,password:password}).then(function(){
      req.session.regenerate(function(){
        req.session.user = username;
        res.redirect('/');
      })
    });
  })

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/



/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);


// Client ID
// dde0c8a94abfeff68112
// Client Secret
// 5928f72853f71c05104c039e3bf39f7bb6b3070c
