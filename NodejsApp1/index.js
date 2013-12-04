//var server = require("./server");
//var router = require("./router");

//server.start(router.route);

var fs = require('fs');
var ini = fs.readFileSync('abc.txt', {encoding:'utf8'}).split(/\r?\n/);

// do something with the ini...
var parser = require("./ParserStuff/parser");
parser.parse(ini);
parser.SayHi();