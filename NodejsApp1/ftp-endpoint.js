var net = require('net');

var PASV = function(c, cb) {
    var server = net.createServer(function(c){
        console.log('PASV connection received');
        
        c.on("data", function(data){
            console.log('PASVDATA', data);
        });
    });
    
    server.listen(function(){
        var a = server.address();
        
        var address = c.localAddress.split('.');
        address.push((a.port / 256) << 0);
        address.push(a.port % 256);
        
        return cb&&cb({
            address: address
        });
    });
};

var parseCmd = function(cmdStr){
    var cmd = cmdStr.split(" ");
    return {
        cmd: cmd.shift(),
        param: cmd.join(" ")
    };
};

var server = net.createServer(function(c){
    
    var readBuffer = '';
    
    c.on('readable', function(){
        var readData = c.read();
        if (readData === null) return;
        readBuffer += readData.toString();
        
        if (readBuffer.indexOf("\r\n") >= 0) {
            var readSplit = readBuffer.split("\r\n");
            readBuffer = readSplit.pop();
            
            readSplit.map(parseCmd).forEach(function(msg){
                console.log(msg);
                switch (msg.cmd) {
                    // useful info:
                    // http://www.ietf.org/rfc/rfc959.txt
                    // http://en.wikipedia.org/wiki/List_of_FTP_server_return_codes
                    case 'USER': // Here's a username
                        //if (msg.param == 'theusername')
                        c.write("331: Password required\r\n");
                        break;
                    case 'PASS': // Here's a password
                        //if (msg.param == 'thepassword')
                        c.write("230: User logged in\r\n");
                        break;
                    case 'PWD': // What is the present working directory?
                        c.write("257: \"/\" is current directory.\r\n");
                        break;
                    case 'TYPE': // Set TYPE
                        c.write("200: Type set to "+msg.param+"\r\n");
                        break;
                    case 'PASV': // Enter Passive mode?
                        PASV(c, function(pasv){
                            c.write("227: Entering Passive Mode ("+pasv.address+").\r\n");
                        });
                        break;
                    default: // we don't understand the command
                        c.write("502: Command not implemented\r\n");
                        break;
                }
            });
            
        }
    });
    
    c.once('end', function(){
        c.removeAllListeners('readable');
        console.log('client gone');
    });
    
    c.write("220: FTP server ready\r\n");
    
});

server.listen(21, function(){
    console.log('Listening on 21');
});
