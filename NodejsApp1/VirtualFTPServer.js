var net = require('net');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('underscore');
require('colors');

var PASV = function(options, cb) {
    options = _.extend({
        timeout         : 1000 * 5, // 5 seconds should be long enough to establish ANY connection, right?
        localAddress    : '127.0.0.1',
        remoteAddress   : '0.0.0.0',
        transferType    : 'I',
//        writeTo         : null  // this can be a writable stream, like a file stream.
                                // if empty, will emit "data" event containing in-memory buffer
    }, options || {});
    
    var pasv = new EventEmitter();
    
    // if we specify a write stream before a client connects to the PASV port,
    // we should be able to change the data destination.
    /*
    pasv.pipe = function(stream){
        return options.writeTo = stream;
    };
*/
    var establishingTimeout;
    
    var server = net.createServer(function(socket){
    
        if (socket.remoteAddress != options.remoteAddress) {
            // prevent PASV connection theft
            // http://cr.yp.to/ftp/security.html
            socket.destroy();
            return;
        }
    
        // Connection accepted; stop accepting more connections on this port
        server.close();
        clearTimeout(establishingTimeout);
        
        pasv.socket = socket;
        pasv.emit('connect', socket);
        /*
        if (options.writeTo) {
            // pipe data directly into our writable stream
            socket.pipe(options.writeTo);
        } else {
            // if we don't have anywhere to write the data, buffer it and emit an event on end
            var readBuffer = new Buffer(0);
            
            socket.on('data', function(data){
                // add data to our read buffer
                readBuffer = Buffer.concat([readBuffer, data]);
            });
            
            // socket closed by the other end
            socket.once('end', function(){
                socket.removeAllListeners('data');
                // if readBuffer contains data, notify anyone who cares
                if (readBuffer.length) {
                    pasv.emit('data', readBuffer);
                }
            });
        }
        */
        socket.once('close', function(){
            pasv.emit('close');
        });
        
        socket.once('error', function(){
            socket.destroy();
        });
        
        socket.once('timeout', function(){
            socket.end();
        });
        
        socket.setTimeout(1000 * 30); // this is the data transfer timeout, not the connection establishing timeout
    });
    
    // THIS is the connection establishing timeout
    establishingTimeout = setTimeout(function(){
        pasv.emit('timeout');
        server.close();
        server.removeAllListeners();
        server = null;
    }, options.timeout);
    
    server.listen(function(){
        var a = server.address();
        
        var address = options.localAddress.split('.');
        address.push((a.port / 256) << 0);
        address.push(a.port % 256);
        
        pasv.address = address;
        cb&&cb(null, pasv);
    });
};

var createControlLink = function(options, newClientCallback){

    options = _.extend({
        port    : 21,
        debug   : false
    }, options || {});
    
    var log = function(/*party, msgN, ...*/){
        if (!options.debug) return;
        var args = _.toArray(arguments);
        var lead = '';
        switch (args.shift()) {
            case 0: lead = '!!!'.yellow; break;
            case 1: lead = '>>>'.cyan; break;
            case 2: lead = '<<<'.red; break;
        }
        args.unshift(lead);
        console.log.apply(console, args);
    };

    var server = net.createServer(function(socket){
        
        var client = new EventEmitter()
          , readBuffer = ''
          , paused = false
          , dataLink = null
          ;

        client.socket = socket;

        // receive a command from the client if ready
        client.receive = function(){
            // if command link is paused, don't read from the buffer
            if (paused) return;
            // else, read data from the buffer
            var readData = socket.read();
            if (readData === null) return;
            readBuffer += readData.toString();
            
            if (readBuffer.indexOf("\r\n") === -1 || paused) {
                return null;
            }
            
            var readSplit = readBuffer.split("\r\n");
            var msg = readSplit.shift().split(" ");
            readBuffer = readSplit.join("\r\n");
            var command = {cmd:msg.shift(), param:msg.join(" ")};
            log(2, command.cmd.red, command.param);
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
            client.receive();
        };
        
        // send a response to the client
        client.send = function(code, text) {
            if (!util.isArray(text)) {
                text = [text];
            }
            
            var codeColour = 'white';
            switch (code.toString().substr(0,1)) {
                case '1': codeColour = 'cyan'; break;
                case '2': codeColour = 'green'; break;
                case '3': codeColour = 'cyan'; break;
                case '4': codeColour = 'yellow'; break;
                case '5': codeColour = 'red'; break;
            }
            
            while (text.length) {
                var t = text.shift();
                log(1, code.toString()[codeColour] + (text.length?"-":" ") + t);
                socket.write(code + (text.length?"-":" ") + t + "\r\n");
            }
        };
        
        // add incoming data to the read buffer
        socket.on('readable', function(){
            // try to parse buffer for a command
            client.receive();
        });
        
        var disconnect = _.once(function(){
            socket.removeAllListeners('readable');
            socket.destroy();
            log(0, 'Client disconnected');
            client.emit('disconnected');
        });
        
        // handle disconnects
        socket.once('close', disconnect);
        socket.once('end', disconnect);
        socket.once('error', disconnect);
        socket.once('timeout', disconnect);
        socket.setTimeout(1000 * 120);
        
        // ok, all ready to go
        log(0, 'Client connected');
        newClientCallback && newClientCallback(client);
    });

    server.listen(options.port, function(){
        log(0, 'Listening on port ' + options.port);
    });

};

var VirtualFTPServer = function(serverWelcome, options) {

    options = _.extend({
        port    : 21,
        debug   : false
    }, options || {});

    var vftp = this;

    createControlLink(options, function(client){
        var dataLink        = null;
        var transferType    = "L8";
        var authedUser      = null; // user name authenticated by system
        var namedUser       = null; // user name specified in last USER command

        client.on('command', function(command){
            switch (command.cmd) {
                // useful info:
                // http://cr.yp.to/ftp/security.html
                // http://www.ietf.org/rfc/rfc959.txt
                // http://en.wikipedia.org/wiki/List_of_FTP_server_return_codes
                case 'USER': // Here's a username
                    namedUser = command.param;
                    client.send(331, "Password required");
                    break;
                case 'PASS': // Here's a password
                    if (!namedUser) return client.send(503, "Need username first");
                    vftp.emit("auth", namedUser, command.param, _.once(function(err){
                        if (err) {
                            namedUser = null;
                            return client.send(530, "Not authorised");
                        }
                        
                        authedUser = namedUser;
                        client.send(230, "User logged in");
                    }));
                    break;
                case 'PWD': // What is the present working directory?
                    if (!authedUser) return client.send(530, "Not authorised");
                    client.send(257, "\"/\" is current directory");
                    break;
                case 'TYPE': // Set TYPE
                    if (!authedUser) return client.send(530, "Not authorised");
                    transferType = command.param;
                    client.send(200, "Type set to "+transferType);
                    break;
                case 'PASV': // Enter Passive mode?
                    if (!authedUser) return client.send(530, "Not authorised");
                    client.pause();
                    PASV({
                        transferType    : transferType,
                        localAddress    : client.socket.localAddress,
                        remoteAddress   : client.socket.remoteAddress
                    }, _.once(function(err, pasv){
                        if (err) {
                            client.send(421, "Couldn't create data link");
                            client.resume();
                        }
                        
                        pasv.once('connect', function(){
                            dataLink = pasv;
                            client.resume();
                        });
                        
                        client.send(227, "Entering Passive Mode ("+pasv.address+").");
                        
                        pasv.once('timeout', function(){
                            // timed out waiting for client to connect to our PASV server
                            pasv.removeAllListeners('connect');
                            client.resume();
                        });
                    }));
                    break;
                case 'NOOP': // No operation
                case 'CLNT': // Client is trying to tell us what agent they're using
                case 'QUIT': // Client is signing off
                    client.send(200, "That's fine, whatever");
                    break;
                    /*
                case 'LIST':
                    if (!authedUser) return client.send(530, "Not authorised");
                    if (!dataLink) {
                        client.send(503, "Must establish data link first");
                        break;
                    }
                    
                    client.send(150, "Starting transfer");
                    dataLink.socket.end("");
                    client.send(226, "Transfer complete");
                    break;
                    */
                case 'SIZE': // What size is this file?
                    if (!authedUser) return client.send(530, "Not authorised");
                    client.send(213, 0);
                    break;
                case 'CWD': // Change working directory
                    if (!authedUser) return client.send(530, "Not authorised");
                    client.send(250, "Sure, that's fine");
                    break;
                case 'FEAT': // What features does this FTP server have?
                    client.send(211, ["Features:\r\n NLST\r\n PASV", "End"]);
                    break;
                case 'SYST': // What system is this FTP server running on?
                    client.send(215, "UNIX Type: "+transferType);
                    break;
                case 'STOR': // Client wants to send us a file
                    if (!authedUser) return client.send(530, "Not authorised");
                    if (!dataLink) {
                        client.send(503, "Must establish data link first");
                        break;
                    }
                    
                    client.send(150, "Start transferring");
                    vftp.emit('stor', authedUser, command.param, dataLink.socket, _.once(function(err){
                        if (err) {
                            dataLink.socket.end();
                            return client.send(426, "Error receiving file");
                        }
                        client.send(226, "Transfer complete");
                    }));
                    break;
                case 'DELE': // Client wants to delete a file
                    client.send(250, "Deleted file");
                    break;
                default: // we don't understand the command
                    client.send(502, "Command not implemented");
                    break;
            }
        });

        client.send(220, [serverWelcome, "FTP Control link ready"]);
    });

};
VirtualFTPServer.prototype.__proto__ = EventEmitter.prototype; // inherit from EventEmitter

module.exports = VirtualFTPServer;
