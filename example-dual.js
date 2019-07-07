var noble = require('noble');
const KanoWand = require('./index')

var wand1 = new KanoWand();
var wand2 = new KanoWand();

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning();
    } else {
      noble.stopScanning();
    }
  });
  
  noble.on('discover', function(peripheral) {
    let deviceName = peripheral.advertisement.localName || "";
    if (deviceName.startsWith("Kano-Wand") && !wand1.name) {
      console.log("Found wand1 with name", deviceName);
      
      peripheral.connect(function(error) {
          wand1.init(peripheral,  "Wand_1 (" + deviceName + ")")
          .then(()=> {
              wand1.vibrate(1);
              wand1.spells.subscribe((spell) => {
                console.log(wand1.name, spell);
            });
          });
      });
    }
    else if (deviceName.startsWith("Kano-Wand") && !wand2.name) {
      noble.stopScanning();
      console.log("Found wand2 with name", deviceName);
      
      peripheral.connect(function(error) {
          wand2.init(peripheral, "Wand_2 (" + deviceName + ")")
          .then(()=> {
              wand2.vibrate(1);
              wand2.spells.subscribe((spell) => {
                console.log(wand2.name, spell);
            });
          });
      });
    }
});

process.stdin.on('keypress', (str, key) => {
    if (key.ctrl && key.name === 'c') {
      process.exit();
    } else {
      wand1.reset_position();
      wand2.reset_position();
    }
  });