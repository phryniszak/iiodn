const sm = require("./sm");
const iiolib = require("../index");

// const IO = require("./lib/iiod-enums").IO;
// const parseString = require("xml2js").parseString;

const options = {};
options.host = "192.168.1.224";
options.retry_on = false;
var iio;

//  iio.on("ready", () => {
//     console.log("ready");

// iio.version((error, replay) => console.log(replay));

// iio.print((error, replayXML) => {
//     parseString(replayXML, (err, result) => {
//         console.dir(result);
//     });
// });

// iio.timeout(2500, (error, replay) => console.log(replay));

// iio.gettrig("iio:device0", (error, replay) => console.log(replay));

// iio.read("iio:device0", IO.INPUT, "voltage0-voltage1", "sampling_frequency", (error, replay) => {
//     console.log(replay);
//     iio.exit();
// });

// iio.open("iio:device0", 400, "00000010", false, (error, replay) => {
//     console.log(replay);
//     iio.readbuf("iio:device0", 400, (error, replay) => {
//         console.log(replay);
//     });
// });
// });

// iio.version(print);

// console.log(iio);

sm.observe({
    onConnected: function () { console.log("onConnected"); },
    onConnect: function () { 
        console.log("onConnect"); 
        iio = new iiolib(options);

        iio.on("ready", () => {
            console.log("ready");
        });

        iio.on("error", (error) => {
            console.error("error: ", error);

            if (error.errno === "EHOSTUNREACH") {
                console.log("EHOSTUNREACH");
            }
        });

        iio.on("end", () => {
            console.error("end");
            sm.trNotConnected();
        });    
    },
    onNotConnected: function () {
        console.log("onNotConnected");
        sm.trConnectDelay();
    },
    onConnectDelay: function () { 
        console.log("onConnectDelay"); 
        setTimeout(() => {
            sm.trConnect();
        }, 1000);
    },
});

sm.trInit();
