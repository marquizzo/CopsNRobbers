pc.script.create('control', function (app) {
	// Creates a new Control instance
	var Control = function (entity) {
		this.entity		= entity;
		this.receiver	= null;			// Receiver script
		this.receiverE	= null;			// Receiver entity
		this.socket		= null;			// Socket connection
		this.sStatus	= "pre-init";	// Socket status
		this.id			= null;			// Unique id
		this.players	= {};			// All other players

		this.vectorX	= 0;
		this.vectorZ	= 0;
		this.yAngle		= 0;
		this.autoX		= 0;
		this.autoZ		= 0;
		this.autoTimer	= 0;
		this.autoTimerMax = getRandNo(1, 3);
		this.motionVec	= new pc.Vec3(0, 0, 0);
	};

	Control.prototype = {
		// Called once before 1st update
		initialize: function () {
			this.sStatus = "initializing";
			this.socket = io("http://localhost:8080");
			this.socket.on("connect_error", this.sError.bind(this));
			this.socket.on("disconnect", this.sDisc.bind(this));
			this.socket.on("pCn", this.sConnected.bind(this));	// Connected
			this.socket.on("pNw", this.sPlayNew.bind(this));	// Players new
			this.socket.on("pDs", this.sPlayDsc.bind(this));	// Players disconnected
			this.socket.on("pUp", this.sPlayUpd.bind(this));	// Players update
			this.changeDirection();
			// this.receiver	= app.root.findByName("UFO").script.ufo;
		},
		
		// Called every frame
		update: function (dt) {
			TWEEN.update();
			if(this.sStatus !== "connected"){return false;}
			if(this.receiver == null){return false;}
			this.vectorX = 0;
			this.vectorZ = 0;
			
			// WASD Controls
			if(app.keyboard.isPressed(pc.KEY_A)){
				this.vectorX --;
			}
			if(app.keyboard.isPressed(pc.KEY_D)){
				this.vectorX ++;
			}
			if(app.keyboard.isPressed(pc.KEY_W)){
				this.vectorZ --;
			}
			if(app.keyboard.isPressed(pc.KEY_S)){
				this.vectorZ ++;
			}
			if(this.vectorX !== 0 || this.vectorZ !== 0){
				this.buttonMove(dt);
			}else{
				this.autoTimer += dt;
				if(this.autoTimer > this.autoTimerMax){
					this.changeDirection();
				}
				// Auto controls
				if(this.autoX === 1){
					this.vectorX --;
				}
				if(this.autoX === 2){
					this.vectorX ++;
				}
				if(this.autoZ === 1){
					this.vectorZ --;
				}
				if(this.autoZ === 2){
					this.vectorZ ++;
				}
				if(this.vectorX !== 0 || this.vectorZ !== 0){
					this.buttonMove(dt);
				}else{
					this.noButtonMove(dt);
				}
			}

			// A Button
			if(app.keyboard.wasPressed(pc.KEY_O)){
				this.receiver.btnA();
			}

			// B Button
			if(app.keyboard.wasPressed(pc.KEY_P)){
				this.receiver.btnB();
			}

			// Reset
			if(app.keyboard.wasPressed(pc.KEY_R)){
				this.receiver.reset();
			}
		},

		buttonMove: function (dt){
			// Calculate y Angle from x & z vectors
			this.yAngle = Math.atan2(this.vectorX, this.vectorZ) * (180 / Math.PI);
			this.receiver.moveToAngle(this.yAngle, dt);
		},

		noButtonMove: function (dt){
			this.receiver.decelerate(dt);
		},

		changeDirection: function(){
			do{
				this.autoX = getRandInt(0, 3);
				this.autoZ = getRandInt(0, 3);
			}while(this.autoX === 0 && this.autoZ === 0);

			this.autoTimerMax = getRandNo(0, 2);
			this.autoTimer = 0;
		},

		//////////////////////////////////// SOCKET EVENT EMITTERS ////////////////////////////////////
		// Player moved event
		receiverMoved: function(){
			this.socket.emit("pMv", {
				x: this.receiverE.getPosition().x, 
				y: this.receiverE.getPosition().y, 
				z: this.receiverE.getPosition().z,
				a: this.receiverE.getEulerAngles().y
			});
		},

		//////////////////////////////////// SOCKET EVENT LISTENERS ////////////////////////////////////
		// Connected socket
		sConnected: function(newUser, allUsers){
			this.id = newUser.id;
			this.type = newUser.t;
			this.sStatus = "connected";
			
			// Create Ufo receiver
			if(this.type === 0){
				this.receiverE = app.root.findByName("Ufo").clone();
				app.systems.script.addComponent(this.receiverE,{
					scripts: [{url: "ufo.js"}]
				});
				this.receiver = this.receiverE.script.ufo;
			}	
			// Create Bot receiver
			else{
				this.receiverE = app.root.findByName("Bot").clone();
				app.systems.script.addComponent(this.receiverE,{
					scripts: [{url: "bot.js"}]
				});
				this.receiver = this.receiverE.script.bot;
			}
			
			this.receiverE.setPosition(newUser.x, newUser.y, newUser.z);
			this.receiverE.enabled = true;
			this.receiver.connect(this);
			app.root.addChild(this.receiverE);

			// Populate existing users
			for(user in allUsers){
				if(this.id === allUsers[user].id){
					continue;
				}else{
					this.sPlayNew(allUsers[user].id);
				}
			}

			// Position existing users
			this.sPlayUpd(allUsers);
		},

		// Connection error
		sError: function(object){
			console.log("Connection error");
			this.sStatus = "disconnected";
			this.id = null;
		},

		// Disconnected
		sDisc: function(){
			console.log("Disconnected");
			this.receiverE.destroy();
			this.receiver = null;
			this.receiverE = null;
			this.sStatus = "disconnected";
			this.id = null;

			// Delete all users
			for(user in allUsers){
				if(this.id === allUsers[user].id){
					continue;
				}else{
					this.sPlayDsc(allUsers[user]);
				}
			}
		},

		// New player entered the arena
		sPlayNew: function(user){
			console.log("New player created: " + user.id + " : " + user.t);
			if(user.t === 0){	// Ufo
				this.players[user.id] = app.root.findByName("Ufo").clone();
			}else{	// Bot
				this.players[user.id] = app.root.findByName("Bot").clone();
			}
			this.players[user.id].setPosition(user.x, user.y, user.z);
			this.players[user.id].enabled = true;
			app.root.addChild(this.players[user.id]);
		},

		// Player disconnected
		sPlayDsc: function(id){
			console.log("Player disconnected: " + id);
			this.players[id].destroy();
			delete this.players[id];
		},

		// Player update
		sPlayUpd: function(allUsers){
			for(user in allUsers){
				if(this.id === allUsers[user].id){continue;}

				if(this.players[allUsers[user].id]){
					this.players[allUsers[user].id].setPosition(
						allUsers[user].x,
						allUsers[user].y,
						allUsers[user].z
					);
					this.players[allUsers[user].id].setEulerAngles(0, allUsers[user].a, 0);
				}
			}
		}
	};

	return Control;
});