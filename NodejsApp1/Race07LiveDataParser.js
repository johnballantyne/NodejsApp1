var util = require('util');

var parseTime = function(timeString) {
    var timeParts = timeString.match(/((\d+):)?(\d+):(\d+)\.(\d+)/);
    if (!timeParts) return 0;
    return (parseInt(timeParts[2] || 0) * 60 * 60 * 1000) + (parseInt(timeParts[3]) * 60 * 1000) + (parseInt(timeParts[4]) * 1000) + parseInt(timeParts[5]);
};

module.exports = {parse: function(dataString) {

    var groups = dataString.split(/\r?\n\r?\n/);

    var race = {
        Header: {},
        Race: {},
        Players: []
    };

    groups.forEach(function(group){
    
        var lines = group.split(/\r?\n/);
        var header = lines.shift();
        header = header.substr(1, header.length - 2);

        var pairs = {};

        if (header.match(/^Slot\d{3}$/)) {
            pairs.Lap = [];
        }

        lines.forEach(function(line){
            var kv = line.split('=');
            var key = kv.shift();
            var value = kv.join('=');

            switch (key) {
                case 'QualTime':
                case 'BestLap':
                case 'RaceTime':
                case 'Lap':
                    value = parseTime(value);
                    break;
                case 'LapDistanceTravelled':
                    value = parseFloat(value);
                    break;
                case 'Laps':
                    value = parseInt(value);
                    break;
            }

            if (util.isArray(pairs[key])) {
                pairs[key].push(value);
            } else {
                pairs[key] = value;
            }
        });

        if (header.match(/^Slot\d{3}$/)) {
            race.Players.push(pairs);
        } else {
            race[header] = pairs;
        }

    });

    return race;
}};
