import just from 'string-just';
import kano from './kano_info.json' assert {type: "json"};
import async from 'async';
import gestureSpells from './gesture-spells.js';
import { Observable, Subject, ReplaySubject, from, of, range } from 'rxjs';
// import { map } from 'rxjs/operators/map.js';
// import { filter } from 'rxjs/operators/filter.js';
// import { switchMap } from 'rxjs/operators/switchMap.js';
import Conv from './conversion.js';

const width = 800;
const height = 600

const conv = new Conv(width, height);
var gr = new gestureSpells()


export default class KanoWand {
    
    constructor() {
        this.name = null;
        this.buttonCharacteristic = null;
        this.vibrateCharacteristic = null;
        this.quaternionsCharacteristic = null;
        this.quaternionsResetCharacteristic = null;
        this.currentSpell = [];
        this.buttonPressed = false;
        this.timeUp = new Date();
        this.timeDown = new Date();
        this.resetTimeout = 0.2 // determins a quick press for wand reset (milliseconds)
        this.spells = new Subject();
        this.positions = new Subject();
    }

    static uInt8ToUInt16(byteA, byteB) {
        const number = (((byteB & 0xff) << 8) | byteA);
        const sign = byteB & (1 << 7);

        if (sign) {
            return 0xFFFF0000 | number;
        }

        return number;
    }

    processCharacteristic(characteristic) {
        {
            if (compareUUID(characteristic.uuid, kano.SENSOR.QUATERNIONS_CHAR)) {
                this.logWithName("Found position characteristic");
                this.quaternionsCharacteristic = characteristic;
            }

            if (compareUUID(characteristic.uuid, kano.IO.USER_BUTTON_CHAR)) {
                this.logWithName("Found button characteristic");
                this.buttonCharacteristic = characteristic;
            }

            if (compareUUID(characteristic.uuid, kano.SENSOR.QUATERNIONS_RESET_CHAR)) {
                this.logWithName("Found ResetChar characteristic");
                this.quaternionsResetCharacteristic = characteristic;
            }

            if (compareUUID(characteristic.uuid, kano.IO.VIBRATOR_CHAR)) {
                this.logWithName("Found vibrate characteristic");
                this.vibrateCharacteristic = characteristic;
            }
        }
    }

    vibrate(pattern) {
        var vibrate = Buffer.alloc(1);
        vibrate.writeUInt8(pattern,0)
        this.vibrateCharacteristic.write(vibrate, true);
    }

    init(peripheral, name) {
        this.name = name || peripheral.advertisement.localName;
        this.logWithName("init");
        var serviceUUIDs = [kano.SENSOR.SERVICE.replace(/-/g, "").toLowerCase(), kano.IO.SERVICE.replace(/-/g, "").toLowerCase(), kano.INFO.SERVICE.replace(/-/g, "").toLowerCase()];

        const $this = this;
        return new Promise((resolve, reject) => {
            async.waterfall([
                function(callback) {
                    this.logWithName("Discovering services...");
                    peripheral.discoverServices(serviceUUIDs, callback);
                }.bind(this),
                function(services, callback) {
                    this.logWithName("Found", services.length, "services");
                    var tasks = []
                    services.forEach(function(service) {
                        tasks.push(function(callback) {
                            this.logWithName("Discovering characteristics for service with UUID", service.uuid);
                            service.discoverCharacteristics([], callback);
                        }.bind(this))
                    }.bind(this))
    
                    async.parallel(tasks, callback);
                }.bind(this),
                function (characteristics, callback) {
                    characteristics = characteristics.flat();
                    characteristics.forEach(this.processCharacteristic, this)
                    callback();
                }.bind(this),
                this.subscribe_position.bind(this),
                this.subscribe_button.bind(this),
                this.reset_position.bind(this)
            ], function (err, result) {
                this.logWithName("Wand ready!");
                resolve(true);
            }.bind(this));
        });
    }

    subscribe_button(callback) {
        this.logWithName("Subscribe to button characteristic")
        this.buttonCharacteristic.on('read', this.onButtonUpdate.bind(this));
        this.buttonCharacteristic.subscribe(callback);
    }

    onButtonUpdate(data, isNotification) {
        const raw = data.readUIntBE(0, 1);
        
        const pressed = raw == 1 ? true : false;
        
        this.buttonPressed = pressed;

        // timing

        if (pressed) {
            this.timeUp = new Date();
        } else {
            this.timeDown = new Date();
        }

        var seconds = (this.timeDown.getTime() - this.timeUp.getTime()) / 1000;

        if (pressed) {
            this.spell = null;
        } else if (seconds < this.resetTimeout) { // not pressed
            this.reset_position();
        } else if (this.currentSpell.length > 5) { // not pressed
            this.currentSpell = this.currentSpell.splice(5);
            let flippedPositions = [];

            this.currentSpell.forEach((entry) => {
                flippedPositions.push(KanoWand.flipCord(entry));
            })

            const positions = this.currentSpell;
            gr.recognise(flippedPositions)
            .then((data) =>{
                data.positions = flippedPositions;
                this.spells.next(data);
            });
            this.currentSpell = [];
        }
    }

    static flipCord(cords) {
        const x = cords[0]
        const y = cords [1]
        const iy = height - (y);
        return [x, iy];
    }

    subscribe_position(callback) {
        this.logWithName("Subscribe to motion characteristic")
        this.quaternionsCharacteristic.on('read', this.onMotionUpdate.bind(this));
        this.quaternionsCharacteristic.subscribe(callback);
    }

    onMotionUpdate(data, isNotification) {
        let y = data.readInt16LE(0);
        let x = data.readInt16LE(2);
        let w = data.readInt16LE(4);
        let z = data.readInt16LE(6);

        const pos = conv.position([x, y, z, w]);
    
        let pitch = `Pitch: ${just.ljust(z.toString(), 16, " ")}`;
        let roll = `Roll: ${just.ljust(w.toString(), 16, " ")}`;
    
        // this.logWithName(`${pitch}${roll}(x, y): (${x.toString()}, ${y.toString()})`)
        // this.logWithName(this.getXY(x, y))
        if (this.buttonPressed) {
            this.currentSpell.push([pos.x, pos.y]);
            this.positions.next([pos.x, pos.y]);
        }
    }

    reset_position(callback) {
        this.logWithName("Reset position");
        var reset = Buffer.alloc(1);
        reset.writeUInt8(1,0)
        this.quaternionsResetCharacteristic.write(reset, true);

        if (typeof(callback) == typeof(Function)) {
            callback();
        }
    }

    logWithName(args) {
        let logs = ["[" + this.name + "]"].concat(args);
        console.log(logs);
    }
}

function compareUUID(val1, val2) {
    val1 = val1.replace(/-/g, "").toLowerCase();
    val2 = val2.replace(/-/g, "").toLowerCase();

    return val1 === val2;
};