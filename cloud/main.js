
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
	console.log("lets see...");
	var frequency = survey.frequency
	var intensity = survey.intensity
	console.log("Calculating League with values... freq:" + frequency + ", int:" + intensity);

	return new Promise((fulfill, reject) => {
		var leagueQuery = new Parse.Query("League")
		leagueQuery.ascending("Level");
		// Since we have no survey results, we will choose any league that exists
		console.log("===> Finding leagues...");
		leagueQuery.find({
			success: function(leagues) {
				console.log("===> Choosing...");
				var league = null
				if (intensity >= leagues.length)
					league = leagues[leagues.length - 1]
				else
					league = leagues[intensity];

				console.log("===> Setting...");
				user.set("league", league);
				console.log("===> Done");
				fulfill(user);
			},
			error: function(error) {
				reject(error);
			}
		})
	});
}

function chooseProfileImage(user) {
	return new Promise((fulfill, reject) => {
		var ProfilePic = Parse.Object.extend("ProfilePic");
		var query = new Parse.Query(ProfilePic);
		console.log("===> Counting...");
		query.count().then(function(numPics) {
			console.log("===> Choosing...");

			var index = getRandomInt(0, numPics)
			var pictureQuery = new Parse.Query(ProfilePic);
			pictureQuery.equalTo("Index", index);
			pictureQuery.find({
				success: function(pictures) {

					console.log("===> Setting...");
					var picture = pictures[0]

					user.set("picture", picture);

					console.log("===> Done");
					fulfill(user);
				},
				error: function() {
					// We will continue!
					fulfill(user);
				}
			});
		}, function(error) {
			reject(error);
		});
	});
}

Parse.Cloud.define('onSignUp', function(request, response) {
	// This function will take the survey results, store them in the given user, and then determine league and profile picture

	var userId = request.params["userId"];
	console.log("User id: " + userId);
	// We don't know yet what we are gonna ask, so no survey for now
	var survey = request.params["survey"];
	console.log("survey: " + survey);

	if (userId == undefined || survey == undefined) {
		response.error("Either userId or survey was undefined!");
	}

	var query = new Parse.Query(Parse.User);
	query.get(userId, {
		useMasterKey: true,
	}).then((user) => {
		console.log("Got a user! + " + JSON.stringify(user));
		return chooseProfileImage(user);
	}).then((user) => {
		console.log("Chose a profile picture!");
		console.log("Resulting user:" + JSON.stringify(user));

		console.log("Calculating League with values... freq:" + survey["frequency"] + ", int:" + survey["intensity"]);
		return calculateLeague(user, survey);
	}).then((user) => {
		console.log("Done!");
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

			user.set("numWorkouts", results.length);
			user.save();

			response.success();
		},
		error: function(err) {
			response.error(err);
		}
	})
});

