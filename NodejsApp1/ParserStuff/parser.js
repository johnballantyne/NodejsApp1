function parse(file){
    console.log("about to parse this file");
    var parser = new Parser(file);
    return [parser.headers,parser.players];
}
function SayHi(){
    console.log("hi");
    }
function print(file){
    var parser = new Parser(file);
    for(var i =0;i< parser.players.length;i++){
        console.log("Player: " + parser.players[i]+"\n");
        }
    }
    exports.SayHi = SayHi;
exports.parse = parse;

var Parser = (function () {
    function Parser(args) {
        // if no string is passed, do nothing nothing
        if (args.length == 0)
            return;
        // initialize the containers
        this.headers = [];
        this.players = [];
        this.headerIndex = 0;
        this.playerIndex = 0;

        var i = 0;
        // continue reading until you reach the last line
        while (args[i] != "[END]") {
            var line = args[i];
            if (line.length == 0)
                ;
            else if (line[0] == '[') {
                this.ParseHeader(line);
            }
            else
                this.ParseKey(line);
            i++;
        }
    }
    Parser.prototype.ParseHeader = function (line) {
        var t = line.substring(1, line.length - 1);
        this.curHeader = t;
        if (this.curHeader != "Header" && this.curHeader != "Race") {
            this.playerIndex++;
            this.players[this.playerIndex] = new Player(t);
        }
    };
    Parser.prototype.ParseKey = function (line) {
        var s = line.split("=");
        var kvp = new KeyValuePair(s[0], s[1]);
        if (this.curHeader == "Header" || this.curHeader == "Race") {
            this.headers[this.headerIndex] = kvp;
            this.headerIndex++;
        } else {
            this.players[this.playerIndex].Add(kvp);
        }
    };
    return Parser;
})();
var Player = (function () {
    function Player(slot) {
        this.slot = slot;
        this.kvps = new KeyValuePair[12]();
        this.kvpIndex = 0;
        this.lapIndex = 0;
    }
    Player.prototype.Add = function (kvp) {
        if (kvp.key == "Laps")
            this.laps = new String[parseInt(kvp.value)]();

        if (kvp.key == "Lap") {
            this.laps[this.lapIndex] = kvp.value;
            this.lapIndex++;
        } else {
            this.kvps[this.kvpIndex] = kvp;
            this.kvpIndex++;
        }
    };
    return Player;
})();
var KeyValuePair = (function () {
    function KeyValuePair(key, value) {
        this.key = key;
        this.value = value;
    }
    return KeyValuePair;
})();
