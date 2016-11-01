
Parse.Cloud.define('hello', function(req, res) {
  res.success('Hi');
});

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

// Returns a Promise for completion
function calculateLeague(user, survey) {
	var frequency = survey["frequency"]
	var intensity = survey["intensity"]
	return new Promise((fulfill, reject) => {
		var leagueQuery = new Parse.Query("League")
		leagueQuery.ascending("Level");
		// Since we have no survey results, we will choose any league that exists
		leagueQuery.find({
			success: function(leagues) {
				var league = null
				if (intensity >= leagues.length)
					league = leagues[leagues.length - 1]
				else
					league = leagues[intensity];

				user.set("league", league);
				fulfill(user);
			},
			error: function() {
				fulfill(user);
			}
		})
	});
}

function chooseProfileImage(user) {
	return new Promise((fulfill, reject) => {
		var ProfilePic = Parse.Object.extend("ProfilePic")
		ProfilePic.count().then(function(numPics) {

			var index = getRandomInt(0, numPics)
			var pictureQuery = new Parse.Query(ProfilePic);
			pictureQuery.equalTo("Index", index);
			pictureQuery.find({
				success: function(pictures) {
					var picture = pictures[0]

					user.set("picture", picture);
					fulfill(user);
				},
				error: function() {
					// We will continue!
					fulfill(user);
				}
			});
		}, function(error) {
			reject(user);
		});
	});
}

Parse.Cloud.define('onSignUp', function(request, response) {
	// This function will take the survey results, store them in the given user, and then determine league and profile picture

	var userId = "0HQzJVjyO0";
	console.log("User id: " + userId.objectId);
	// We don't know yet what we are gonna ask, so no survey for now
	var surveyInfo = request["survey"];

	var query = new Parse.Query(Parse.User);
	query.get(userId, {
		useMasterKey: true,
	}).then((user) => {
		return chooseProfileImage(user);
	}).then((user) => {
		return calculateLeague(user, survey);
	}).then((user) => {
		user.save();
		response.success();
	}).catch((error) => {
		console.log("Somethine went wrong. Likely a problem with config: " + JSON.stringify(error));
		response.error("Somethine went wrong. Likely a problem with config: " + JSON.stringify(error));
	});
});

Parse.Cloud.define('calculateAchievements', function(request, response) {
	
});

Parse.Cloud.afterSave(Parse.User,  function(request, response) {
	var user = request.object

	var query = request.object.relation("pastWorkouts").query();
	query.find({
		success: function(results) {
			var dictionary = {}
			for (i in results) {
				var result = results[i];
				var type = result.get("activity");

				var num = dictionary[type];
				if (num == undefined)
					dictionary[type] = 1;
				else
					dictionary[type] = num += 1;
			}

			for (type in dictionary) {
				user.set(type, dictionary[type]);
			}

			response.success();
		},
		error: function(err) {
			response.error(err);
		}
	})
});

