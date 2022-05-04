import noble from '@abandonware/noble';
import KanoWand from './index.js';
import { exec } from 'child_process';
import { getHarmonyClient } from '@harmonyhub/client-ws';
import { emitKeypressEvents } from 'readline';
import { connect } from 'mqtt';
import config from './config.js'
// import pkg from '@harmonyhub/discover';
// const { Explorer, HubData } = pkg; // read this later https://simonplend.com/node-js-now-supports-named-imports-from-commonjs-modules-but-what-does-that-mean/
// import Gpio from 'onoff';

// const button = new Gpio(2, 'in', 'rising', {debounceTimeout: 10}); // no resistor this has to be input only or boom(ish)!!!

let wand = new KanoWand();
let periph;
let client = connect({
  host: '192.168.254.123',
  port: 1883,
  username: 'apartment_broker',
  password: config.PASSWORD
});

function connectWand(p) {
  console.log('attempting connect');
  p.connect((err) => {
    if (err) {
      console.error(`exec error: ${err}, if already connected wand will vibrate and not attempt reconnect`);
      wand.vibrate(1);
      client.publish('ack_reset', 'not_needed');
      return;
    }
    wand.init(p)
    .then(()=> {
        wand.vibrate(1);
        client.publish('ack_reset', 'reset');
    });
});
}

client.on('connect', function () {
  client.subscribe('wand', err => {
    if (!err) {
      client.publish('presence', 'Hello mqtt');
      console.log('subscribed to wand succesfully');
    }
  })
});

client.on('message', (topic, message) => {
  if (topic === 'wand') {
    if (message.toString() === 'reset') {
      if (periph) {
        connectWand(periph);
      } else {
        console.log('do not attempt reset, wand never connected');
      }
    }
  }
});

emitKeypressEvents(process.stdin);

process.stdin.on('keypress', (ch, key) => {
  if (key && key.ctrl && key.name === 'c') {
    console.log('sigint process caught');
    //button.unexport();
    process.exit();
  } else if (key && key.name === 'w') {
    if (wand.name) {
      console.log(`wand properties are ${Object.getOwnPropertyNames(wand)}`);
      wand.vibrate(1);
    } else {
      console.log('wand never set')
    }
  } else if (key && key.name === 'r') {
    if (periph) {
      connectWand(periph);
    } else {
      console.log('do not attempt reset, wand never connected');
    }
  }
});

// currently below starts or stops the tv once per process run, this is temporary to ensure communication is working
async function toggleTV() {
  const harmony = await getHarmonyClient('192.168.254.124'),
    isOff = await harmony.isOff();
    console.log(`connected and isOff is ${isOff}`);
    const activities = await harmony.getActivities(),
    activity = activities[0];
    console.log(`activity [0] is ${JSON.stringify(activity, null, 2)}`);
    if (isOff) {
        console.log('tv is off, attempting to turn on');
        if (activity) {
            await harmony.startActivity(activity.id);
        }
    } else {
        console.log('tv is on, turning off');
        await harmony.turnOff();
    }
    harmony.end();
}

noble.on('stateChange', async (state) => {
    if (state === 'poweredOn') {
      noble.startScanningAsync();
  }
});
  
await  noble.on('discover', function(peripheral) {
      let deviceName = peripheral.advertisement.localName || "";
      if (deviceName.startsWith("Kano-Wand")) {
        noble.stopScanningAsync();
        noble.reset();
        connectWand(peripheral);
        periph = peripheral;
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

// toggleTV().catch(
//     (err) => console.error(err)
// );

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

process.stdin.setRawMode(true);

// process.on('SIGINT', () => {
//   // ctrl-c catches sigint process everytime until i restart app with the button, after that ctrl-c doesn't exit the process
//   console.log('sigint process caught');

//   process.exit();
// });