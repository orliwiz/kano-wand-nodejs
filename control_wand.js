var noble = require('@abandonware/noble');
const KanoWand = require('./index');
const { exec } = require('child_process');
const Gpio = require('onoff').Gpio;
const button = new Gpio(2, 'in', 'rising', {debounceTimeout: 10}); // no resistor this has to be input only or boom(ish)!!!

var wand = new KanoWand();

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanning(); // deprecated?
    } else {
      noble.stopScanning();
    }
  });
  
  noble.on('discover', function(peripheral) {
      let deviceName = peripheral.advertisement.localName || "";
      if (deviceName.startsWith("Kano-Wand")) {
        noble.stopScanning();
        console.log("foundWand");
        
        peripheral.connect(function(error) {
            wand.init(peripheral)
            .then(()=> {
                wand.vibrate(1);
            });
        });
      }

  });

wand.spells.subscribe((spell) => {
    console.log(spell);
    //if spell is lumos, toggle power to all usbs for now
    if (spell.spell === 'Lumos') {
      exec('uhubctl -l 1-1 -a toggle', (err, stdout, sterr) => {
        if (err) {
          console.error(`exec error: ${err}`);
          return;
        }
        console.log(`stdout is -> ${stdout}`);
      });
    }
});

//if button is pressed, wait and restart process
button.watch((err, value) => {
  if (err) {
    throw err;
  }
  console.log(`button was pressed! value is ${value}, current process id is ${process.pid}`);
  setTimeout(function () {
    process.on("exit", function () {
        require("child_process").spawn(process.argv.shift(), process.argv, {
            cwd: process.cwd(),
            detached : true,
            stdio: "inherit"
        });
    });
    button.unexport();
    process.exit();
}, 5000);
});

process.on('SIGINT', () => {
  // ctrl-c catches sigint process everytime until i restart app with the button, after that ctrl-c doesn't exit the process
  console.log('sigint process caught');
  button.unexport();
  process.exit();
});