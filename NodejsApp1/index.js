var fs = require('fs');
var parse = require('./ParserStuff/parser');

var fileString = fs.readFileSync('bleh.txt', {encoding:'utf8'});
var race = parse(fileString);

var app = require('express.io')();
app.http().io();
app.listen(8888);

app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

app.io.sockets.on('connection', function (socket) {
    socket.emit('race07 data',race);
});
