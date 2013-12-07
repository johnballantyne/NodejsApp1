var fs = require('fs');
var parse = require('./ParserStuff/parser');
var express = require('express.io');

var fileString = fs.readFileSync('bleh.txt', {encoding:'utf8'});
var race = parse(fileString);

var app = express();
app.http().io();
app.listen(8888);

app.use(express.static(__dirname));

app.io.sockets.on('connection', function (socket) {
    socket.emit('race07 data',race);
});
