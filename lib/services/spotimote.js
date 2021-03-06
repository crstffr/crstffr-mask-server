(function(undefined) {

    var q = require('q');
    var util = require('../utils/util');
    var hex = require('../utils/hex');
    var log = require('../utils/log').spotimote;
    var config = require('../../config').spotimote;
    var request = require('request');

    function Spotimote() {

        this.timeout = 60;
        this.heartbeat = 30000;
        this.interval = {};

        this.server = {
            ip: config.server,
            port: config.port || 5116,
            path: config.path || '/clear',
            conn: 0,  // last time it was connected
            token: '' // unique connection reference
        };

        this.connect();
        this.keepAlive();

    }

    Spotimote.prototype = {

        // ***********************************************
        // Public Methods
        // ***********************************************

        playPause: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Play Pause...');
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB', 'SI');
                var string = prefix + 'actionPlayPause"' + this.server.token;
                this.send(string).then(function(body) {
                    log('PlayPause complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
            }.bind(this));
            return defer.promise;
        },

        skipForward: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Skip Forward...');
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB');
                var string = prefix + '\n' + 'actionNext"' + this.server.token;
                this.send(string).then(function(body) {
                    log('Skip Foward complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
            }.bind(this));
            return defer.promise;
        },

        skipBackward: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Skip Backward... (non functional)');
                /*
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB');
                var string = prefix + '\n' + 'actionNext"' + this.server.token;
                this.send(string).then(function(body) {
                    log('Skip Backward complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
                */
            }.bind(this));
            return defer.promise;
        },

        volumeUp: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Volume Up... (non functional)');
                /*
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB');
                var string = prefix + '\n' + 'actionNext"' + this.server.token;
                this.send(string).then(function(body) {
                    log('Skip Backward complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
                */
            }.bind(this));
            return defer.promise;
        },

        volumeDown: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Volume Down... (non functional)');
                /*
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB');
                var string = prefix + '\n' + 'actionNext"' + this.server.token;
                this.send(string).then(function(body) {
                    log('Skip Backward complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
                */
            }.bind(this));
            return defer.promise;
        },

        randomRadio: function() {
            var defer = q.defer();
            this.connect().then(function() {
                log('Random Radio... (non functional)');
                /*
                var prefix = hex.concat('BS', 'x80', 'ENQ', 'DLE', 'SOH', 'SUB');
                var string = prefix + '\n' + 'actionNext"' + this.server.token;
                this.send(string).then(function(body) {
                    log('Skip Backward complete'); // @todo: doesn't make it this far
                    defer.resolve(body);
                });
                */
            }.bind(this));
            return defer.promise;
        },

        wait: function() {
            var defer = q.defer();
            this.connect().then(function() {
                if (util.debug('keepAlive')) { log('keep alive'); }
                var prefix = hex.concat('BS', 'x80', 'ETX', 'DLE', 'NUL', 'SUB', 'EOT');
                var suffix = hex.concat('STX', 'BS', 'RS');
                var string = prefix + 'wait"' + this.server.token + '*' + suffix;
                this.send(string).then(function(body) {
                    defer.resolve(body); // @todo: doesn't make it this far
                });
            }.bind(this));
            return defer.promise;
        },



        // ***********************************************
        // Private Utilities
        // ***********************************************

        validToken: function(token) {
            return (token.length > 10 && token[0] === '$');
        },

        // ***********************************************
        // Spotimote Communication
        // ***********************************************

        send: function(str) {
            var defer = q.defer();
            var url = 'http://' + this.server.ip + ':' + this.server.port + this.server.path;
            var req = request.post(url, {body: str}, function(err, response, body) {
                if (err) {
                    defer.reject(err.code);
                } else {
                    response.setEncoding('utf8');
                    this.server.conn = util.now();
                    defer.resolve(body);
                }
            }.bind(this)).end();
            return defer.promise;
        },

        connect: function() {

            var defer = q.defer();

            if (!this.timedOut()) {
                defer.resolve();
                return defer.promise;
            }

            var prefix = hex.concat('BS', 'x80', 'ETX', 'DLE', 'NUL', 'SUB', 'BEL');
            var suffix = hex.concat('STX', 'BS', 'SOH');
            var string = prefix + 'connect*' + suffix;

            this.send(string).then(function(body) {

                // Check if the connection responded with a token
                // that we can parse out and save for later use.

                if (body.indexOf('$') < 0) {

                    log('No token', body);
                    defer.reject();

                } else {

                    // The connection reference token starts directly after a
                    // cariage return line feed, with some hex garbage after.
                    // Split by newline and check for a value.  If it's not
                    // there then fail out.

                    var parts = body.split('\n');
                    var token = hex.strip(parts[1]);

                    if (this.validToken(token)) {
                        log('Valid Token:', token);
                        this.server.conn = util.now();
                        this.server.token = token;
                        defer.resolve();
                    } else {
                        log('Invalid token:', token);
                    }

                }

            }.bind(this), function(error){

                log('Unable to connect', error);

            }.bind(this));

            return defer.promise;
        },

        // ***********************************************
        // KeepAlive Handling
        // ***********************************************

        keepAlive: function() {
            this.interval = setInterval(this.wait.bind(this), this.heartbeat);
        },

        timedOut: function() {
            return (this.server.conn + this.timeout < util.now());
        }

    };

    module.exports = new Spotimote();

}).call(this);