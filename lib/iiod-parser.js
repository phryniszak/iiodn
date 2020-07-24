const COMMAND_CODES = require("./command_codes");

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
        this.bigStrSize = 0;
        this.totalChunkSize = 0;
        this.bufferCache = [];
        this.arrayCache = [];
        this.arrayPos = [];
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
        } else if (this.bigStrSize === 0) {
            const oldLength = this.buffer.length;
            const remainingLength = oldLength - this.offset;
            const newBuffer = Buffer.allocUnsafe(remainingLength + buffer.length);
            this.buffer.copy(newBuffer, 0, this.offset, oldLength);
            buffer.copy(newBuffer, remainingLength, 0, buffer.length);
            this.buffer = newBuffer;
            this.offset = 0;
            if (this.arrayCache.length) {
                const arr = parseArrayChunks(this);
                if (arr === undefined) {
                    return;
                }
                this.returnReply(arr);
            }
        } else if (this.totalChunkSize + buffer.length >= this.bigStrSize) {
            this.bufferCache.push(buffer);
            var tmp = this.optionReturnBuffers ? concatBulkBuffer(this) : concatBulkString(this);
            this.bigStrSize = 0;
            this.bufferCache = [];
            this.buffer = buffer;
            if (this.arrayCache.length) {
                this.arrayCache[0][this.arrayPos[0]++] = tmp;
                tmp = parseArrayChunks(this);
                if (tmp === undefined) {
                    return;
                }
            }
            this.returnReply(tmp);
        } else {
            this.bufferCache.push(buffer);
            this.totalChunkSize += buffer.length;
            return;
        }

        //
        var response;
        switch (command.command) {
            case COMMAND_CODES.VERSION:
                response = this.parseVersion();
                break;
            case COMMAND_CODES.PRINT:
                response = this.parseIntChunk();
                break;

        }

        if (response === undefined) {
            if (!(this.arrayCache.length || this.bufferCache.length)) {
                this.offset = offset;
            }
            return;
        }

        this.returnReply(response);
        this.buffer = null;
    }

    //
    //
    //
    parseVersion() {
        const buffer = this.buffer;
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
            JSON.stringify(parser.buffer),
            parser.offset
        );
        this.buffer = null;
        this.returnFatalError(err);
    }
}

module.exports = IIODParser;