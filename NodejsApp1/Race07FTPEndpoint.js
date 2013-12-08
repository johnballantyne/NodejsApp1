var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');
var VirtualFTPServer = require('./VirtualFTPServer');
var Race07LiveDataParser = require('./Race07LiveDataParser');
var fs = require('fs');
var concat = require('concat-stream');
require('colors');

var Race07FTPEndpoint = function(options){

    var endpoint = this;

    options = _.extend({
        debug   : false,
        port    : 21
    }, options || {});

    var ftp = new VirtualFTPServer("Race07 Live-FTP Endpoint", options);
    ftp.on('auth', function(username, password, cb){
        //console.log('u/p:', username, password);
        return cb&&cb();
    });
    ftp.on('stor', function(username, filename, socketStream, done){
        
        var parseable = filename.match(/^(.*)_(\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2})_(Live_)?([a-z]+)(\d+)?\.txt$/i);
        if (parseable) {
            // read stream and emit event
            socketStream.pipe(concat(function(data){
                //console.log(data.toString('utf8'));
                console.log('Received'.green, filename, 'from'.green, username);
                done();
                
                var data = Race07LiveDataParser.parse(data.toString());
                if (!data) {
                    console.log('failed to parse data from'.red, username, filename.red);
                    return;
                }
                
                data.Origin = {
                    username: username,
                    serverName: parseable[1],
                    raceId: parseable[2],
                    live: !!parseable[3],
                    raceType: parseable[4],
                    raceNumber: parseInt(parseable[5])
                };
                
                endpoint.emit('liveUpdate', data);
            }));
        } else {
            console.log('not parsable update, is this a replay?'.red, filename);
            // save file and emit event
            return done(); // TODO: find a safe place to save these other files
            var fst = fs.createWriteStream();
            socketStream.pipe(fst);
            fst.once('finish', function(){
                done();
            });
        }
        
    });
};
Race07FTPEndpoint.prototype.__proto__ = EventEmitter.prototype;

module.exports = Race07FTPEndpoint;
