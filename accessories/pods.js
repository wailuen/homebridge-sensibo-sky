var inherits = require("util").inherits;

var Accessory, Service, Characteristic, uuid;
const tempOffset = 0.95;
const stateTimeout = 20000;  //in ms to min time elapse to call for refresh
const tempTimeout = 60000;  //in ms to min time elapse before next call for refresh
const stateRefreshRate = 12000; // Interval for status update


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
		SensiboPodAccessory.prototype.identify = identify;
	
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
	that.state.mode = "cool"; // "heat", "cool", "fan" or "off"
	that.state.fanLevel = "auto"; // "auto", "high", "medium" or "low"
	that.temp.temperature = 16; // float
	that.temp.humidity = 0; // int
	that.temp.battery = 2600; // int in mV
	that.coolingThresholdTemperature = 32; // float
	// End of initial information

	//this.loadData();
	setInterval(this.loadData.bind(this),stateRefreshRate);

	this.addService(Service.Thermostat);
	this.addService(Service.Fan);
	this.addService(Service.HumiditySensor);
	
	// AccessoryInformation characteristic
	// Manufacturer characteristic
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.Manufacturer, "homebridge-sensibo");
	
	// Model characteristic	
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.Model, "version 0.2.0");
	
	// SerialNumber characteristic
	this.getService(Service.AccessoryInformation)
		.setCharacteristic(Characteristic.SerialNumber, "Pod ID: " + that.deviceid);
	
	// Thermostat Service	
	// Current Heating/Cooling Mode characteristic
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
			callback();
			switch (value) {
				case Characteristic.TargetHeatingCoolingState.COOL:
					that.state.mode = "cool";
					that.state.on = true;
					break;
				case Characteristic.TargetHeatingCoolingState.HEAT:
					that.state.mode = "heat";
					that.state.on = true;
					break;
				case Characteristic.TargetHeatingCoolingState.AUTO:
					that.state.mode = "fan";
					that.state.on = true;
					break;
				default:
					that.state.mode = "cool";
					that.state.on = false;
					break;
			};
			that.platform.api.submitState(that.deviceid, that.state, function(data){
				if (data !== undefined) {
					logStateChange(that)
				}
			});
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
			callback();
			
			// limit temperature to Sensibo standards
			if (value <= 16.0)
				value = 16.0;
			else if (value >= 30.0)
				value = 30.0;
			
			// turn on or off and set the mode based on temperature choice and current temperature
			// this should be modified, but for now, for Siri to work, this should be done
			if (value <= that.coolingThresholdTemperature) {
				that.state.mode = "cool";
			}
			else if (value > that.coolingThresholdTemperature) {
				that.state.mode = "heat";
			}
			
			that.state.on = true;
			that.state.targetTemperature = Math.floor(value);
			
			that.platform.api.submitState(that.deviceid, that.state, function(data){
				if (data !== undefined) {
					logStateChange(that)
				}
			});
		});
		
	// Cooling Threshold Temperature Characteristic
	this.getService(Service.Thermostat)
		.getCharacteristic(Characteristic.CoolingThresholdTemperature)
		.on("get", function(callback) {
			callback(null, that.coolingThresholdTemperature);
		})
		.on("set", function(value, callback) {
			callback();
			//that.log("Setting threshold (name: %s, threshold: %s)", that.name, value);
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
	this.getService(Service.Fan)
		.getCharacteristic(Characteristic.On)
		.on("get", function (callback) {
			//that.log(that.deviceid,":",(new Date()).getTime(),":GetFanstate:",that.state.on);
			callback(null, that.state.on);
		})
		.on("set", function(value, callback) {
			callback();
			that.state.on = value;
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
			switch (that.state.fanLevel) {
				case "low":
					callback(null, 25);
					break;
				case "medium":
					callback(null, 50);
					break;
				case "high":
					callback(null, 100);
					break;
				case "auto":
				default:
					callback(null, 0);
					break;
			}
		})
		.on("set", function(value, callback) {
			callback();
			if (value == 0)
				that.state.fanLevel = "auto";
			else if (value <= 40)
				that.state.fanLevel = "low";
			else if (value <= 75)
				that.state.fanLevel = "medium";
			else if (value <= 100)
				that.state.fanLevel = "high";
			that.platform.api.submitState(that.deviceid, that.state, function(str){
				// console.log("**STATE OF THE STRING:",str);
				// Just assume it is successful
				//if (str.status == "success") {
				if (str !== undefined) {
					logStateChange(that);
				}
				//}
			});
		});
	
	// Relative Humidity Service
	// Current Relative Humidity characteristic
	this.getService(Service.HumiditySensor)
		.getCharacteristic(Characteristic.CurrentRelativeHumidity)
		.on("get", function(callback) {
			callback(null, Math.round(that.temp.humidity)); // int value
		});
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
