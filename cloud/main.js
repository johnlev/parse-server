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
	res.success();
});

Parse.Cloud.define('removeUserAsWatcher', function(req, res) {
	res.success();
});
