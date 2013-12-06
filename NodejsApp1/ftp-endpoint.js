var net = require('net');
var EventEmitter = require('events').EventEmitter;
require('colors');

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

var createControlLink = function(port, newClientCallback){

    var server = net.createServer(function(socket){
        
        var client = new EventEmitter()
          , readBuffer = ''
          , paused = false
          , dataLink = null
          ;

        // receive a command from the client if ready
        client.receive = function(){
            if (readBuffer.indexOf("\r\n") === -1 || paused) {
                return null;
            }
            
            var readSplit = readBuffer.split("\r\n");
            var msg = readSplit.shift().split(" ");
            readBuffer = readSplit.join("\r\n");
            var command = {cmd:msg.shift(), param:msg.join(" ")};
            console.log(('<<< '+command.cmd).red, command.param);
            client.emit('command', command);
        };
        
        // prevent any more commands being read from the control link for a while
        client.pause = function(){
            paused = true;
            client.emit('paused');
        };
        // resume accepting commands on the control link
        client.resume = function(){
            paused = false;
            client.emit('resume');
        };
        
        // send a response to the client
        client.send = function(code, text) {
            var codeColour = 'white';
            switch (code.toString().substr(0,1)) {
                case '1': codeColour = 'lime'; break;
                case '2': codeColour = 'green'; break;
                case '3': codeColour = 'cyan'; break;
                case '4': codeColour = 'yellow'; break;
                case '5': codeColour = 'red'; break;
            }
            console.log('>>>'.cyan, code.toString()[codeColour], text);
            socket.write(code + ": " + text + "\r\n");
        };
        
        // add incoming data to the read buffer
        socket.on('readable', function(){
            // if command link is paused, don't read from the buffer
            if (paused) return;
            // else, read data from the buffer
            var readData = socket.read();
            if (readData === null) return;
            readBuffer += readData.toString();
            // try to parse buffer for a command
            client.receive();
        });
        
        // handle disconnects
        socket.once('end', function(){
            socket.removeAllListeners('readable');
            console.log('!!!'.yellow, 'Client disconnected');
            client.emit('disconnected');
        });
        
        // ok, all ready to go
        console.log('!!!'.yellow, 'Client connected');
        newClientCallback && newClientCallback(client);
    });

    server.listen(port, function(){
        console.log('!!!'.yellow, 'Listening on port ' + server.address().port);
    });

};

createControlLink(21, function(client){
    client.on('command', function(command){
        switch (command.cmd) {
            // useful info:
            // http://www.ietf.org/rfc/rfc959.txt
            // http://en.wikipedia.org/wiki/List_of_FTP_server_return_codes
            case 'USER': // Here's a username
                //if (msg.param == 'theusername')
                client.send(331, "Password required");
                break;
            case 'PASS': // Here's a password
                //if (msg.param == 'thepassword')
                client.send(230, "User logged in");
                break;
            case 'PWD': // What is the present working directory?
                client.send(257, "\"/\" is current directory");
                break;
            case 'TYPE': // Set TYPE
                client.send(200, "Type set to "+command.param);
                break;
            case 'PASV': // Enter Passive mode?
                client.pause();/*
                PASV(client, function(pasv){
                    paused = false;
                    c.write("227: Entering Passive Mode ("+pasv.address+").\r\n");
                    // pasv.onclient, set dataLink = 
                });*/
                break;
            case 'NOOP': // No operation
            case 'CLNT': // Client is trying to tell us what agent they're using
            case 'QUIT': // Client is signing off
                client.send(200, "That's fine, whatever");
                break;
            case 'LIST':
            /*
                if (!dataLink) {
                    c.write("503: Must establish passive connection first\r\n");
                    break;
                }
                
                c.write("125: Data connection open - starting transfer\r\n");
                dataLink.write("test.txt\r\n");*/
                break;
            default: // we don't understand the command
                client.send(502, "Command not implemented");
                break;
        }
    });

    client.send(220, 'Control link ready');
});
