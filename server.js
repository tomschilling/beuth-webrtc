// server.js

// set up ======================================================================
// get all the tools we need
var express  = require('express');
var app      = express();
var port     = process.env.PORT || 8080;
var mongoose = require('mongoose');
var passport = require('passport');
var flash    = require('connect-flash');
var path = require('path');
var morgan       = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser   = require('body-parser');
var session      = require('express-session');

var configDB = require('./config/database.js');


// configuration ===============================================================
mongoose.connect(configDB.url); // connect to our database

require('./config/passport')(passport); // pass passport for configuration

// set up our express application
app.use(morgan('dev')); // log every request to the console
app.use(cookieParser()); // read cookies (needed for auth)
app.use(bodyParser.json()); // get information from html forms
app.use(bodyParser.urlencoded({ extended: true }));

// static folder Public 
app.use(express.static(path.join(__dirname, 'public')));
app.use('/static', express.static('public'));


// view engine
 app.set('view engine', 'ejs', 'html'); // set up ejs for templating
 app.engine('html', require('ejs').renderFile);
 app.set('public', path.join(__dirname, 'public'));


// WebSocketServer for WebRTC 
const WebSocketServer = require('ws').Server,
    https = require('https'),
    fs = require('fs');


// Certification and PrivateKey
const pkey = fs.readFileSync('./ssl/key.pem'),
    pcert = fs.readFileSync('./ssl/cert.pem'),
    options = {key: pkey, cert: pcert, passphrase: '123456789'};
var wss = null, sslSrv = null;


// required for passport
app.use(session({
    secret: 'keyboard cat2', // session secret
    resave: true,
    saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions
app.use(flash()); // use connect-flash for flash messages stored in session

// routes ======================================================================
require('./app/routes.js')(app, passport); // load our routes and pass in our app and fully configured passport

// launch ======================================================================
app.listen(port);
console.log('The magic happens on port ' + port);



// use express static to deliver resources HTML, CSS, JS, etc)
// from the public folder
//app.use(express.static('public'));

app.use(function(req, res, next) {
    if(req.headers['x-forwarded-proto']==='http') {
        return res.redirect(['https://', req.get('Host'), req.url].join(''));
    }
    next();
});

// start server (listen on port 443 - SSL)
sslSrv = https.createServer(options, app).listen(8000);
console.log("The HTTPS server is up and running");

// create the WebSocket server
wss = new WebSocketServer({server: sslSrv});
console.log("WebSocket Secure server is up and running.");

/** successful connection */
wss.on('connection', function (client) {
    console.log("A new WebSocket client was connected.");
    /** incomming message */
    client.on('message', function (message) {
        /** broadcast message to all clients */
        wss.broadcast(message, client);
    });
});

// broadcasting the message to all WebSocket clients.
wss.broadcast = function (data, exclude) {
    var i = 0, n = this.clients ? this.clients.length : 0, client = null;
    if (n < 1) return;
    console.log("Broadcasting message to all " + n + " WebSocket clients.");
    for (; i < n; i++) {
        client = this.clients[i];
        // don't send the message to the sender...
        if (client === exclude) continue;
        if (client.readyState === client.OPEN) client.send(data);
        else console.error('Error: the client state is ' + client.readyState);
    }
};