var fs = require('fs');
var parse = require('./ParserStuff/parser');

var fileString = fs.readFileSync('bleh.txt', {encoding:'utf8'});
var race = parse(fileString);

var app = require('express')()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

server.listen(8888);

app.get('/', function (req, res) {
  res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
  socket.emit('race07 data',race);
});

setTimeout(function(){
    io.sockets.emit('race07 data',race);
}, 10000);