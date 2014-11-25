var Dropbox 	= require('dropbox');   
var request 	= require('request');
var tools		= require('./misc');

var fs 			= require('fs');


var logInConfirm = function(orig, code, callback){

	if(typeof code === 'string'){
		getAppKey(orig+"/logInConfirm", code, function(appKey){
			if(appKey == 0){
				tools.log("appKey not in db. Not Logged in.", 1)
				callback(-1);
			}else if(typeof appKey == 'string' && appKey.length == 64){
				var client = new Dropbox.Client({token:appKey});

		    	var getName = function(callback){

			    	client.getAccountInfo(function(error, accountInfo) {
						if (error) {
							callback(-1);
						}else{
							callback(accountInfo.name);

						}
					});	    		
		    	}

				getName(function(name){
					if(typeof name === 'string'){
						tools.log("Logged in, "+name);
						callback(appKey);

					}else{
						tools.log("Not logged in, "+name, 1);
						callback(-1);

					}

				});				
			}

		})	
	}else{
		tools.log("No code given. Not logged in", 1);
		callback(0);

	}
}

function getAppKey(orig, code, callback){

	var collection = db.get('users');

    collection.find({"code":code},{},function(e,docs){
    	if(docs.length == 0){
    		tools.log("No code in db. Not logged in.", 1);
    		callback(0);
    	}else{
    		callback(docs[0].appKey);
    	}
        
    });

}

var getInfo = function(client, callback){

	client.getAccountInfo(function(error, accountInfo) {
		if (error) {
			tools.log("Cant get user info: "+error+appKey, 1)
			callback();
		}else{
			callback(accountInfo);

		}
	});

};

function uploadToDropbox(client, io, downloadDir, info, callback){
console.log("UPLOADING. HELLO");
	client.readdir("/", function(error, entries) {
		if (error) {
			return showError(error);  // Something went wrong.
		}

		tools.checkNames(info.fileName, entries, function(fileName){ //Check fileName agains DB directoy for duplicate names

			fs.readFile(downloadDir+'/'+info.time+'.'+info.ext, function(error, data) {
			  // No encoding passed, readFile produces a Buffer instance
				if (error) {
					tools.log("Couldn't write file to server", 1);
					io.to(info.code).emit('status', { status: '6'}); //Upload to Dropbox not successful	
				}else{
					tools.log("Transloading");
					client.writeFile(fileName, data, function(error, stat) { 


						if(typeof stat == 'object'){
							if(typeof stat.isFile == 'boolean' && stat.isFile == true){
								tools.log(fileName+" transloaded");
								callback(1);
								io.to(info.code).emit('status', { status: '3'}); //Upload to Dropbox successful
							}else{
								tools.log(fileName+" not transloaded", 1);
								callback(0);

								io.to(info.code).emit('status', { status: '6'}); //Upload to Dropbox not successful		
							}

							if (error) {
								tools.log(fileName+" not transloaded", 1);
								callback(0);

								io.to(info.code).emit('status', { status: '6'}); //Upload to Dropbox not successful
							}
							// The image has been succesfully written.									
						}else{
							io.to(info.code).emit('status', { status: '9'}); //Error. Upload may have worked.
						}
	
										

					});					
				}





			});

		});
	});
}

module.exports = {

	transloadFile: function(io, code, downloadDir, url){

		tools.log("\n\nDOWNLOAD FILE\n");


		if(typeof url === "string"){

			var time = +new Date;

			if(url.substring(0, 5) == "data:"){ //base64 encoded
				tools.log("Link is 64-bit encoded.");

				logInConfirm("download-file", code, function(appKey){

					var client 	= new Dropbox.Client({token:appKey});

					var type 	= url.substring(0, 100);
					type 		= type.split(":")[1];
					type 		= type.split(";")[0];
					type 		= type.split("/")[1];
					base64Data 	= url.split("base64,")[1];
					base64Data  +=  base64Data.replace('+', ' ');
					base64Data  =   new Buffer(base64Data, 'base64');

					var filePathName = downloadDir+'/'+time+'.'+type;

					tools.log("Type is "+type);

					getInfo(client, function(ret){
						tools.addDownloadInfo({
							uid: 		ret.uid,
							name: 		ret.name,
							url: 		"base64-encoded-data",
							filename: 	"base64file",
							ext: 		type,
							size: 		url.length,
							time: 		time,
							timePretty 	: Date()


						});	
					});

					fs.writeFile(filePathName, base64Data, function(err) {
						if(err)
							tools.log(err, 1);

						uploadToDropbox(client, io, downloadDir, {
							code: 			code,
							fileName: 		"base64file."+type,
							ext: 			type,
							time: 			time
						}, function(ret){
							//tools.log(ret);
						});



					});
				})


			}else if(tools.validateURL(url)){
				var userInfo;

				if(typeof code === 'string'){

					logInConfirm("download-file", code, function(appKey){

						if(typeof appKey == 'string' && appKey.length == 64){

							var client = new Dropbox.Client({token:appKey});

						    var child = require('child_process')
							  .spawn('wget', ['--spider', url]);

							var fullData = '';

							child.stderr.on('data', function (data) {

								fullData = fullData + data;

							});

							child.stderr.on('close', function () {
								var index = fullData.indexOf("Length: ");

								if(index > -1){
									var stripSize = function(callback){
										var str = fullData.substring(index+8, index+30);
										var index2 = str.indexOf(" ");
										var totalSize = str.substring(0, index2);
										tools.log("Filesize: "+totalSize);
										callback(totalSize);			
									}

									stripSize(function(totalSize){

										if(totalSize > 52500000){
											tools.log("File too big. Stay under 50MB", 1);
											io.to(code).emit('status', { status: '2' }); //File too big
										}else{

											if(typeof totalSize == "string" && totalSize == "unspecified"){ //File size unknown
												io.to(code).emit('status', { status: '8' });
												totalSize = -1;
												var downloadTime = new Date().getTime();
												var currentDownloadTime = new Date().getTime();

												var downloadTimer = setInterval(function(){
													currentDownloadTime = new Date().getTime();
													if(currentDownloadTime - downloadTime > 2000){
														console.log("DOWNLOAD DONE");
														commenceUpload();
														clearInterval(downloadTimer);
													}
												}, 1000);
											}

											var totalChunks = 0;

											var out = fs.createWriteStream(downloadDir+'/'+time+'.'+tools.urlSplit(url).ext); 

											var r = request({
											    method: 'GET',
											    uri: url
											});
											r.pipe(out);


											r.on('data', function (chunk)
											{
												totalChunks = totalChunks + chunk.length;
												if(totalSize === -1){ //Unknown file size
													downloadTime = +new Date;
												}else{
													io.to(code).emit('status', { status: '1', percentage: Math.round((totalChunks/totalSize)*100)+'' });
													if(totalChunks == totalSize){
												    	console.log("DONWLOADED")
												    	
												    	commenceUpload();

											    	}													
												}


											});

											var commenceUpload = function(){
										    	var filePathName = downloadDir+'/'+time+'.'+tools.urlSplit(url).ext;

										    	fs.exists(filePathName, function(exists) {
												    if (exists) {
										    			tools.log(tools.urlSplit(url).fileName+" downloaded.");
										    			io.to(code).emit('status', { status: '0' });
														
														uploadToDropbox(client, io, downloadDir, {
															code: 			code,
															fileName: 		tools.urlSplit(url).fileName,
															ext: 			tools.urlSplit(url).ext,
															time: 			time
														}, function(ret){
															//console.log(ret);
														});

										    			
												    }

												});												
											}


											getInfo(client, function(ret){

												tools.addDownloadInfo({
													uid 		: ret.uid,
													name 		: ret.name,
													url 		: url,
													filename 	: tools.urlSplit(url).fileName,
													ext 		: tools.urlSplit(url).ext,
													file_size 	: totalSize,
													time 		: time,
													timePretty 	: Date()

												});		
											});							
										}
										

									});

								}
							});





						}else{
							tools.log('No appKey found. Cant log in.', 1);
						}
					});

				}else{
					tools.log('No code present. Cant log in.', 1);
				}

			}else{
				tools.log('URL not valid.', 1);
				io.to(code).emit('status', { status: '7'}); //Bad URL
			}




		}else{
			tools.log("No URL present.", 1);
		}

	},

	logInConfirm: logInConfirm,

	userInfo: function(io, code){

		var info = {loggedIn:'', 
			name:'', 
			list:''
		};

		if(typeof code === 'string' && code.length == 43){

			logInConfirm("log-in", code, function(appKey){
				if(typeof appKey == 'string' && appKey.length === 64){

					var client = new Dropbox.Client({token:appKey});

				    var getUserInfo = function(callback){

				    	var getName = function(callback){

					    	client.getAccountInfo(function(error, accountInfo) {
								if (error) {
									callback(0);
								}else{
									callback(accountInfo.name);

								}
							});	    		
				    	}

				    	getName(function(ret){
				    		if(typeof appKey == 'string'){
								client.readdir("/", function(error, entries) {
									if (error) {
										return showError(error);  // Something went wrong.
									}

									info.loggedIn = 1;
									info.name = ret+'';
									info.list = entries;
									callback(info);

								});
				    		}else{
				    			info.loggedIn = 0;
				    			callback(info)
				    		}


							
				    	});

				    };

					getUserInfo(function(info){
							io.to(code).emit('userInfo', info);

					});
				}
				
			})
		}else{
			tools.log('No code present. Cannot get info.', 1);
			info.loggedIn = 0;
			io.to(code).emit('userInfo', info);
		}


	},

	deleteFile: function(io, code, file){

		logInConfirm("delete-file", code, function(appKey){
			var client = new Dropbox.Client({token:appKey});

			client.readdir("/", function(error, entries) {

				if(file > entries.length-1){
					tools.log("File beyond index. May have clicked to quick!", 1);
					io.to(code).emit('status', { status: '5' }); //File not deleted
				}else if(entries.length > 0){

					var fileName = entries[file];

					tools.log("Deleting "+fileName);
					client.unlink(fileName, function (err, data) {

				    	if (err){
				    		var errStack = err.stack;
				    		console.error(errStack)
				    		io.to(code).emit('status', { status: '5', fileName: fileName}); //File not deleted
				    	}else{
				    		tools.log(fileName+' deleted.');
				    		io.to(code).emit('status', { status: '4', fileName: fileName }); //File deleted
			
				    	}

				    })

				}else{

					tools.log("No files to delete.", 1);
					io.to(code).emit('status', { status: '5' }); //File not deleted

				}

			});

		})
		

	}
};
