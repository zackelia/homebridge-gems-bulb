const utils = require('./utils');
const noble = require('@abandonware/noble');

module.exports = function(api) {
    api.registerAccessory('homebridge-gems-bulb', 'GemsBulb', GemsBulb);
};

function GemsBulb(log, config, api) {
  this.log = log
  this.config = config
  this.api = api

  this.Service = this.api.hap.Service;
  this.Characteristic = this.api.hap.Characteristic;

  this.state = true
  this.hue = 0
  this.saturation = 100
  this.brightness = 100
  this.handle = 0x25

  this.discover();

  this.informationService = new this.Service.AccessoryInformation();
  this.service = new this.Service.Lightbulb(this.config.name);

  this.informationService
    .setCharacteristic(this.Characteristic.Manufacturer, 'BEKEN')
    .setCharacteristic(this.Characteristic.Model, 'BT 4.0')
    .setCharacteristic(this.Characteristic.SerialNumber, '123-45-6789');

  // Required Characteristics
  this.service.getCharacteristic(this.Characteristic.On)
    .on('get', this.handleOnGet.bind(this));
  this.service.getCharacteristic(this.Characteristic.On)
    .on('set', this.handleOnSet.bind(this));

  // Optional Characteristics
  this.service.getCharacteristic(this.Characteristic.Brightness)
    .on('get', this.handleBrightnessGet.bind(this));
  this.service.getCharacteristic(this.Characteristic.Brightness)
    .on('set', this.handleBrightnessSet.bind(this));

  this.service.getCharacteristic(this.Characteristic.Hue)
    .on('get', this.handleHueGet.bind(this));
  this.service.getCharacteristic(this.Characteristic.Hue)
    .on('set', this.handleHueSet.bind(this));

  this.service.getCharacteristic(this.Characteristic.Saturation)
    .on('get', this.handleSaturationGet.bind(this));
  this.service.getCharacteristic(this.Characteristic.Saturation)
    .on('set', this.handleSaturationSet.bind(this));
}

/**
 * Scan for the bulb using its MAC address. If the bulb is discovered, set up
 * events for it.
 */
GemsBulb.prototype.discover = function() {
  var that = this;

  noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning();
    } else {
      noble.stopScanning();
    }
  });

  noble.on('discover', function(peripheral) {
    if (peripheral.address.toUpperCase() === that.config.mac) {
      noble.stopScanning();

      that.log("Discovered bulb")
      that.peripheral = peripheral;

      // Set up connect/disconnect events
      that.peripheral.once('connect', function() {
        that.log("Connected!")
      })

      that.peripheral.once('disconnect', function() {
        that.log("Disconnected...")
      })

      // Attempt graceful disconnect on shutdown
      that.api.on('shutdown', function() {
        that.peripheral.disconnect();
      });
    }
  });
}

/**
 * If the bulb is not connected, attempt to connect and send bytes to enable.
 * The callback should have a result parameter to indicate if connection was
 * successful.
 */
GemsBulb.prototype.reconnect = function(callback) {
  var that = this;

  // Do nothing if already connected
  if (this.peripheral && this.peripheral.state === 'connected') {
    callback(true);
  } else {
    // Bytes "mk:0000" must be sent before the light acknowledges anything
    // else after connecting
    var buffer = Buffer.from([0x6d, 0x6b, 0x3a, 0x30, 0x30, 0x30, 0x30]);

    this.peripheral.connect(function(error) {
      if (error) {
        that.log(error);
        callback(false);
        return;
      }
      that.peripheral.writeHandle(that.handle, buffer, false, function(error) {
        if (error) {
          that.log(error);
          callback(false);
          return;
        }
        callback(true);
      })
    })
  }
}

/**
 * Wrapper to convert values from HomeKit to an RGB value for the bulb to
 * understand and change the bulb color.
 */
GemsBulb.prototype.setColor = function(callback) {
  var that = this;

  var anon = function(result) {
    if (!result) {
      callback(new Error());
      return
    }

    // Bytes to change color are of format "ctl:1:r:g:b"
    var buffer = [0x63, 0x74, 0x6c, 0x3a, 0x31, 0x3a]
    var rgb = utils.hslToRgb(that.hue, that.saturation, that.brightness);

    // Each individual number in a value must be converted, e.g. for red value
    // 123, it must iterate 1, 2, and 3
    for (const color of rgb) {
      for (const char of color.toString()) {
        buffer.push(char.charCodeAt(0));
      }
      buffer.push(0x3a);
    }

    buffer = Buffer.from(buffer);
    that.peripheral.writeHandle(that.handle, buffer, false, function (error) {
      if (error) {
        that.log(error);
        callback(new Error());
        return
      }
      callback(null);
    });
  }

  this.reconnect(anon);
}

GemsBulb.prototype.getServices = function() {
  return [this.informationService, this.service];
}

/* Required Characteristic Handles */

GemsBulb.prototype.handleOnGet = function(callback) {
  callback(null, this.state);
}

GemsBulb.prototype.handleOnSet = function(on, callback) {
  var that = this;

  var anon = function(result) {
    if (!result) {
      callback(new Error());
      return
    }

    // Bytes to change on/off are "open"/"close"
    var buffer = Buffer.from([0x63, 0x6c, 0x6f, 0x73, 0x65])
    if (on) {
      buffer = Buffer.from([0x6f, 0x70, 0x65, 0x6e])
    }

    that.peripheral.writeHandle(that.handle, buffer, false, function (error) {
      if (error) {
        that.log(error);
        callback(new Error());
        return
      }
      callback(null);
      this.state = on;
    });
  };

  this.reconnect(anon);
}

/* Optional Characteristic Handles */

GemsBulb.prototype.handleBrightnessGet = function(callback) {
  callback(null, this.brightness);
}

GemsBulb.prototype.handleBrightnessSet = function(brightness, callback) {
  this.brightness = brightness
  this.setColor(callback);
}

GemsBulb.prototype.handleHueGet = function(callback) {
  callback(null, this.hue);
}

GemsBulb.prototype.handleHueSet = function(hue, callback) {
  this.hue = hue
  this.setColor(callback);
}

GemsBulb.prototype.handleSaturationGet = function(callback) {
  callback(null, this.brightness);
}

GemsBulb.prototype.handleSaturationSet = function(saturation, callback) {
  this.saturation = saturation
  this.setColor(callback);
}
