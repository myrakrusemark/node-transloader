var express 	= require('express');
var router 		= express.Router();

var request 	= require('request');
var Dropbox 	= require('dropbox');   
var socketio 	= require('socket.io');
var fs 			= require('fs');
var colors 		= require('colors');
var tools		= require('./functions/misc');
var dropboxTools= require('./functions/dropbox');
var dbTools 	= require('./functions/db');


var socket 		= global.socket;
var db 			= global.db;

var usersName 	= '',
downloadDir = 'downloads',
authLinkPre = 'https://www.dropbox.com/1/oauth2/authorize?client_id=gi8ihcnep3sxr13&response_type=code&redirect_uri=',
authLinkPost = '&state=1234567890';

module.exports.listen;



router.get('/', function(req, res) {
	tools.log('Loading /');

	var currentHost = 'https://'+req.headers.host;	




	var getAuthStuffDone = function(callback){

		if(typeof req.query.code === 'string' && req.query.code.length === 43){

			dropboxTools.logInConfirm("index/getAuthStuffDone", req.query.code, function(appKey){

				if(typeof appKey == 'string' && appKey.length === 64){

					var client = new Dropbox.Client({token: appKey});

				    client.getAccountInfo(function(error, accountInfo) {
						if (error) {
							tools.log("Error retrieving account info", 1);
						}

						tools.log("User logged in"); //uid

						usersName = accountInfo.name;

					    callback();

					}); 

				}else{

					tools.log("Not logged in. Authenticating.");

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
									tools.log("Error retrieving account info", 1);
								}

								usersName = accountInfo.name;

								var time = +new Date;

								dbTools.addUpdateUser({
							        appKey 			: appKey,
							        uid				: uid,
							 		name 			: usersName,
							 		code 			: req.query.code,
							 		logInTime		: time,
							 		loginTimePretty : Date()
							    });	

							    callback(); //getAuthStuffDone

							}); 
						}else{
							tools.log("Auth failed. Code may have already been used.", 1);
							callback(); //getAuthStuffDone
						}
		
					})			
				}
			})

		}else{
			tools.log("No code in header or cookie. Not logged in.", 1);
			callback(); //getAuthStuffDone
		}

	}



	getAuthStuffDone(function(){
		var currentDate = new Date;

		res.render('index', { 
			title		: 'The Transloader',
			year 		: currentDate.getFullYear(),
			authLink 	: authLinkPre+currentHost+authLinkPost,
			name 		: usersName
		});	
	})




});

router.get('/log-in', function(req, res) {
	tools.log('Loading /log-in');
	var r = res;

	dropboxTools.logInConfirm("log-in", req.query.code, function(ret){
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


	








	







