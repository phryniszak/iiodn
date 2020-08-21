const iiolib = require("../index");
const IO = require("../lib/iiod-enums").IO;

const options = {};
options.host = "192.168.1.224";
options.retry_on = true;
const iio = new iiolib(options);

var iioDevice = {};

// STATE //////////////////////////////////////////////////

const EN_NOT_INITIALIZED = 0;
const EN_CONNECTED = 1;
const EN_VERSION_OK = 2;
const EN_PRINT_OK = 3;
const EN_TIMEOUT_OK = 4;
const EN_READ_FREQ_OK = 5;
const EN_OPEN_BUFF_OK = 6;
const EN_READ_BUFF_OK = 7;

var state = EN_NOT_INITIALIZED;

//
//
//
function setState(_state) {
    switch (_state) {
        case EN_CONNECTED:
            iioVersion();
            break;
        case EN_VERSION_OK:
            iioPrint();
            break;
        case EN_PRINT_OK:
            iioTimeout();
            break;
        case EN_TIMEOUT_OK:
            iioGetSamplingFreq();
            break;
        case EN_READ_FREQ_OK:
            iioOpenBuffer();
            break;
        case EN_OPEN_BUFF_OK:
            iioReadBuffer();
            break;
        case EN_READ_BUFF_OK:
            iioReadBuffer();
            break;
    }

    state = _state;
}

//
//
//
function getState() {
    return state;
}

// IIOD requests //////////////////////////////////////////

function iioVersion() {
    console.log("get VERSION:");
    iio.version((error, version) => {
        console.log(version);
        iioDevice.version = version;
        setState(EN_VERSION_OK);
    });
}

function iioPrint() {
    console.log("get PRINT:");
    iio.print((error, print) => {
        console.log(print);
        iioDevice.print = print;
        setState(EN_PRINT_OK);
    });
}

function iioTimeout() {
    console.log("set TIMEOUT:");
    iio.timeout(2500, (error, replay) => {
        console.log(replay);
        setState(EN_TIMEOUT_OK);
    });
}

function iioGetSamplingFreq() {
    console.log("get sampling frequency:");
    iio.read("iio:device0", IO.INPUT, "voltage0-voltage1", "sampling_frequency", (error, replay) => {
        console.log(replay);
        setState(EN_READ_FREQ_OK);
    });
}

function iioOpenBuffer() {
    console.log("open buffer:");
    iio.open("iio:device0", 400, "00000010", false, (error, result) => {
        console.log(result);
        setState(EN_OPEN_BUFF_OK);
    });
}

function iioReadBuffer() {
    console.log("read buffer:");
    iio.readbuf("iio:device0", 400, (error, buffer) => {
        console.log(buffer);
        setState(EN_READ_BUFF_OK);
    });
}

// iio.gettrig("iio:device0", (error, replay) => console.log(replay));

// IIOD ///////////////////////////////////////////////////

iio.on("ready", () => {
    console.log("ready");
    setState(EN_CONNECTED);
});

iio.on("error", (error) => {
    console.error("error: ", error);
});