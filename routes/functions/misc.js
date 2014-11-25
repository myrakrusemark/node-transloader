var db 			= global.db;


var fileNameSplit = function(fileName){
	var re = /(?:\.([^.]+))?$/; 

	var ret = {
		pre: fileName.split('.')[0],
		ext: re.exec(fileName)[1]	
	}

	return ret;

}

var urlSplit = function(url){
	var re = /(?:\.([^.]+))?$/;

	var fileName = url.substring(url.lastIndexOf('/')+1).split("?")[0];
	var pre = fileName.split('.')[0];
	var ext = re.exec(fileName)[1];

	var ret = {
		url: url,
		fileName: fileName, 
		pre: pre,
		ext: ext	
	}

	return ret;

}

var log = function(msg, error){
		if(error == null)
			error = 0;

		function getErrorObject(){
		    try { throw Error('') } catch(err) { return err; }
		}	
		var err = getErrorObject();
		var caller_line = err.stack.split("\n")[4];
		var index = caller_line.indexOf("at ");
		var clean = caller_line.slice(index+2, caller_line.length);

		var out = 'ERROR '+clean+": "+msg;
		error?console.error(out.black.bgRed):console.log(clean+": "+msg+'\n');
	}

module.exports = {

	checkNames: function(origFileName, entries, callback){

		var file_num = 1;
		var newFileName = '';

		var findDupes = function(fileName, entries, callback){
			for(var i=0; i <= entries.length; i++){

				if(entries.length == 0){ //no files in directory
					callback(fileName);

				}else if(entries[i] == fileName){ //duplicate filename found

					newFileName = renameDupe(entries[i], origFileName, entries);

					findDupes(newFileName, entries, function(ret){
						newFileName = ret;

						callback(newFileName); //finally callback with new filename
					});

				}else if(i == entries.length){ //if no dupes found, callback immediately

					callback(fileName);
					//break;
				}

				
				
			}	


		}

		var renameDupe = function(entry, fileName, entries, callback){
			file_num++;

			newName = fileNameSplit(fileName).pre + ' ('+ (file_num) +').'+fileNameSplit(fileName).ext;

			return newName;
		}

		findDupes(origFileName, entries, function(ret){
			callback(ret);
		});
			
	},

	fileNameSplit: fileNameSplit,

	urlSplit: urlSplit,

	validateURL: function(value) {
	    return /^(https?|ftp):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(\#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i.test(value);
	},

	addDownloadInfo: function(downloadInfo){

		log("Adding download info...");
	    var collection = db.get('downloads');

	    collection.insert(downloadInfo, function (err, doc) {
	        if (err) {
	            log("There was a problem adding the information to the database.", 1);
	        }
	        else {
	            log("Download entry added.");
	        }
	    });
	},

	log: log


};

