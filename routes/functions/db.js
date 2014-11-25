var db 			= global.db;
var tools		= require('./misc');

var addUser = function(userInfo){

    // Set our collection
    var collection = db.get('users');

    // Submit to the DB
    collection.insert(userInfo, function (err, doc) {
        if (err) {
            // If it failed, return error
            tools.log("There was a problem adding the user to the database.", 1);
        }
        else {

            tools.log("User added.");
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
            tools.log("There was a problem updating the user information.", 1);
        }
        else {

            tools.log("User updated.");
        }
    });

}

module.exports = {

	addUpdateUser: function(userInfo){

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
};

