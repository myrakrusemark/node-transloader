var express = require('express');
var router = express.Router();

var request = require('request');
var Dropbox = require('dropbox');   
var socketio = require('socket.io');
var exec = require('child_process').exec;
var fs = require('fs');

var io = global.io;
var db = global.db;

var usersName = '';
var downloadDir = 'downloads';
var redirectURL = 'https://transloader.org:8000';
var authLinkPre = 'https://www.dropbox.com/1/oauth2/authorize?client_id=gi8ihcnep3sxr13&response_type=code&redirect_uri=';
var authLinkPost = '&state=1234567890';

module.exports.listen;

io.on('connect', function(socket){

	socket.on('downloadFile', function(data){
		//console.log(data);
		downloadFile(data.code, data.url);
	});

	socket.on('userInfo', function(data){
		//console.log(data);
		userInfo(data.code);
	});

	socket.on('delete', function(data){
		//console.log(data);
		deleteFile(data.code, data.file);
	});

})



router.get('/', function(req, res) {	
	log('Loading /');

	if(typeof req.query.url == "string"){
		//res.redirect(authLinkPre+redirectURL+authLinkPost)
		console.log(req.query.url);
	}

	io.on('connection', function(socket){

		if(typeof req.query.code === 'string'){
	    	log("Joining room - "+req.query.code);
    		socket.join(req.query.code);

		}else{
			log("Can't connect socket. No code. Not logged in.", 1);
		}

	});

	var getAuthStuffDone = function(callback){

		if(typeof req.query.code === 'string' && req.query.code.length === 43){

			logInConfirm("index/getAuthStuffDone", req.query.code, function(appKey){

				if(typeof appKey == 'string' && appKey.length === 64){

					var client = new Dropbox.Client({token: appKey});

				    client.getAccountInfo(function(error, accountInfo) {
						if (error) {
							log("Error retrieving account info", 1);
						}

						log("User logged in"); //uid

						usersName = accountInfo.name;

					    callback();

					}); 

				}else{

					log("Not logged in. Authenticating.");

					var headers = {
					    'User-Agent':       'Super Agent/0.0.1',
					    'Content-Type':     'application/x-www-form-urlencoded' 
					},
					data = {
					    "code":req.query.code, 
					    "grant_type":"authorization_code",
					    "client_id":"gi8ihcnep3sxr13",
					    "client_secret":"1vrjqtxthgvl0oo",
					    "redirect_uri":"https://"+req.get('host')
					  },
					options = {
					    url: 'https://api.dropbox.com/1/oauth2/token',
					    method: 'POST', 
						username: "gi8ihcnep3sxr13",
						password: "1vrjqtxthgvl0oo",
					    headers: headers,
					    form: data
					};

					var requestAuth = function(headers, data, options, callback){
						// Start the request
						request(options, function (error, response, body) {

							if(error){
								log("ERROR: "+body, 1);
							}
						    if (!error && response.statusCode != 200) {
						    	appKey = -1;
						    	log("Status code not 200: "+response.statusCode, 1);
						    	console.error(body);
						    	callback(0);

							}
						    if (!error && response.statusCode == 200) {
						        // Print out the response body
						        //console.log(body);
						        requestData = JSON.parse(body);
						        if("access_token" in requestData){

						        	callback(requestData);

								}
						    }

						}) 
					}

					requestAuth(headers, data, options, function(requestData){

						if(typeof requestData == 'object'){
				       		var appKey = requestData.access_token,
				        	uid = requestData.uid,
						    client = new Dropbox.Client({token: appKey});

						    client.getAccountInfo(function(error, accountInfo) {
								if (error) {
									log("Error retrieving account info", 1);
								}

								usersName = accountInfo.name;

								addUpdateUser({
							        "appKey" 	: appKey,
							        "uid" 		: uid,
							 		"name" 		: usersName,
							 		"code" 		: req.query.code

							    });	

							    callback(); //getAuthStuffDone

							}); 
						}else{
							log("Auth failed. Code may have already been used.", 1);
							callback(); //getAuthStuffDone
						}
		
					})			
				}
			})

		}else{
			log("No code in header or cookie. Not logged in.", 1);
			callback(); //getAuthStuffDone
		}

	}



	getAuthStuffDone(function(){
		var currentDate = new Date;

		res.render('index', { 
			title	: 'The Transloader',
			year 	: currentDate.getFullYear(),
			authLink: authLinkPre+redirectURL+authLinkPost,
			name 	: usersName
		});	
	})




});

router.get('/log-in', function(req, res) {
	log('Loading /log-in');
	var r = res;

	logInConfirm("log-in", req.query.code, function(ret){
		if(typeof ret == 'string' && ret.length == 64){
			r.send('1');		//Logged In
		}else if(ret == -1){
			r.send('-1'); 		//LogIn error
		}else{
			r.send('0'); 		//Logged out
		}

		r.end();			


	});
	

});		

module.exports = router;


var userInfo = function(code){

	var info = {loggedIn:'', 
		name:'', 
		list:''
	};

	if(typeof code === 'string' && code.length == 43){

		getAppKey("user-info", code, function(appKey){
			if(typeof appKey == 'string' && appKey.length === 64){

				var client = new Dropbox.Client({token:appKey});

			    var getInfo = function(callback){

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

				getInfo(function(info){
						io.to(code).emit('userInfo', info);

				});
			}
			
		})
	}else{
		log('No code present. Cannot get info.', 1);
		info.loggedIn = 0;
		io.to(code).emit('userInfo', info);
	}


};	

/////>>>>>>

function downloadFile(code, url){

	console.log("\n\nDOWNLOAD FILE\n")
	if(typeof url === "string"){

		var time = +new Date;

		if(url.substring(0, 5) == "data:"){
			log("Link is 64-bit encoded.");

			logInConfirm("download-file", code, function(appKey){

				var client = new Dropbox.Client({token:appKey});

				var type = url.substring(0, 100);
				type = type.split(":")[1];
				type = type.split(";")[0];
				type = type.split("/")[1];
				base64Data = url.split("base64,")[1];
				base64Data  +=  base64Data.replace('+', ' ');
				base64Data   =   new Buffer(base64Data, 'base64');

				var filePathName = downloadDir+'/'+time+'.'+type;

				console.log("Type is "+type);

				getInfo(client, function(ret){
					addDownloadInfo({
						time: time,
						uid: ret.uid,
						'name':ret.name,
						'file_url':file_url,
						'filename':filename,
						'file_ext':file_ext,
						'file_size': 0,

					});	
				});
				fs.writeFile(filePathName, base64Data, function(err) {
					if(err)
						log(err, 1);

					uploadToDropbox(client, {
						code: code,
						filePathName: filePathName,
						fileName: "file."+type,
						file_pre: "file",
						file_ext: type,
						time: time
					}, function(ret){
						log(ret);
					});


				});
			})


		}else if(validateURL(url)){
			var file_url = url;
			var filename = file_url.substring(file_url.lastIndexOf('/')+1).split("?")[0];
			var re = /(?:\.([^.]+))?$/;
			var file_pre = filename.split('.')[0];
			var file_ext = re.exec(filename)[1];
			var userInfo;


			console.log(filename+' '+file_ext);

			if(typeof code === 'string'){

				getAppKey("download-file", code, function(appKey){

					var client = new Dropbox.Client({token:appKey});



					getInfo(client, function(ret){

						if(typeof ret === "object"){

						    var child = require('child_process')
							  .spawn('wget', ['--spider', file_url]);

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
										console.log("Filesize: "+totalSize);
										callback(totalSize);			
									}

									stripSize(function(totalSize){

										if(totalSize > 52500000){
											log("File too big. Stay under 50MB", 1);
											io.to(code).emit('status', { status: '2' }); //File too big
										}else{
											var totalChunks = 0;

											var out = fs.createWriteStream(downloadDir+'/'+time+'.'+file_ext); 

											var r = request({
											    method: 'GET',
											    uri: file_url
											});
											r.pipe(out);


											r.on('data', function (chunk)
											{
											    totalChunks = totalChunks + chunk.length;


													io.to(code).emit('status', { status: '1', percentage: Math.round((totalChunks/totalSize)*100)+'' });
											
											    if(totalChunks == totalSize){

											    	var filePathName = downloadDir+'/'+time+'.'+file_ext;

											    	fs.exists(filePathName, function(exists) {
													    if (exists) {
											    			log(filename+" downloaded.");
											    			io.to(code).emit('status', { status: '0' });

															uploadToDropbox(client, {
																code: code,
																filePathName: filePathName,
																fileName: filename,
																file_pre: file_pre,
																file_ext: file_ext,
																time: time
															}, function(ret){
																console.log(ret);
															});

											    			
													    }

													});


											    }

										    	
											

											});

											addDownloadInfo({
												time: time,
												uid: ret.uid,
												name:ret.name,
												file_url:file_url,
												filename:filename,
												file_ext:file_ext,
												file_size: 0,

											});										
										}
										

									});

								}
							});





						}else{
							console.log(ret);
						}

					});



				});
			}else{
				log('No code present. Cant log in.', 1);
			}

		}else{
			log('URL not valid.', 1);
			io.to(code).emit('status', { status: '7'}); //Bad URL
		}




	}else{
		log("No URL present.", 1);
	}

}

function uploadToDropbox(client, info, callback){


	var checkNames = function(callback){
		client.readdir("/", function(error, entries) {
		  if (error) {
		    return showError(error);  // Something went wrong.
		  }
		  
		  var file_num = 1;

		  var findDupes = function(filename, entries, callback){
			  for(var i=0; i <= entries.length; i++){

					if(entries.length == 0){ //no files in directory
						callback(filename);

					}else if(entries[i] == filename){ //duplicate filename found

						filename = renameDupe(entries[i], filename, entries);

						findDupes(filename, entries, function(ret){
							filename = ret;
							callback(filename); //finally callback with new filename
						});

					}else if(i == entries.length-1){ //if no dupes found, callback immediately

						callback(filename);
						//break;
					}

					
					
			  }	


		  }

		  var renameDupe = function(entry, filename, entries, callback){
			file_num++;

			newName = info.file_pre + ' ('+ (file_num) +').'+info.file_ext;

			return newName;

			
		  }

		  findDupes(info.fileName, entries, function(ret){
		  	callback(ret);
		  });
			

		});
	}
	
	checkNames(function(ret){
		fs.readFile(downloadDir+'/'+info.time+'.'+info.file_ext, function(error, data) {
		  // No encoding passed, readFile produces a Buffer instance
			if (error) {
				log("Couldnt find file", 1);
				return handleNodeError(error);
			}


			log("Transloading");
			client.writeFile(ret, data, function(error, stat) { 
				if(stat.isFile){
					log(ret+" transloaded");
					io.to(info.code).emit('status', { status: '3'}); //Upload to Dropbox successful
				}

				if (error) {
					log(ret+" not transloaded", 1);

					io.to(info.code).emit('status', { status: '6'}); //Upload to Dropbox not successful
				}
				// The image has been succesfully written.
			});


		});

	});

}

var getInfo = function(client, callback){

	client.getAccountInfo(function(error, accountInfo) {
		if (error) {
			log("Cant get user info: "+error+appKey, 1)
			callback();
		}else{
			callback(accountInfo);

		}
	});

};

function deleteFile(code, file){

	logInConfirm("delete-file", code, function(appKey){
		var client = new Dropbox.Client({token:appKey});

		client.readdir("/", function(error, entries) {
			console.log(entries.length-1+' '+file);

			if(file > entries.length-1){
				log("File beyond index. May have clicked to quick!", 1);
				io.to(code).emit('status', { status: '5' }); //File not deleted
			}else if(entries.length > 0){

				var fileName = entries[file];

				log("Deleting "+fileName);
				client.unlink(fileName, function (err, data) {

			    	if (err){
			    		console.error(err.stack.red)
			    		io.to(code).emit('status', { status: '5', fileName: fileName}); //File not deleted
			    	}else{
			    		log(fileName+' deleted.');
			    		io.to(code).emit('status', { status: '4', fileName: fileName }); //File deleted
		
			    	}

			    })

			}else{

				log("No files to delete.", 1);
				io.to(code).emit('status', { status: '5' }); //File not deleted

			}

		});

	})
	

}	

function logInConfirm(orig, code, callback){

	if(typeof code === 'string'){
		getAppKey(orig+"/logInConfirm", code, function(appKey){
			if(appKey == 0){
				log("appKey not in db. Not Logged in.", 1)
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
						log("Logged in, "+name);
						callback(appKey);
						//return 1;

					}else{
						log("Not logged in, "+name, 1);
						callback(-1);

						//return 0;

					}

				});				
			}

		})	
	}else{
		log("No code given. Not logged in", 1);
		callback(0);

		//return 0;
	}
}

function getAppKey(orig, code, callback){


	//console.log(code);
	var collection = db.get('users');

    collection.find({"code":code},{},function(e,docs){
    	if(docs.length == 0){
    		log("No code in db. Not logged in.", 1);
    		callback(0);
    	}else{
    		callback(docs[0].appKey);
    	}
    	//console.log(docs[0]);
        
    });

}

function addDownloadInfo(downloadInfo){

	console.log("Adding download info...");

    // Set our collection
    var collection = db.get('downloads');

    // Submit to the DB
    collection.insert(downloadInfo, function (err, doc) {
        if (err) {
            // If it failed, return error
            log("There was a problem adding the information to the database.", 1);
        }
        else {

            log("Download entry added.");
        }
    });

}

function addUpdateUser(userInfo){

	var collection = db.get('users');
    var ret = 0;

    collection.find({"uid":userInfo.uid},{},function(e,docs){
        ret = docs.length

        if(docs.length > 0){
			updateUser(userInfo)
        }else{
        	addUser(userInfo)
        }
    });
}

function addUser(userInfo){

    // Set our collection
    var collection = db.get('users');

    // Submit to the DB
    collection.insert(userInfo, function (err, doc) {
        if (err) {
            // If it failed, return error
            log("There was a problem adding the user to the database.", 1);
        }
        else {

            log("User added.");
        }
    });

}

function updateUser(userInfo){

    // Set our collection
    var collection = db.get('users');

    // Submit to the DB
    collection.update({"uid" : userInfo.uid}, userInfo, function (err, doc) {
        if (err) {
            // If it failed, return error
            log("There was a problem updating the user information.", 1);
        }
        else {

            log("User updated.");
        }
    });

}

/***OTHER***/
var get_total_num_docs = function(db_client, query, cb){
  db_client.collection(query['collection'], function(e, coll) {
    coll.find(query.params, query.options).count(function (e, count) {
      return cb(e, count);
    });
  });
};

function execute(command, callback){
	command = '\'' + command.replace(/\'/g, "'\\''") + '\'';
    exec(command, function(error, stdout, stderr){ callback(stdout); });
};

function validateURL(value) {
    return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value);
}

function log(msg, error){
	if(error == null)
		error = 0;

	function getErrorObject(){
	    try { throw Error('') } catch(err) { return err; }
	}	
	var err = getErrorObject();
	var caller_line = err.stack.split("\n")[4];
	var index = caller_line.indexOf("at ");
	var clean = caller_line.slice(index+2, caller_line.length);

	error?console.error(('ERROR '+clean+": "+msg).red):console.log(clean+": "+msg+'\n');
}