var Service;
var Characteristic;
var HomebridgeAPI;
var convert = require("./convert");
var noble = require('@abandonware/noble');

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerAccessory("homebridge-gems-bulb", "GemsBulb", GemsBulb);
};

function GemsBulb(log, config) {
  this.log = log
  this.config = config

  this.handle = 37

  this.state = true
  this.hue = 0
  this.saturation = 100
  this.brightness = 100

  this.findBulb(this.config.mac);

  this.informationService = new Service.AccessoryInformation();

  this.informationService
      .setCharacteristic(Characteristic.Manufacturer, "BEKEN")
      .setCharacteristic(Characteristic.Model, "GEMS Smart LED Light Bulb")
      .setCharacteristic(Characteristic.SerialNumber, "123-45-6789");

  this.service = new Service.Lightbulb(this.config.name);

  this.service.getCharacteristic(Characteristic.On)
      .on('get', this.getState.bind(this));
  this.service.getCharacteristic(Characteristic.On)
      .on('set', this.setState.bind(this));

  this.service.getCharacteristic(Characteristic.Hue)
      .on('get', this.getHue.bind(this));
  this.service.getCharacteristic(Characteristic.Hue)
      .on('set', this.setHue.bind(this));

  this.service.getCharacteristic(Characteristic.Saturation)
      .on('get', this.getSaturation.bind(this));
  this.service.getCharacteristic(Characteristic.Saturation)
      .on('set', this.setSaturation.bind(this));

  this.service.getCharacteristic(Characteristic.Brightness)
      .on('get', this.getBrightness.bind(this));
  this.service.getCharacteristic(Characteristic.Brightness)
      .on('set', this.setBrightness.bind(this));
}

GemsBulb.prototype.findBulb = function(mac, callback) {
  var that = this;
  noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
  });
  noble.on('discover', function(peripheral) {
    mac = mac.toLowerCase()
    if (peripheral.id === mac || peripheral.address === mac) {
        that.log("found my bulb");
        that.peripheral = peripheral;
    }
  });
}

GemsBulb.prototype.attemptConnect = function(callback){
  var buffer = Buffer.from([0x6d, 0x6b, 0x3a, 0x30, 0x30, 0x30, 0x30])

  if (this.peripheral && this.peripheral.state == "connected") {
    this.peripheral.writeHandle(this.handle, buffer, true, function (error) {
      callback(true);
    });
  } else if (this.peripheral && this.peripheral.state == "disconnected") {
      this.log("lost connection to bulb. attempting reconnect ...");
      var that = this;
      this.peripheral.connect(function(error) {
          if (!error) {
              that.log("reconnect was successful");
              that.peripheral.writeHandle(that.handle, buffer, true, function (error) {
                callback(true);
              });
           } else {
              that.log("reconnect was unsuccessful");
              callback(false);
          }
      });
  }
}

GemsBulb.prototype.updateColor = function(callback) {
  var that = this;
  var temp = function(res) {
    if (!that.peripheral || !res) {
      callback(new Error());
      return;
    }
    var buffer = [0x63, 0x74, 0x6c, 0x3a, 0x31, 0x3a]
    var rgb = convert.hslToRgb(that.hue, that.saturation, that.brightness);

    for (const color of rgb) {
      for (const char of color.toString()) {
        buffer.push(char.charCodeAt(0));
      }
      buffer.push(0x3a);
    }

    buffer = Buffer.from(buffer);
    that.peripheral.writeHandle(that.handle, buffer, true, function (error) {
      if (error) that.log('BLE: Write handle Error: ' + error);
      callback();
    });
  }
  this.attemptConnect(temp);
}

GemsBulb.prototype.setState = function(status, callback) {
  var that = this;
  var temp = function(res) {
      if (!that.peripheral || !res) {
          callback(new Error());
          return;
      }
      var buffer = Buffer.from([0x63, 0x6c, 0x6f, 0x73, 0x65])
      if (status) {
        buffer = Buffer.from([0x6f, 0x70, 0x65, 0x6e])
      }

      that.peripheral.writeHandle(that.handle, buffer, true, function (error) {
          if (error) that.log('BLE: Write handle Error: ' + error);
          callback();
      });
  };
  this.attemptConnect(temp);
  this.state = status;
};

GemsBulb.prototype.getState = function(callback) {
  callback(null, this.state);
};

GemsBulb.prototype.setHue = function(hue, callback) {
  this.hue = hue
  this.updateColor(function () {
    callback();
  });
}

GemsBulb.prototype.getHue = function(callback) {
  callback(null, this.hue);
}

GemsBulb.prototype.setSaturation = function(saturation, callback) {
  this.saturation = saturation
  this.updateColor(function () {
    callback();
  });
}

GemsBulb.prototype.getSaturation = function(callback) {
  callback(null, this.brightness);
}

GemsBulb.prototype.setBrightness = function(brightness, callback) {
  this.brightness = brightness
  this.updateColor(function () {
    callback();
  });
}

GemsBulb.prototype.getBrightness = function(callback) {
  callback(null, this.brightness);
}

GemsBulb.prototype.getServices = function() {
  return [this.informationService, this.service];
};
