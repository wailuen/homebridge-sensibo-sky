# homebridge-sensibo-sky
[Homebridge](https://github.com/nfarina/homebridge) platform plugin for the Sensibo Sky

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install this plugin using: npm install -g homebridge-sensibo-sky
3. Update your configuration file. See sample config.json snippet below. 

# Configuration

Configuration sample:

 ```
"platforms": [
		{
			"platform": "SensiboSky",
			"name": "Sensibo",
			"apiKey": "YOUR_SENSIBO_API_ID"			
		}
	],

```

Fields: 

* "platform": Must always be "SensiboSky" (required)
* "name": Can be anything (required)
* "apiKey": Sensibo API key, must be obtained from https://home.sensibo.com/me/api (required)

# Usage Notes

* This module modified from the original Sensibo and adopted for Sensibo Sky to improve the stability due 
* to the constant ERRCONNECT from Sensibo server when there is too many request. The original refresh is 
* now splitted to the individual pods instead of all at one go to mininize error from the sensibo server.
* Had also resolved bugs on the fan and better error handling when Sensibo server does not respond. 
* A fan speed of 0 means "auto". Otherwise it makes a logical progression from low to high.
