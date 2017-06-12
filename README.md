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
			"apiKey": "YOUR_SENSIBO_API_ID",
			"timeLapse": 5,
			"ai": true			
		}
	],

```

Fields: 

* "platform": Must always be "SensiboSky" (required)
* "name": Can be anything (required)
* "apiKey": Sensibo API key, must be obtained from https://home.sensibo.com/me/api (required)
* "timeLapse": Time in seconds to recycle the status from Sensibo. Too frequent will result in many timeout from sensibo server. Default is 30s (optional)
* "ai": true or false. In BETA and only works for cooling. This will set the fan speed automatically to achieve the target temperature. If there is demands, I can work on heating too. Default is turnoff (false). (optional)

# Usage Notes

* This module modified from the original Sensibo and adopted for Sensibo Sky to improve the stability due 
to the constant ERRCONNECT from Sensibo server when there is too many request. 
* The refresh is now splitted to the individual pods instead of all at one go to mininize error from the sensibo server.
* Had also resolved bugs on the fan and better error handling when Sensibo server does not respond. 
* A fan speed of 0 means "auto". Otherwise it makes a logical progression from low, medium, medium_high, high.

* Most code adopted from pdlove. Credits goes to original author pdlove 
