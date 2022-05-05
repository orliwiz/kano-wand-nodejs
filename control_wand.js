import noble from '@abandonware/noble';
import KanoWand from './index.js';
import { exec } from 'child_process';
import { getHarmonyClient } from '@harmonyhub/client-ws';
import { emitKeypressEvents } from 'readline';
import { connect } from 'mqtt';
import config from './config.js'
// import pkg from '@harmonyhub/discover';
// const { Explorer, HubData } = pkg; // read this later https://simonplend.com/node-js-now-supports-named-imports-from-commonjs-modules-but-what-does-that-mean/

let wand = new KanoWand();
let periph;
let client = connect({
  host: '192.168.254.123',
  port: 1883,
  username: 'apartment_broker',
  password: config.PASSWORD
});

function connectWand(p) {
  console.log('connectWand function has run');
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
        console.log('ack_reset message sent');
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
        console.log('attempting to connect to wand from mqtt message');
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
      console.log('attempting to connect to wand from pressing r');
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
        console.log('attempting initial connect wand');
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

process.stdin.setRawMode(true);