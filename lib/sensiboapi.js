var http = require('https');

//set to true to log http response and errors to the console
var debug = false;

function _http(data, callback) {

	var that=this;
	//var waitTime = that.timeLapse;

	//console.log("Timeout setting: ",waitTime/1000,"s");
	var options = {
	  hostname: "home.sensibo.com",
	  port: 443,
	  path: "/api/v2/" + data.path,
	  //since we are listening on a custom port, we need to specify it by hand
	  // port: '1337',

	  //This is what changes the request to a POST request
	  method: data.method,
	  headers: {}
	};
	
	//console.log(options.path);
	if ( data.data ) {
		data.data = JSON.stringify(data.data);
		options.headers['Content-Length'] = Buffer.byteLength(data.data);
		options.headers['Content-Type'] = "application/json";
	}

	var str = '';
	var req = http.request(options, function(response) {

		response.on('data', function (chunk) {
	    	str += chunk;
		});

		response.on('end', function () {
		    if (debug) console.log("[Sensibo API Debug] Response in http:\n", str);
		    try {
		    	str = JSON.parse(str);
		    } catch(e) {
		    	if (debug) {
					console.log("[Sensibo API Debug] e.stack:\n", e.stack);
		    		console.log("[Sensibo API Debug] Raw message:\n", str);
				}
		    	str = undefined;
		    }

		    if (callback) callback(str);
		});
	});

	req.on('error', function(e) {
  		//console.log("[%s Sensibo API Debug] Error at req: %s - %s\n", new Date(),e.code.trim(),data.path);
  		// still need to response properly
  		str = undefined;
  		if (callback) callback(str);
	});

	// For POST (submit) state
	if ( data.data ) {
		req.write(data.data);
	}
	
	req.end();

}

function POST(data, callback) {
	data.method = "POST";
	_http(data, callback);
}

function PUT(data, callback) {
	data.method = "PUT";
	_http(data, callback);
}

function GET(data, callback) {
	data.method = "GET";
	_http(data, callback);
}

function DELETE(data, callback) {
	data.method = "DELETE";
	_http(data, callback);
}

var sensibo = {
    init: function (inKey) {
        this.apiKey = inKey;
    },

    getPods: function (log, callback) {
        GET({ path: 'users/me/pods?fields=id,room&apiKey=' + this.apiKey }, function (data) {
            if (data && data.status && data.status == 'success' && data.result && data.result instanceof Array) {
                callback(data.result);
            } else {
                callback();
            }
        })
    },

    getState: function (deviceID, callback) {
        //We get the last 10 items in case the first one failed.
        if (debug) {
            console.log("**[Sensibo API Debug] DeviceID :\n", deviceID.trim());
        }
        GET({ path: 'pods/' + deviceID + '/acStates?fields=status,reason,acState&limit=10&apiKey=' + this.apiKey }, function (data) {
            if (data && data.status && data.status == 'success' && data.result && data.result instanceof Array) {
                var i = 0;
                for (i = 0; i < data.result.length; i++) {
                    if (data.result[i].status == "Success") break;
                }
                if (i == data.result.length) i = 0;
                callback(data.result[i].acState);
            } else {
                callback();
            }
        })
    },

    getMeasurements: function (deviceID, callback) {
        GET({ path: 'pods/' + deviceID + '/measurements?fields=batteryVoltage,temperature,humidity,time&apiKey=' + this.apiKey }, function (data) {
            if (data && data.status && data.status == 'success' && data.result && data.result instanceof Array) {
                callback(data.result);
            } else {
                callback();
            }
        })
    },

    submitState: function (deviceID, state, callback) {
        var data = {};
        data.data = {
            "acState":
            {
                "on": state.on,
                "mode": state.mode,
                "fanLevel": state.fanLevel,
                "targetTemperature": state.targetTemperature
            }
        };
        data.path = 'pods/' + deviceID + '/acStates?apiKey=' + this.apiKey;
        data.apiKey = this.apiKey;
        //console.log(deviceID, " - Sending data: ",data.data);
        POST(data, callback);
    },

    getClimateReactState: function (deviceID, callback) {
        GET({ path: 'pods/' + deviceID + '/smartmode?apiKey=' + this.apiKey }, function (data) {
            if (data && data.status && data.status === 'success' && data.result) {
                callback(data.result);
            } else {
                callback();
            }
        });
    },

    submitClimateReactState: function (deviceID, state, callback) {
        var data = {};
        data.data = {
            "enabled": state
        };
        data.path = 'pods/' + deviceID + '/smartmode?apiKey=' + this.apiKey;
        data.apiKey = this.apiKey;
        PUT(data, callback);
    }
};

module.exports = sensibo;