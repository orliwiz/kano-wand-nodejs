import noble from '@abandonware/noble';
import KanoWand from './index.js';
import { exec } from 'child_process';
import { getHarmonyClient } from '@harmonyhub/client-ws';
// import pkg from '@harmonyhub/discover';
// const { Explorer, HubData } = pkg; // read this later https://simonplend.com/node-js-now-supports-named-imports-from-commonjs-modules-but-what-does-that-mean/
// import Gpio from 'onoff';

// const button = new Gpio(2, 'in', 'rising', {debounceTimeout: 10}); // no resistor this has to be input only or boom(ish)!!!

var wand = new KanoWand();

async function run() {
  const harmony = await getHarmonyClient('192.168.254.124'),
    isOff = await harmony.isOff();
    console.log(`connected and isOff is ${isOff}`);
    if (isOff) {
        console.log('tv is off');
    }
    const activities = await harmony.getActivities();
    console.log(`activity [0] is ${JSON.stringify(activities[0], null, 2)}`);
    harmony.end();
}

await noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
      noble.startScanningAsync();
    } else {
      noble.stopScanningAsync();
    }
  });
  
await  noble.on('discover', function(peripheral) {
      let deviceName = peripheral.advertisement.localName || "";
      if (deviceName.startsWith("Kano-Wand")) {
        noble.stopScanningAsync();
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

run().catch(
    (err) => console.error(err)
);

//if button is pressed, wait and restart process
// button.watch((err, value) => {
//   if (err) {
//     throw err;
//   }
//   console.log(`button was pressed! value is ${value}, current process id is ${process.pid}`);
//   setTimeout(function () {
//     process.on("exit", function () {
//         require("child_process").spawn(process.argv.shift(), process.argv, {
//             cwd: process.cwd(),
//             detached : true,
//             stdio: "inherit"
//         });
//     });
//     button.unexport();
//     process.exit();
// }, 5000);
// });

process.on('SIGINT', () => {
  // ctrl-c catches sigint process everytime until i restart app with the button, after that ctrl-c doesn't exit the process
  console.log('sigint process caught');
  //button.unexport();
  process.exit();
});