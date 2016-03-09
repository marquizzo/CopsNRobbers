var http = require("http").Server();
var io = require("socket.io")(http);

var Player = require("./modules/player");
// var Vec2 = require("./modules/vec2");

var sID			= -1;	// Short id counter
var users		= {};	// All user data
var gadget = {id: -1, x: -26, y: 1.5, z:0};
var game = {points1: 0, points2: 0, teamCop: 0, paused: false};

io.on("connection", function(socket){
	// New player
	sID ++;
	var userID = sID;
	users[userID] = new Player(userID, countTypes());
	console.log("Connected to " + users[userID].id);
	socket.emit("pCn", users[userID], users, gadget);

	// Disconnected player
	socket.on("disconnect", function(){
		console.log("Disconnected " + userID);
		// If holding, drop gadget
		if(userID === gadget.id){
			changeGadgetHolder(-1);
		}
		delete users[userID];
	});

	// Player Moved
	socket.on("pMv", function(posData){
		parseMovedData(userID, posData);
	});
});

// Broadcasts game status 
function statusBroadcast(){
	io.emit("pUp", users);
}

function parseMovedData(userID, posData){
	if(game.paused === true){return false;}
	// Move positions
	users[userID].x = posData.x;
	users[userID].y = posData.y;
	users[userID].z = posData.z;
	users[userID].a = posData.a;

	// UFO Beam
	if(posData.v !== -1 && users[userID].t === 0 && users[userID].v === -1){
		// Fired on target
		if(posData.v >= 0){
			// Corroborate with proximity algorithm
			users[userID].v = posData.v;
			setTimeout(cooldown, 2000, userID);

			users[posData.v].v = posData.v;
			setTimeout(cooldown, 1000, posData.v);
			// If victim is carrying
			if(gadget.id === posData.v){
				changeGadgetHolder(-1);
			}
		}else if(posData.v === -2){
			users[userID].v = -2;
			setTimeout(cooldown, 2000, userID);
		}
	}

	// Pickup
	if(gadget.id === -1 && posData.h === userID && users[userID].v !== userID){
		// Corroborate with proximity algorithm
		console.log("Pickup?");
		changeGadgetHolder(posData.h);
	}

	// Drop
	if(gadget.id === userID && posData.h === -1){
		console.log("Drop?");
		changeGadgetHolder(posData.h);
	}

	// Gadget pos update
	if(userID === posData.h && userID === gadget.id){
		gadget.x = posData.x;
		gadget.y = posData.y;
		gadget.z = posData.z;
		if(gadget.x > 25.5 && gadget.x < 27.5 && gadget.z > -1 && gadget.z < 1){
			gameWin();
		}
	}
}

function gameWin(){
	game.paused = true;
	setTimeout(function(){game.paused = false}, 3000);
	for(user in users){
		users[user].t = (users[user].t - 1) * -1;
		users[user].v = -1;
		users[user].h = -1;
	}
	gadget = {x: -26, y: 1.5, z:0};
	changeGadgetHolder(-1);
}

function cooldown(userID){
	if(typeof users[userID].v === "undefined") return false;
	users[userID].v = -1;
}

// Drops gadget
function changeGadgetHolder(holderID){
	gadget.id = holderID;

	console.log("New gadget id " + gadget.id);
	for(user in users){
		users[user].h = holderID;
	}
}

// Counts how many ufos and bots exist
function countTypes(){
	var iUfo = 0;
	var iBot = 0;
	for(user in users){
		if(users[user].t === 0){
			iUfo ++;
		}else if(users[user].t === 1){
			iBot ++;
		}
	}

	if(iUfo >= iBot){
		return 1;
	}else{
		return 0;
	}
}

setInterval(statusBroadcast, 20);

http.listen(8080, function(){
	console.log("listening on *:8080");
});