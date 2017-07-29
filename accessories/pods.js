var inherits = require("util").inherits;

var Accessory, Service, Characteristic, uuid;
const tempOffset = 1;
const stateTimeout = 30000;  //in ms to min time elapse to call for refresh
const tempTimeout = 10000;  //in ms to min time elapse before next call for refresh
const stateRefreshRate = 30000; // Interval for status update
const fanState = {auto:0, low:25, medium:50, medium_high:75, high:100};


/*
 *   Pod Accessory
 */

module.exports = function (oAccessory, oService, oCharacteristic, ouuid) {
	if (oAccessory) {
		Accessory = oAccessory;
		Service = oService;
		Characteristic = oCharacteristic;
		uuid = ouuid;

		inherits(SensiboPodAccessory, Accessory);
		SensiboPodAccessory.prototype.deviceGroup = "pods";
		SensiboPodAccessory.prototype.loadData = loadData;
		SensiboPodAccessory.prototype.getServices = getServices;
		SensiboPodAccessory.prototype.refreshAll = refreshAll;
		SensiboPodAccessory.prototype.refreshState = refreshState;
		SensiboPodAccessory.prototype.refreshTemperature = refreshTemperature;
		SensiboPodAccessory.prototype.setFanLevel = setFanLevel;
		SensiboPodAccessory.prototype.identify = identify;
		SensiboPodAccessory.prototype.autoAI = autoAI;
	
	}
	return SensiboPodAccessory;
};
module.exports.SensiboPodAccessory = SensiboPodAccessory;

function SensiboPodAccessory(platform, device) {
	
	this.deviceid = device.id;
	this.name = device.room.name;
	this.platform = platform;
	this.log = platform.log;
	this.debug = platform.debug;
	this.state = {};
	this.temp = {};
	
	var idKey = "hbdev:sensibo:pod:" + this.deviceid;
	var id = uuid.generate(idKey);
	
	Accessory.call(this, this.name, id);
	var that = this;
	
	var batteryMaxVoltage = 3000; // 3.0V (logical full capacity)
	var batteryMinVoltage = 2600; // 2.6V (estimated)

	// HomeKit does really strange things since we have to wait on the data to get populated
	// This is just intro information. It will be corrected in a couple of seconds.
	that.state.targetTemperature = 25; // float
	that.state.temperatureUnit = "C"; // "C" or "F"
	that.state.on = false; // true or false
	that.state.targetAcState = undefined; // true or false for targetState (used for AI)
	that.state.mode = "cool"; // "heat", "cool", "fan" or "off"
	that.state.fanLevel = "auto"; // "auto", "high", "medium" or "low"
	that.state.AI = device.AI || false;
	that.state.hideFan = (device.AI)?false:(device.hideFan || false); // if AI is true, hideFan will be meaningless. If AI is false and hideFan is true, will make fan 100% all the time
	that.state.hideHumidity = device.hideHumidity || false;
	that.state.fixedState = device.fixedState;
	that.state.refreshCycle = (device.refreshCycle*1000) || stateRefreshRate;
	that.temp.temperature = 16; // float
	that.temp.humidity = 0; // int
	that.temp.battery = 2600; // int in mV
	that.coolingThresholdTemperature = 26; // float
	// End of initial information
	that.log (that.name, ": AI State: ", that.state.AI, ", RefreshCycle: ", that.state.refreshCycle, ", fixedState, AI, hideFan :", that.state.fixedState, that.state.AI, that.state.hideFan);
	// that.log (device.id, ": refresh Cycle: ", that.state.refreshCycle);

	//this.loadData();
	this.loadData.bind(this);
	setInterval(this.loadData.bind(this), that.state.refreshCycle);

	// AccessoryInformation characteristic
	// Manufacturer characteristic
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.Manufacturer, "homebridge-sensibo-sky");
	
	// Model characteristic	
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.Model, "version 0.2.1");
	
	// SerialNumber characteristic
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.SerialNumber, "Pod ID: " + that.deviceid);
	
	// Thermostat Service	
	// Current Heating/Cooling Mode characteristic

	this.addService(Service.Thermostat);	

	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CurrentHeatingCoolingState)
		.on("get", function (callback) {
		
			//that.log(that.deviceid,":",(new Date()).getTime(),":GetCurrentHeatingCoolingState: ", that.state);
			if (!that.state.on) { // Convert state.on parameter to TargetHeatingCoolingState
				callback(null, Characteristic.TargetHeatingCoolingState.OFF);
				//that.log(that.deviceid,":",(new Date()).getTime(),":GetCurrentHeatingCoolingState: OFF:",Characteristic.TargetHeatingCoolingState.OFF);
			} else {
				switch (that.state.mode) {
					case "cool": // HomeKit only accepts HEAT/COOL/OFF, so we have to determine if we are Heating, Cooling or OFF.
						//that.log(that.deviceid,":",(new Date()).getTime(),":GetCurrentHeatingCoolingState: COOL:",Characteristic.CurrentHeatingCoolingState.COOL);
						callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
						break;
					case "heat":
						callback(null, Characteristic.CurrentHeatingCoolingState.HEAT);
						break;
					case "fan":
						callback(null, Characteristic.CurrentHeatingCoolingState.COOL);
						break;
					default: // anything else then we'll report the thermostat as off.
						callback(null, Characteristic.CurrentHeatingCoolingState.OFF);
						break;
				}
			}
		});

	// Target Heating/Cooling Mode characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetHeatingCoolingState)
		.on("get", function (callback) {
		
			//that.log(that.deviceid,":",(new Date()).getTime(),":GetTargetHeatingCoolingState: ", that.state);
			if (!that.state.on) { // Convert state.on parameter to TargetHeatingCoolingState
				//that.log(that.deviceid,":",(new Date()).getTime(),":GetTargetHeatingCoolingState: OFF:",Characteristic.TargetHeatingCoolingState.OFF);
				callback(null, Characteristic.TargetHeatingCoolingState.OFF);
			} else {
				switch (that.state.mode) {
					case "cool": // HomeKit only accepts HEAT/COOL/OFF, so we have to determine if we are Heating, Cooling or OFF.
						callback(null, Characteristic.TargetHeatingCoolingState.COOL);
						//that.log(that.deviceid,":",(new Date()).getTime(),":GetTargetHeatingCoolingState: COOL:",Characteristic.TargetHeatingCoolingState.COOL);
						break;
					case "heat":
						callback(null, Characteristic.TargetHeatingCoolingState.HEAT);
						break;
					case "fan":
						callback(null, Characteristic.TargetHeatingCoolingState.AUTO);
						break;
					default: // anything else then we'll report the thermostat as off.
						callback(null, Characteristic.TargetHeatingCoolingState.OFF);
						break;
				}
			}
		})
		.on("set", function (value, callback) {
			that.log(that.name, "State change set, current ACstate:", that.state.mode, " new state:", value);
			//that.log(that.name," State value -",Characteristic.TargetHeatingCoolingState.COOL,Characteristic.TargetHeatingCoolingState.OFF);
			
			switch (value) {
				case Characteristic.TargetHeatingCoolingState.OFF:
					that.state.on = false;
					break;
				case Characteristic.TargetHeatingCoolingState.COOL:
					that.state.mode = "cool";
					that.state.on = true;
					that.state.targetAcState = true;
					break;
				case Characteristic.TargetHeatingCoolingState.HEAT:
					that.state.mode = "heat";
					that.state.on = true;
					that.state.targetAcState = true;
					break;
				case Characteristic.TargetHeatingCoolingState.AUTO:
					if (that.state.targetTemperature <= that.temp.temperature) {
						that.state.mode = "cool";
					} else {
						that.state.mode = "heat";
					}
					that.state.on = true;
					that.state.targetAcState = true;
					break;
				default:
					that.state.mode = "cool";
					that.state.on = false;
					break;
			};		

			that.log(that.name," - Submit state change: New state: ", that.state.mode, "On/Off Status:", that.state.on);
			that.platform.api.submitState(that.deviceid, that.state, function(data){
				if (data !== undefined) {
					logStateChange(that)
				}
			});
			callback();
			
		});

	// Current Temperature characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CurrentTemperature)
		.on("get", function(callback) {
			//that.log(that.deviceid,":",(new Date()).getTime(),":GetCurrentTemperature: :",that.temp.temperature);
			callback(null, that.temp.temperature);
		});

	// Target Temperature characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TargetTemperature)
		.on("get", function(callback) {
			//that.log(that.deviceid,":",(new Date()).getTime(),":GetTargetTemperature: :",that.state.targetTemperature);
			callback(null, that.state.targetTemperature); 	
		})
		.on("set", function(value, callback) {
			
			// limit temperature to Sensibo standards
			if (value <= 16.0)
				value = 16.0;
			else if (value >= 30.0)
				value = 30.0;
			var newTargetTemp = Math.floor(value);

			switch (that.state.fixedState) {
				case "auto":
					that.coolingThresholdTemperature = Math.round(that.temp.temperature);

					if (value <= that.coolingThresholdTemperature) {
						that.state.mode = "cool";
					}
					else if (value > that.coolingThresholdTemperature) {
						that.state.mode = "heat";
					}
					break;
				case "manual":
					// Do nothing
					break;
				default:
					that.state.mode = that.state.fixedState;

			}

			that.state.on = true;
			that.state.targetAcState = true;

			that.log ("[DEBUG temp] ",that.name, " Cur Target temp:",that.state.targetTemperature, " new targetTemp: ", newTargetTemp );
			if (that.state.targetTemperature !== newTargetTemp) {   // only send if it had changed
				
				that.state.targetTemperature = newTargetTemp;
				that.log(that.name," Submit new target temperature: ",that.state.targetTemperature);
				that.platform.api.submitState(that.deviceid, that.state, function(data){
					if (data !== undefined) {
						logStateChange(that)
					}
				});

			}
			callback();
			
		});
		
	// Cooling Threshold Temperature Characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CoolingThresholdTemperature)
		.on("get", function(callback) {
			callback(null, that.coolingThresholdTemperature);
		})
		.on("set", function(value, callback) {
			callback();
			that.log(that.name,": Setting threshold (name: ",that.name,", threshold: ",value,")");
			that.coolingThresholdTemperature = value;
			//that.coolingThresholdTemperature = that.temp.temperature;
		});
	
	// Temperature Display Units characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.TemperatureDisplayUnits)
		.on("get", function(callback) {
			if (that.state.temperatureUnit=="F")
				callback(null, Characteristic.TemperatureDisplayUnits.FAHRENHEIT); 	
			else
				callback(null, Characteristic.TemperatureDisplayUnits.CELSIUS); 	
		});
		
	// Battery Level characteristic
	this.getService(Service.Thermostat)
		.addCharacteristic(Characteristic.BatteryLevel)
		.on("get", function(callback) {
		
			// Convert battery level in mV to percentage
			var batteryPercentage;
		
			if (that.temp.battery >= batteryMaxVoltage)
				var batteryPercentage = 100;
			else if (that.temp.battery <= batteryMinVoltage)
				var batteryPercentage = 0;
			else
				var batteryPercentage = (that.temp.battery - batteryMinVoltage) / (batteryMaxVoltage - batteryMinVoltage);
			
			callback(null, batteryPercentage);
		});
	
		
	// Fan Service
	// On Characteristic
	// that.log(device.id,"AI State:",that.state.AI, " hideFan: ",that.state.hideFan);
	if (!that.state.AI) {

		if (!that.state.hideFan) {
			that.log(device.id, "Setting fan up");

			this.addService(Service.Fan);

			this.getService(Service.Fan)
				.getCharacteristic(Characteristic.On)
				.on("get", function (callback) {
					//that.log(that.deviceid,":",(new Date()).getTime(),":GetFanstate:",that.state.on);
					callback(null, that.state.on);
				})
				.on("set", function(value, callback) {
					callback();
					that.state.on = value;
					//that.log(that.name," - setting fan state to ", value)
					that.platform.api.submitState(that.deviceid, that.state, function(data){
						if (data !== undefined) {
							logStateChange(that)
						}
					});
				});
				
			// Rotation Speed characteristic
			this.getService(Service.Fan)
				.addCharacteristic(Characteristic.RotationSpeed)
				.on("get", function(callback) {
					//that.log(that.deviceid,":",(new Date()).getTime(),":GetFanSpeed:",that.state.fanLevel);
					callback(null, fanState[that.state.fanLevel]);
					/*
					switch (that.state.fanLevel) {
						case "low":
							callback(null, 25);
							break;
						case "medium":
							callback(null, 50);
							break;
						case "medium_high":
							callback(null, 75);
							break;
						case "high":
							callback(null, 100);
							break;
						case "auto":
						default:
							callback(null, 0);
							break;
					}
					*/
				})
				.on("set", function(value, callback) {
					callback();
					that.setFanLevel(that, value);
				});
			}
		} 
	// Relative Humidity Service
	// Current Relative Humidity characteristic
	if (that.state.hideHumidity) {
		this.getService(Service.Thermostat)
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on("get", function(callback) {
				callback(null, Math.round(that.temp.humidity)); // int value
			});

	} else {
		this.addService(Service.HumiditySensor);

		this.getService(Service.HumiditySensor)
			.getCharacteristic(Characteristic.CurrentRelativeHumidity)
			.on("get", function(callback) {
				callback(null, Math.round(that.temp.humidity)); // int value
			});		
	}



}

function setFanLevel(that, value) {

	var curFanState = that.state.fanLevel;

	if (that.state.hideFan) {
		that.state.fanLevel = "high";
	} else {
		if (value == 0) {
			that.state.fanLevel = "auto";
		} else if (value <= 40) {
			that.state.fanLevel = "low";
		} else if (value <= 50) {
			that.state.fanLevel = "medium"
		} else if (value <= 75) {
			that.state.fanLevel = "medium_high";
		} else if (value <= 100) {
			that.state.fanLevel = "high";
		} 
	}

	if ((curFanState != that.state.fanLevel) && (that.state.fanLevel!== undefined)) {
		that.log("[AI DEBUG] Fan Setting:",that.deviceid,":",(new Date()),":NewFanSpeed:",that.state.fanLevel, " CurrentFanLevel:",curFanState);
		that.platform.api.submitState(that.deviceid, that.state, function(str){
			// console.log("**STATE OF THE STRING:",str);
			// Just assume it is successful
			//if (str.status == "success") {
			//if (str) that.log("Setting state:", str);
			if ((str !== undefined) && (str.status == "success")) {
				logStateChange(that);
			} else {
				that.log("Unsucessful setting:",that.name,":",(new Date()),":Reverting to previous state: ",curFanState);
			}
			//}
		});
	} else {
		// that.log ("No need to set ");			
	}


}

function autoAI (that) {

	var tempDiff =  parseFloat((that.temp.temperature - that.state.targetTemperature)/that.state.targetTemperature*100).toFixed(1);

	if (that.state.on) {
		//that.log(that.name," - Auto calibratiing to minmizie difference between current and target: ",tempDiff,"%");
		if (tempDiff >= 10.0) {
			//that.state.on = true;
			that.setFanLevel(that,100);
			//that.log(that.name," - Setting to HIGH");
		} else if (tempDiff >= 5.0) {
			//that.state.on = true;
			that.setFanLevel(that,100);
			//that.log(that.name," - Setting to MEDIUM_HIGH");
		} else if (tempDiff >= 3.0) {
			//that.state.on = true;
			that.setFanLevel(that,75);
			//that.log(that.name," - Setting to MEDIUM");
		} else if (tempDiff >= 1.0) {
			//that.state.on = true;
			that.setFanLevel(that,25);
			//that.log(that.name," - Setting to LOW");
		} else {
			//that.state.on = true;
			that.setFanLevel(that,0);
			//that.log(that.name," - Setting to AUTO");
		}
	}
}

function refreshState(callback) {
	// This prevents this from running more often
	var that=this;
	var rightnow = new Date();
	
	//that.log(that.deviceid,":refreshState - timelapse:",(that.state.updatetime) ?(rightnow.getTime() - that.state.updatetime.getTime()) : 0, " - State: ",that.state);

	if (that.state.updatetime && (rightnow.getTime()-that.state.updatetime.getTime())<stateTimeout) { 
		if (callback !== undefined) callback();
		return
	}
	if (!that.state.updatetime) that.state.updatetime = rightnow; 
	// Update the State
	that.platform.api.getState(that.deviceid, function(acState) {
		if (acState !== undefined ) {
			that.state.targetTemperature = acState.targetTemperature;
			that.state.temperatureUnit = acState.temperatureUnit;
			that.state.on = acState.on;
			
			that.state.mode = acState.mode;
			that.state.fanLevel = acState.fanLevel;
			that.state.updatetime = new Date(); // Set our last update time.
			if (that.state.targetAcState == undefined) that.state.targetAcState = acState.on;

			if (that.state.AI) that.autoAI(that);
		}
		
		callback();
	});		
}
	
function refreshTemperature(callback) {
	// This prevents this from running more often 
	var that=this;
	var rightnow = new Date();
	
	//that.log(that.deviceid,":refreshTemperature - timelapse:",(that.temp.updatetime)?(rightnow.getTime() - that.temp.updatetime.getTime()):0, " - Temp: ",that.temp);

	if (that.temp.updatetime && (rightnow.getTime()-that.temp.updatetime.getTime())<tempTimeout) { 
		if (callback !== undefined) callback();
		return
	}
	if (!that.temp.updatetime) that.state.updatetime = rightnow; 
	// Update the Temperature
	var data;
	that.platform.api.getMeasurements(that.deviceid, function(myData) {
		data = myData;
		if (data !== undefined) {
			that.temp.temperature = data[0].temperature * tempOffset;
			that.temp.humidity = data[0].humidity;
			that.temp.battery = data[0].batteryVoltage;
			that.temp.updatetime = new Date(); // Set our last update time.
		}
		if (callback) callback();
	});
}

function refreshAll(callback) {
	var that=this;
	//console.log("[%s: Refreshing all for %s]",(new Date()),that.name);
	this.refreshState(function() { that.refreshTemperature(callback); });
}
	
function loadData() {
	var that = this;
	this.refreshAll(function() { 
	// Refresh the status on home App
		for (var i = 0; i < that.services.length; i++) {
			for (var j = 0; j < that.services[i].characteristics.length; j++) {
				that.services[i].characteristics[j].getValue();
			}
		}
	});			
}

function getServices() {
	return this.services;
}

function identify() {
	this.log("Identify! (name: %s)", this.name);
}

function logStateChange(that) {
	that.log("Changed status (name: %s, roomTemp: %s, on: %s, mode: %s, targetTemp: %s, speed: %s)", that.name,
																									 that.temp.temperature,
																									 that.state.on,
																		 							 that.state.mode,
																									 that.state.targetTemperature,
																									 that.state.fanLevel);
}
