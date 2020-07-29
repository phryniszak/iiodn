const iiolib = require("./index");
const IO = require("./lib/iiod-enums").IO;

// const parseString = require("xml2js").parseString;

var options = {};
options.host = "192.168.1.224";
const iio = new iiolib(options);

iio.on("error", (error) => {
    console.error("error: ", error);
});

iio.on("ready", () => {
    console.log("ready");
    // iio.version((error, replay) => console.log(replay));

    // iio.print((error, replayXML) => {
    //     parseString(replayXML, (err, result) => {
    //         console.dir(result);
    //     });
    // });

    // iio.timeout(2500, (error, replay) => console.log(replay));

    //iio.gettrig("iio:device0", (error, replay) => console.log(replay));

    iio.read("iio:device0", IO.INPUT, "voltage0-voltage1", "sampling_frequency", (error, replay) => console.log(replay));
});

// iio.version(print);

// console.log(iio);