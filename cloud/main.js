const Account = Parse.Object.extend("Account");


Parse.Cloud.define('deleteAccount', function(req, res) {
	var params = req.params;
	var user = req.user;
	var accountId = params.account;

	getAccount(accountId).then((account) => {
		var query = account.relation("transactions").query()

		query.find().then((transactions) => {
			return Parse.Object.destroyAll(transactions);
		}).then(() => {
			user.relation("accounts").remove(account);
			return user.save(null, {useMasterKey: true});
		}).then((user) => {
			return account.destroy();
		}).then(() => {
			res.success();
		}).catch((error) => {
			console.log("Encountered error: " + error);
			res.error(error);
		});
	}).catch((error) => {
		console.log("Encountered error: " + error);
		res.error(error);
	});
});

function getAccount(accountId) {
	return (new Parse.Query(Account)).get(accountId)
}

Parse.Cloud.define('makeUserCreator', function(req, res) {
	var params = req.params;
	var user = req.user;
	var accountId = params.account;
	var userId = params.user;

	getAccount(accountId).then((account) => {
		if (user.id != account.get("creator").id) {
			res.error("You must be the creator of the account to transfer ownership");
			return
		}

		(new Parse.Query(Parse.User)).get(userId).then((newCreator) => {
			if (newCreator == null) {
				res.error("Failed to find given user");
				return
			}else if (newCreator.id == account.get("creator").id) {
				res.error("The user is already a creator");
				return
			}

			account.relation("adminUsers").remove(newCreator);
			account.relation("adminUsers").add(user);
			account.relation("watchingUsers").remove(newCreator);
			account.set("creator", newCreator);
			return account.save(null);
		}).then((account) => {
			res.success("success");
		}).catch((error) => {
			res.error(error);
		});
	}).catch((error) => {
		res.error(error);
	});;
});

Parse.Cloud.define('addUserAsAdmin', function(req, res) {
	var params = req.params;
	var user = req.user;
	var accountId = params.account;
	var addingUserId = params.user;

	getAccount(accountId).then((account) => {
		// First I will check to see if the given user can do this
		if (user.id != account.get("creator").id) {
			res.error("You must be the Creator of the account to add admins");
			return
		}else{
			// Continuing

			(new Parse.Query(Parse.User)).get(addingUserId).then((addingUser) => {
				if (addingUser == null) {
					res.error("Failed to find given user");
					return;
				}else if (addingUser.id == account.get("creator").id) {
					res.error("The creator cannot be an admin");
					return;
				}

				addingUser.relation("accounts").add(account);
				return addingUser.save(null, {useMasterKey: true});
			}).then((addingUser) => {
				account.relation("adminUsers").add(addingUser);
				account.relation("watchingUsers").remove(addingUser);
				return account.save(null);
			}).then((account) => {
				res.success();
			}).catch((error) => {
				res.error(error);
			});
		}
	}).catch((error) => {
		res.error(error);
	});
});

Parse.Cloud.define('addUserAsWatcher', function(req, res) {
	var params = req.params;
	var user = req.user;
	var accountId = params.account;
	var addingUserId = params.user;

	getAccount(accountId).then((account) => {
		// First I will check to see if the given user can do this

		var query = account.relation("adminUsers").query()
		query.find().then((admins) => {
			var authorized = account.get("creator").id == user.id
			for (i in admins) {
				var admin = admins[i];
				if (user.id == admin.id)
					authorized = true
			}

			if (!authorized) {
				res.error("You must be the Creator or an admin of the account to add watchers");
				return
			}else{
				// Now we can continue

				(new Parse.Query(Parse.User)).get(addingUserId).then((addingUser) => {
					if (addingUser == null) {
						res.error("Failed to find given user");
						return;
					}else if (addingUser.id == account.get("creator").id) {
						res.error("The creator cannot be an watcher");
						return;
					}

					addingUser.relation("accounts").add(account);
					return addingUser.save(null, {useMasterKey: true});
				}).then((addingUser) => {
					account.relation("watchingUsers").add(addingUser);
					account.relation("adminUsers").remove(addingUser);
					return account.save(null);
				}).then((account) => {
					res.success();
				}).catch((error) => {
					res.error(error);
				});
			}
		});
	}).catch((error) => {
		res.error(error);
	});
});

Parse.Cloud.define('removeUserAsAdmin', function(req, res) {
	res.error("Removing users is not yet supported");
});

Parse.Cloud.define('removeUserAsWatcher', function(req, res) {
	res.error("Removing users is not yet supported");
});

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

// Returns a Promise for completion
function calculateLeague(user, survey) {
	var frequency = survey.frequency
	var intensity = survey.intensity

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
		query.count().then(function(numPics) {

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
			reject(error);
		});
	});
}

Parse.Cloud.define('onSignUp', function(request, response) {
	// This function will take the survey results, store them in the given user, and then determine league and profile picture

	var userId = request.params["userId"];
	// We don't know yet what we are gonna ask, so no survey for now
	var survey = request.params["survey"];

	if (userId == undefined || survey == undefined) {
		response.error("Either userId or survey was undefined!");
	}

	var query = new Parse.Query(Parse.User);
	query.get(userId, {
		useMasterKey: true,
	}).then((user) => {
		return chooseProfileImage(user);
	}).then((user) => {
		return calculateLeague(user, survey);
	}).then((user) => {
		console.log("Completed Setup!");
		user.set("completedSetup", true);
		user.save(null, { sessionToken: request.user.getSessionToken() });
		response.success();
	}).catch((error) => {
		console.log("Somethine went wrong. Likely a problem with config: " + JSON.stringify(error));
		response.error("Somethine went wrong. Likely a problem with config: " + JSON.stringify(error));
	});
});

Parse.Cloud.define('calculateAchievements', function(request, response) {
	
});

Parse.Cloud.beforeSave(Parse.User, function(request, response) {
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

			response.success();
		},
		error: function(err) {
			response.error(err);
		}
	})
});

