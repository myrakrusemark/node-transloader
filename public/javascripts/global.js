$(document).ready(function() {

	var code = -1;
    var socket = io.connect(window.location.href, {secure: true});
    //var socket = io.connect('http://54.69.210.152:8000/', {secure: false});

	if(typeof getURLVars()['code'] === 'string'){
		console.log("Setting cookie: "+getURLVars()['code']);
		setCookie("code", getURLVars()['code'], 1);
		code = getURLVars()['code'];
	}else if(getCookie("code")){
		//console.log(getCookie("appKey"));
		code = getCookie("code");
	}else{
		code = 0; //Not Logged In
	}


	var autoTransload = function(url){
		console.log('auto'+' '+url);
		$("#urlInput").text(url);

		var data = { 
			url:url,
			code:code 
		};

		downloadFile(socket, data);
	}

	if(typeof getCookie("url") == "string" && getCookie("url").length > 0){
		console.log('one')
		autoTransload(getCookie("url"));
		eraseCookie('url');


	}

	if(typeof getURLVars()['url'] === 'string'){ 
				console.log('two')

		logInConfirm(code, function(loggedIn){
			if(loggedIn){

				autoTransload(decodeURIComponent(getURLVars()['url']));

			}else{

				setCookie("url", decodeURIComponent(getURLVars()['url']), 1);
				window.location.assign($('#log-in').attr('href'));

			}
		})
	}



	logInConfirm(code, function(loggedIn){
		socket.emit("subscribe", { room: code });
		console.log(socket);

		if(loggedIn == 0){
			console.log("Logged Out")
		}else if(loggedIn == -1){
			alertify.error("Login Failure. :(");
			ga('send', 'event', 'auth', 'log-in-failure', code);
		}else{
			console.log("Logged In")

			alertify.log('Welcome! Loading...');
			ga('send', 'event', 'auth', 'log-in', code);
			refreshUserInfo(socket, code);

			$('.loggedIn').removeClass("hide");
    		$('.loggedOut').addClass('hide');

			socket.on('status', function (data) {

				switch(+data.status){
					case 0:
						console.log("Download to server successful."); 
						break;
					case 1:
						//Receiving percentage download value
						setProgressBarPercent('.progress', data.percentage);

						break;
					case 2:
						//console.error("File too big. >50MB.");
						alertify.error('File too big. Max 50MB');
						ga('send', 'event', 'transload', 'transload-failure-tooBig', data.file_url);
						break;
					case 3:
						//console.log("Transload to Dropbox successful.");
						setProgressBarPercent('.progress', 0);
						alertify.log('Transload successful');
						ga('send', 'event', 'transload', 'transload', data.file_url);
						refreshUserInfo(socket, code);
						break;
					case 4:
						//console.log("File Deleted from server.");
						alertify.log('File deleted.');
						ga('send', 'event', 'transload', 'delete', data.fileName); 

						refreshUserInfo(socket, code);

						break;
					case 5:
						alertify.error('File not deleted.');
						ga('send', 'event', 'transload', 'delete-failure', data.fileName);
						break;
					case 6:
						alertify.error('Transload not successful.');
						setProgressBarPercent('.progress', 0);
						ga('send', 'event', 'transload', 'transload-failure', data.fileName);
						break;
					case 7:
						alertify.error('Invalid URL.');
						ga('send', 'event', 'transload', 'transload-failure-bad-url', data.fileName);
						break;
					case 8:
						alertify.error('Filesize unknown.');
						ga('send', 'event', 'transload', 'transload-failure-bad-url', data.fileName);
						break;
					case 9: //Check for file on Dropbox didn't work. Refresh the page.
						location.reload();
						break;
				}

			});

			$("#logOut").click(function(){

				logOut();

			});

			$("#submitURL").click(function(){

				data = { 
					url:$("#urlInput").val(),
					code:code 
				};

				downloadFile(socket, data);
			});

			$("#sendSocket").click(function(){

				socket.emit('msg', { my: 'TESTING' }); 

			})	

			$("body").on('click', '.delete', function(){

				console.log("Deleting file...");

				data = { 
					status: 'delete', 
					file:$(this).attr('id'),
					code:code 
				};
				deleteFile(socket, data);

			});


		}
		
	});

});

/***ACTIONS***/
function setProgressBarPercent(selector, percent){
	$(selector+' .progress-bar').attr('aria-valuenow', percent); 
	$(selector+' .progress-bar').css('width', percent+'%');		
}


function deleteFile(socket, data){
	if(data.code === -1 || data.code === 0){
		console.error("DELETE FILE: Not logged in. Can't do anything.");
	}else{
		alertify.set({ labels: {
		    ok     : "Delete",
		    cancel : "Cancel"
		} });
		alertify.confirm("Are you sure you want to delete this file?", function (e) {
		    if (e) {
		        alertify.log('Deleting file...');
				socket.emit('delete', data);
		    } else {
		        alertify.log('Cancelled.');
		    }
		});

	}
}

function downloadFile(socket, data){
	if(data.code === -1 || data.code === 0){
		console.error("DOWNLOAD FILE: Not logged in. Can't do anything.");
	}else{
		alertify.log('Transloading file...');
		socket.emit('downloadFile', data);
	}
}

/***USER INFO***/
function getUserInfo(socket, code, callback){
	if(code === -1){
		console.log("Not logged in. Can't do anything.");
	}else{
		var data = {code:code}
		socket.emit('userInfo', data);
	}
	socket.on('userInfo', function(data){
		callback(data);
	})
}

function refreshUserInfo(socket, code){
	getUserInfo(socket, code, function(ret){
		$("#fileList ul").text('');
		if(ret.list.length === 0){
			$('#fileList').addClass("hideList");
		}else{
			$('#fileList').removeClass("hideList");
			$.each(ret.list, function(i){
				$("#fileList ul").append($('<li class="list-group-item" id="'+i+'"></li>').text(' '+ret.list[i]));
				$("#fileList ul li#"+i).prepend('<span class="glyphicon glyphicon-file" aria-hidden="true">');
				$("#fileList ul li#"+i).append($('<div class="options btn-group">\
					<a class="btn btn-success" href="https://www.dropbox.com/home/Apps/Transloader" target="_blank">\
						&nbsp;&nbsp;&nbsp;<span class="glyphicon glyphicon-log-in" aria-hidden="true"></span>&nbsp;&nbsp;&nbsp;\
					</a>\
					<span class="btn btn-danger delete" id="'+i+'">\
						<span class="glyphicon glyphicon-trash" aria-hidden="true"></span>\
					</span>\
				</div>'));
			});
		}
		
	});		
}

/***AUTHORIZATION***/
function logInConfirm(code, callback){
	if(code === -1){
		console.log("Log in error.");
		callback(-1)
	}else if(code === 0){
		console.log("Not logged in.");
		callback(0)
	}else{
		var data = {
			"code":code
		};

		$.ajax({
			type: "GET",
			url: "/log-in",
			data: data, 
			dataType:"text",
			success: function (result) { 
				if(result == '1')
					callback(1);
				else if(result == '-1')
					callback(-1);
				else
					callback(0);
			},
			error: function (result) {
				console.error(result);
				callback(-1);
			}
		});
	}
}

function logOut(){
	eraseCookie("code");
	window.location.assign(parent.document.location.origin);
}

/***OTHER***/
function getURLVars() {
    var vars = [], hash;
    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
    for(var i = 0; i < hashes.length; i++)
    {
        hash = hashes[i].split('=');
        vars.push(hash[0]);
        vars[hash[0]] = hash[1];
    }
    return vars;
}

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1);
        if (c.indexOf(name) != -1) return c.substring(name.length, c.length);
    }
    return "";
}

function eraseCookie(name) {
    setCookie(name,"",-1);
}

