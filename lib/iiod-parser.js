const COMMAND = require("./iiod-enums").CMD;
const debug = require("debug")("IIODParser");

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
            case COMMAND.READBUF:
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
        const version = this.parseSimpleString();

        let start = 0;
        let stop = version.indexOf(".", start);
        if (stop === -1) {
            // TODO:
            this.handleError();
        }

        const maj = parseInt(version.substring(start, stop), 10);

        start = stop + 1;
        stop = version.indexOf(".", start);
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

        let retStr = this.parseSimpleString();
        while (retStr !== undefined) {


            // ret < 0 - error
            // ret == 0 - OK
            // check if there is a point to wait for more data
            if (this.strings.length == 0) {
                const retInt = this._parseInt(retStr);
                if ((retInt !== undefined) && (retInt < 1)) {
                    return retInt;
                }
            }

            this.strings.push(retStr);
            retStr = this.parseSimpleString();
        }

        if (this.strings.length < 2) {
            return;
        }

        const chunkSize = this._parseInt(this.strings[0]);
        if ((this.strings[0] == chunkSize) && (this.strings[1].length === chunkSize)) {
            return this.strings[1];
        }

        // check is it buffer read case <buffer_lenght> <mask> <buffer>
        if (this.strings.length == 2) {
            const buffSize = this._parseInt(this.strings[0]);
            if (buffSize == (this.buffer.length - this.offset)) {
                return this.buffer.slice(this.offset);
            }
        }


        this.handleError();
    }

    //
    // https://stackoverflow.com/questions/22809401/removing-a-null-character-from-a-string-in-javascript
    //
    trimNull(a) {
        var c = a.indexOf("\0");
        if (c > -1) {
            return a.substr(0, c);
        }
        return a;
    }

    //
    //
    //
    _parseInt(str) {
        const int = parseInt(str, 10);
        if (int == this.trimNull(str)) {
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