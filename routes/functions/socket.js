var tools       = require('./misc');
var dropboxTools= require('./dropbox');

module.exports = function(io, socket){


    socket.on('userInfo', function(data){
        //console.log(data);

        dropboxTools.userInfo(io, data.code);
    });

    socket.on('delete', function(data){
        console.log("Received delete file message");
        dropboxTools.deleteFile(io, data.code, data.file);
    });


    socket.on('downloadFile', function(data){

        console.log("DONWLOADING")
                console.log(data);

        dropboxTools.transloadFile(io, data.code, 'downloads', data.url);
    });

};

