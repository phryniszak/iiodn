const COMMAND = require("./iiod-enums").CMD;
// const debug = require("debug")("IIODParser");

class IIODParser {
    /**
     * Javascript Redis Parser constructor
     * @param {{returnError: Function, returnReply: Function, returnFatalError?: Function, returnBuffers: boolean, stringNumbers: boolean }} options
     * @constructor
     */
    constructor(options) {
        if (!options) {
            throw new TypeError("Options are mandatory.");
        }
        if (typeof options.returnError !== "function" || typeof options.returnReply !== "function") {
            throw new TypeError("The returnReply and returnError options have to be functions.");
        }
        this.returnError = options.returnError;
        this.returnFatalError = options.returnFatalError || options.returnError;
        this.returnReply = options.returnReply;
        this.reset();
    }

    /**
     * Reset the parser values to the initial state
     *
     * @returns {undefined}
     */
    reset() {
        this.offset = 0;
        this.buffer = null;
        this.strings = [];
    }

    /**
     * Parse the redis buffer
     * @param {Buffer} buffer
     * @param {Command} command
     * @returns {undefined}
     */
    execute(buffer, command) {

        if (this.buffer === null) {
            this.buffer = buffer;
            this.offset = 0;
        } else {
            const oldLength = this.buffer.length;
            const remainingLength = oldLength - this.offset;
            if (remainingLength === 0) {
                this.buffer = buffer;
                this.offset = 0;
            } else {
                const newBuffer = Buffer.allocUnsafe(remainingLength + buffer.length);
                this.buffer.copy(newBuffer, 0, this.offset, oldLength);
                buffer.copy(newBuffer, remainingLength, 0, buffer.length);
                this.buffer = newBuffer;
                this.offset = 0;
            }
        }

        //
        var response;
        switch (command.command) {
            case COMMAND.VERSION:
                response = this.parseVersion();
                break;
            case COMMAND.PRINT:
                response = this.parseIntChunk();
                break;
            case COMMAND.TIMEOUT:
                response = this.parseIntChunk();
                break;
            case COMMAND.GETTRIG:
                response = this.parseIntChunk();
                break;
            case COMMAND.READ:
                response = this.parseIntChunk();
                break;
            case COMMAND.OPEN:
                response = this.parseIntChunk();
                break;
        }

        if (response === undefined) {
            return;
        }

        this.returnReply(response);
        this.reset();
    }

    //
    // naive, but good for now
    //
    parseVersion() {
        const buffer = this.buffers.pop();
        var start = this.offset;
        var stop = buffer.indexOf(0x0a, start);

        if (stop === -1) {
            // TODO:
            this.handleError();
        }

        const version = buffer.toString("utf8", start, stop - 1);

        start = 0;
        stop = buffer.indexOf(".", start);
        if (stop === -1) {
            // TODO:
            this.handleError();
        }

        const maj = parseInt(version.substring(start, stop), 10);

        start = stop + 1;
        stop = buffer.indexOf(".", start);
        if (stop === -1) {
            // TODO:
            this.handleError();
        }

        const min = parseInt(version.substring(start, stop), 10);
        const git_tag = version.substring(stop + 1).trim();

        return { maj, min, git_tag };
    }

    //
    // naive, but good for now
    //
    parseIntChunk() {

        const retStr = this.parseSimpleString();
        if (retStr !== undefined) {

            // ret < 0 - error
            // ret == 0 - OK
            const retInt = parseInt(retStr, 10);
            if (retStr == retInt) {
                // no point to wait for more data, return
                if (retInt < 1) {
                    return retInt;
                }
            }

            this.strings.push(retStr);
        }

        if (this.strings.length < 2) {
            return;
        }

        const chunkSize = parseInt(this.strings[0], 10);
        if ((this.strings[0] == chunkSize) && (this.strings[1].length === chunkSize)) {
            return this.strings[1];
        }

        this.handleError();
    }

    //
    //
    //
    parseInt() {
        const string = this.parseSimpleString();
        const int = parseInt(string, 10);
        if (int == string) {
            return int;
        }
    }

    /**
     * Parsing error handler, resets parser buffer
     * @param {JavascriptRedisParser} parser
     * @param {number} type
     * @returns {undefined}
     */
    handleError(parser, type) {
        // TODO:
        const err = new ParserError(
            "Protocol error, got " + JSON.stringify(String.fromCharCode(type)) + " as reply type byte",
            JSON.stringify(this.buffer),
            this.offset
        );
        this.buffer = null;
        this.returnFatalError(err);
    }

    /**
     * Parse a simple string response and forward the offsets
     * @returns {undefined|string}
     */
    parseSimpleString() {
        const start = this.offset;
        const buffer = this.buffer;
        const length = buffer.length;
        var offset = start;

        while (offset < length) {
            if (buffer[offset++] === 0x0a) {
                this.offset = offset;
                return this.buffer.toString("utf8", start, offset - 1);
            }
        }
    }
}

module.exports = IIODParser;