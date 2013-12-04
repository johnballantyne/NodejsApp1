var fs = require('fs');
var express = require('express');
var parse = require('./ParserStuff/parser');

var fileString = fs.readFileSync('bleh.txt', {encoding:'utf8'});
var race = parse(fileString);

var app = express();

app.get('/racedata', function(req, res, next){
    res.json(race);
});

app.get('/', function(req, res, next){
    var html = "<body>Hello WORLD! This many people playing: "+race.Players.length+"</body>";
    res.send(200, html);
});

app.listen(80);
