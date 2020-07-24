const iiolib = require("./index");


var options = {};
options.host = "192.168.1.224";
const iio = new iiolib(options);

iio.on("error", (error) => {
    console.error("error: ", error);
});

iio.on("ready", () => {
    console.log("ready");
    // iio.version((error, replay) => console.log(replay));
    iio.print((error, replay) => console.log(replay));
});

// iio.version(print);

// console.log(iio);