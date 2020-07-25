# homebridge-gems-bulb
A Homebridge plugin to control [GEMS Smart LED Light Bulbs](https://www.target.com/p/gems-smart-led-light-bulb/-/A-77470708).

## Installation

homebridge-gems-bulb can be installed through `npm`.

```
$ sudo npm install homebridge-gems-bulb --unsafe-perm
```

## Configuration

You will first need to find the MAC address of your bulb. Each light will have a unique MAC address and likely a unique name.

```
$ sudo hcitool lescan
...
AA:BB:CC:DD:EE:FF M_lightXYZ
...
```

Add a new accessory to your `config.json` using the MAC address you located.

```
{
	"accessory" : "GemsBulb",
	"name" : "Bulb 1",
	"mac" : "AA:BB:CC:DD:EE:FF"
}
```

Restart Homebridge for the new bulb to appear in the Home app..

```
$ sudo systemctl restart homebridge.service
```

