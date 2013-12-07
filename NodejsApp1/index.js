var fs = require('fs');
var express = require('express.io');
var Race07FTPEndpoint= require('./Race07FTPEndpoint');

var app = express();
app.http().io();
app.listen(8888);

app.use(express.static(__dirname));

app.io.sockets.on('connection', function(socket) {
    //socket.emit('race07 data',race);
    socket.join('live-gareth');
});


var raceFTP = new Race07FTPEndpoint({port: 21});
raceFTP.on('liveUpdate', function(data){
    //console.log('liveUpdate', data);
    // data will also contain:
    // username, raceId?, raceType, raceNumber, 
    app.io.sockets.in('live-' + data.Origin.username).emit('liveUpdate', data);
});
/*
raceFTP.on('sessionData', function(data){
    console.log('sessionData', data);
    // data will also contain:
    // username, raceId?, raceType, raceNumber, 
});
raceFTP.on('replay', function(data){
    console.log('replay');
    // data contains:
    // username, raceId?, raceType, raceNumber, replayFilename, associatedSessionData?
});
*/
