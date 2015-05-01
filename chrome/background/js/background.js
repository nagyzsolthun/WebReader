require(["SettingsHandler", "tts/TtsProvider","icon/drawer"], function(settingsHandler, tts, iconDrawer) {
	var iconCanvas = document.createElement("canvas");
	iconCanvas.width = iconCanvas.height = 18;	//this is the size of the chrome icon TODO reference
	iconDrawer.canvas = iconCanvas;
	iconDrawer.onRenderFinished = loadIconToToolbar;
	
	/** iconDrawer draws the icon on a canvas, this function shows the canvas on the toolbar */
	function loadIconToToolbar() {
		chrome.browserAction.setIcon({
			imageData: iconCanvas.getContext("2d").getImageData(0, 0, 19, 19)
		});
	}

	// ===================================== handle messages =====================================
	
	function read(c) {
		settingsHandler.getAll(function(settings) {
			if(! settings.turnedOn) {return;}
			tts.read({text:c.text,lan:c.lan,speed:settings.speed});
		});
	}
	
	/** notifies all content scripts */
	function notifyContentJs(message) {
		chrome.tabs.query({}, function(tabs) {
			for (var i=0; i<tabs.length; i++) {
				chrome.tabs.sendMessage(tabs[i].id, message);
			}
		});
	}
	
	// ========================================= handling messages =========================================
	//receiving messages from cotnent script (to read) and popup (turnon/turnoff/getstatus)
	chrome.runtime.onMessage.addListener(
		function(request, sender, sendResponse) {
			switch(request.action) {
				case("ClickAndSpeech.getSettings"):
					console.log("getSettings received");
					settingsHandler.getAll(function(settings){
						sendResponse(settings);
					});
					break;
				case("ClickAndSpeech.getTtsProperties"):
					console.log("getTtsProperties received");
					sendResponse(tts.ttsProperties);
					break;
				case("ClickAndSpeech.testTtsService"):
					console.log("testTtsService received");
					tts.test(request.tts, sendResponse);
					return true;	//very important: keeps sendResponse channel open until it is used
				case("ClickAndSpeech.getErrors"):
					console.log("getErrors received");
					sendResponse(tts.errors);
					break;
				case("ClickAndSpeech.turnOn"):
					console.log("turnOn received");
					settingsHandler.set("turnedOn",true);
					iconDrawer.drawTurnedOn();
					break;
				case("ClickAndSpeech.turnOff"):
					console.log("turnOff received");
					settingsHandler.set("turnedOn",false);
					tts.stop();	//in case it is reading, we stop it
					iconDrawer.drawTurnedOff();
					break;
				case("ClickAndSpeech.read"):
					console.log("read received");
					read({text: request.text,lan: request.lan || navigator.language});
					break;
				case("ClickAndSpeech.missed"):	//TODO get rid of this
					console.log("missed received");
					iconDrawer.drawError();
					break;
				case("ClickAndSpeech.set"):
					console.log("set " + request.setting + ": " + request.value + " received");
					settingsHandler.set(request.setting,request.value);
					switch(request.setting) {
						case("speed"): tts.speed = request.value; break;
						case("selectType"):
						case("highlightOnHover"):
						case("highlightOnArrows"):
						case("readOnClick"):
						case("readOnSpace"): notifyContentJs({action:"ClickAndSpeech.set", setting:request.setting, value:request.value});break;
					}
					break;
			}
		}
	);

	// ===================================== initial settings =====================================
	tts.onEvent = function(event) {
		notifyContentJs({action:"ClickAndSpeech.event", event:event.type});
		switch(event.type) {
			case("loading"): iconDrawer.drawLoading(); break;
			case("start"): iconDrawer.drawPlaying(); break;
			case("end"): iconDrawer.drawTurnedOn(); break;
			case("error"): iconDrawer.drawError(); break;
		}
	}
	
	settingsHandler.getAll(function(settings) {
		tts.preferredTts = settings.preferredTts;
		tts.speed = settings.speed;
		if(settings.turnedOn) iconDrawer.drawTurnedOn();
		else iconDrawer.drawTurnedOff();
	});
});