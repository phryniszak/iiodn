const EventEmitter = require("events");
const net = require("net");

const debug = require("debug")("IIODClient");

const Parser = require("./lib/iiod-parser");
const Command = require("./lib/command");
const COMMAND = require("./lib/iiod-enums").CMD;

// https://wiki.analog.com/resources/tools-software/linux-software/libiio_internals

class IIODClient extends EventEmitter {

    // static connection_id = 0;

    constructor(options) {
        super();

        options = options || {};
        // TODO: Copy the options so they are not mutated
        // options = util.clone(options);

        var cnx_options = {};
        cnx_options.port = +options.port || 30431;
        cnx_options.host = options.host || "127.0.0.1";
        cnx_options.family = (!options.family && net.isIP(cnx_options.host)) || (options.family === "IPv6" ? 6 : 4);
        cnx_options.timeout = +options.timeout || 1000;

        this.address = cnx_options.host + ":" + cnx_options.port;
        this.connection_options = cnx_options;
        this.connected = false;
        this.ready = false;
        this.closing = false;

        if (options.socket_keepalive === undefined) {
            options.socket_keepalive = true;
        }
        if (options.socket_initial_delay === undefined) {
            options.socket_initial_delay = 0;
            // set default to 0, which is aligned to https://nodejs.org/api/net.html#net_socket_setkeepalive_enable_initialdelay
        }

        this.times_connected = 0;

        // init retry
        this.retry_attempts = +options.retry_attempts || 10;
        this.retry_delay = +options.retry_delay || 200;
        this.retry_on = !!options.retry_on;
        if (options.retry_on === undefined) {
            this.retry_on = true;
        }
        this.initialize_retry_vars();

        this.options = options;
        this.create_stream();
    }

    //
    //
    //
    create_parser() {
        return new Parser({
            returnReply: (data) => {
                this.return_reply(data);
            },
            returnError: (err) => {
                // Return a ReplyError to indicate Redis returned an error
                this.return_error(err);
            },
            returnFatalError: (err) => {
                // Error out all fired commands. Otherwise they might rely on faulty data. We have to reconnect to get in a working state again
                // Note: the execution order is important. First flush and emit, then create the stream
                err.message += ". Please report this.";
                this.ready = false;
                this.flush_and_error({
                    message: "Fatal error encountered. Command aborted.",
                    code: "NR_FATAL"
                }, {
                    error: err,
                    queues: ["command_queue"]
                });
                this.emit("error", err);
                this.create_stream();
            },
        });
    }

    //
    //
    //
    create_stream() {

        // Init parser
        this.reply_parser = this.create_parser();

        // On a reconnect destroy the former stream and retry
        if (this.stream) {
            this.stream.removeAllListeners();
            this.stream.destroy();
        }

        this.stream = net.createConnection(this.connection_options);

        this.stream.once("connect", () => {
            this.removeAllListeners("timeout");
            this.times_connected++;
            this.on_connect();
        });

        this.stream.on("data", (buffer_from_socket) => {
            // The buffer_from_socket.toString() has a significant impact on big chunks and therefore this should only be used if necessary
            debug("Received " + this.address + " id " + IIODClient.connection_id + ": " + buffer_from_socket.toString());
            this.reply_parser.execute(buffer_from_socket, this.command);
        });

        this.stream.on("error", (err) => this.on_error(err));

        this.stream.once("close", () => this.connection_gone("close"));

        this.stream.once("end", () => this.connection_gone("end"));

        this.stream.on("drain", () => this.drain());

        this.stream.setNoDelay();
    }

    //
    //
    //
    connection_gone(why, error) {
        // If a retry is already in progress, just let that happen
        if (this.retry_timer) {
            return;
        }
        error = error || null;

        debug("iiodn connection is gone from " + why + " event.");
        this.connected = false;
        this.ready = false;

        // since we are collapsing end and close, users don't expect to be called twice
        if (!this.emitted_end) {
            this.emit("end");
            this.emitted_end = true;
        }

        // If this is a requested shutdown, then don't retry
        if (this.closing) {
            debug("Connection ended by quit / end command, not retrying.");
            this.flush_and_error({
                message: "Stream connection ended and command aborted.",
                code: "NR_CLOSED"
            }, {
                error: error
            });
            return;
        }

        if ((!this.retry_on) || (this.retry_attempts_cnt >= this.retry_attempts)) {
            var message = "connection in broken state: connection timeout exceeded.";
            this.flush_and_error({
                message: message,
                code: "CONNECTION_BROKEN",
            }, {
                error: error
            });
            var err = new Error(message);
            err.code = "CONNECTION_BROKEN";
            if (error) {
                err.origin = error;
            }

            this.end(false);
            this.emit("error", err);
            return;
        }

        // if (this.retry_totaltime + this.retry_delay > this.connect_timeout) {
        //     // Do not exceed the maximum
        //     this.retry_delay = this.connect_timeout - this.retry_totaltime;
        // }

        debug("Retry connection in " + this.retry_delay + " ms");
        this.retry_timer = setTimeout(() => this.retry_connection(error), this.retry_delay);
    }

    //
    //
    //
    retry_connection(error) {

        this.retry_attempts_cnt++;

        var reconnect_params = {
            delay: this.retry_delay,
            attempt: this.retry_attempts_cnt,
            error: error
        };

        this.emit("reconnecting", reconnect_params);

        debug("Retrying connection, attempt ", this.retry_attempts_cnt);

        this.create_stream();
        this.retry_timer = null;
    }

    //
    //
    //
    on_error(err) {
        if (this.closing) {
            return;
        }

        err.message = "iiod connection to " + this.address + " failed - " + err.message;

        debug(err.message);
        this.connected = false;
        this.ready = false;

        // Only emit the error if we dont try to retry connection
        if (!this.retry_on) {
            this.emit("error", err);
        }
        // 'error' events get turned into exceptions if they aren't listened for. If the user handled this error
        // then we should try to reconnect.
        this.connection_gone("error", err);
    }

    //
    //
    //
    on_connect() {
        debug("Stream connected " + this.address + " id " + IIODClient.connection_id);

        this.connected = true;
        this.ready = false;
        this.emitted_end = false;
        this.stream.setKeepAlive(this.options.socket_keepalive, this.options.socket_initial_delay);
        this.stream.setTimeout(0);

        this.emit("connect");
        this.initialize_retry_vars();

        this.on_ready();
    }

    //
    //
    //
    on_ready() {
        debug("on_ready called " + this.address + " id " + IIODClient.connection_id);
        this.ready = true;
        this.emit("ready");
    }

    //
    //
    // Flush provided queues, erroring any items with a callback first
    flush_and_error(error_attributes, options) {
    }

    //
    //
    //
    initialize_retry_vars() {
        this.retry_timer = null;
        this.retry_attempts_cnt = 0;
    }

    //
    //
    //
    internal_send_command(command_obj) {

        var i = 0;
        var command_str = "";
        const args = command_obj.args;
        const command = command_obj.command;
        const len = args.length;
        const args_copy = new Array(len);

        if (process.domain && command_obj.callback) {
            command_obj.callback = process.domain.bind(command_obj.callback);
        }

        if (this.ready === false || this.stream.writable === false) {
            debug("not ready for write");
            return false;
        }

        for (i = 0; i < len; i += 1) {
            if (typeof args[i] === "string") {
                args_copy[i] = args[i];
            } else if (typeof args[i] === "number") {
                args_copy[i] = `${args[i]}`;
            } else {
                var invalidArgError = new Error("IIODClient: The " + command.toUpperCase() + " command contains a invalid argument type.");
                invalidArgError.command = command_obj.command.toUpperCase();
                if (command_obj.args && command_obj.args.length) {
                    invalidArgError.args = command_obj.args;
                }
                if (command_obj.callback) {
                    command_obj.callback(invalidArgError);
                    return false;
                }
                throw invalidArgError;
            }
        }

        command_str += command;

        for (i = 0; i < len; i += 1) {
            command_str += " " + args_copy[i];
        }

        command_str += "\r\n";

        debug(`Send ${this.address} id ${IIODClient.connection_id}: ${command_str}`);
        this.stream.write(command_str);

        // call write callback
        if (command_obj.call_on_write) {
            command_obj.call_on_write();
        }

        // Handle reply callback 
        // This has to be checked after call_on_write
        if (command_obj.reply) {
            this.command = command_obj;
        } else {
            this.command = null;

            // Do not expect a reply
            if (command_obj.callback) {
                command_obj.callback();
            }
        }
    }

    return_reply(reply) {
        // if (this.monitoring) {
        //     var replyStr;
        //     if (this.buffers && Buffer.isBuffer(reply)) {
        //         replyStr = reply.toString();
        //     } else {
        //         replyStr = reply;
        //     }
        //     // If in monitor mode, all normal commands are still working and we only want to emit the streamlined commands
        //     if (typeof replyStr === 'string' && utils.monitor_regex.test(replyStr)) {
        //         var timestamp = replyStr.slice(0, replyStr.indexOf(' '));
        //         var args = replyStr.slice(replyStr.indexOf('"') + 1, -1).split('" "').map(function (elem) {
        //             return elem.replace(/\\"/g, '"');
        //         });
        //         this.emit('monitor', timestamp, args, replyStr);
        //         return;
        //     }
        // }

        if (this.command) {
            if (typeof this.command.callback === "function") {
                this.command.callback(null, reply);
            } else {
                debug("No callback for reply");
            }
        } else {
            // this shouldnt happen
            this.emit("error", new Error("return_reply no this.command"));
            return;
        }
    }


    // //////////////////////////////////////////////////////////////////////////////////////////////////

    //
    //
    //
    version(callback) {
        return this.internal_send_command(new Command(COMMAND.VERSION, [], callback));
    }

    //
    //
    //
    print(callback) {
        return this.internal_send_command(new Command(COMMAND.PRINT, [], callback));
    }

    //
    //
    //
    timeout(timeout_ms, callback) {
        return this.internal_send_command(new Command(COMMAND.TIMEOUT, [timeout_ms], callback));
    }

    //
    //
    //
    gettrig(device, callback) {
        return this.internal_send_command(new Command(COMMAND.GETTRIG, [device], callback));
    }

    //
    //
    //
    read(device, io, channel, attribute, callback) {
        return this.internal_send_command(new Command(COMMAND.READ, [device, io, channel, attribute], callback));
    }

    //
    // READBUF <device> <bytes_count>
    // Read raw data from the specified device
    readbuf(device, bytes_count, callback) {
        return this.internal_send_command(new Command(COMMAND.READBUF, [device, bytes_count], callback));
    }

    //
    //
    //
    exit() {
        this.internal_send_command(new Command(COMMAND.EXIT, [], null, null, false));
        this.end();
    }

    //
    //
    //
    end() {
        // Clear retry_timer
        if (this.retry_timer) {
            clearTimeout(this.retry_timer);
            this.retry_timer = null;
        }

        this.stream.removeAllListeners();
        this.stream.on("error", () => { });
        this.connected = false;
        this.ready = false;
        this.closing = true;
        return this.stream.destroySoon();

    }

    //
    // OPEN <device> <samples_count> <mask> [CYCLIC]
    // Open the specified device with the given mask of channels
    //
    // The “dev” parameter corresponds to the iio_device object that will be used.
    // - The “samples_count” will set the size of the kernel's internal buffer. The value set should correspond to the amount
    // of samples that will be asked in each read or write operation.
    // - The “cyclic” variable is used to inform the kernel whether or not the device is to be opened in cyclic mode.
    // In this configuration, the first buffer of samples pushed to the hardware will be repeated continuously.
    // - "mask" - set to enable given channel
    open(device, samples_count, mask, cyclic, callback) {

        if (cyclic !== undefined && cyclic == true) {
            cyclic = "CYCLIC";
        } else {
            cyclic = "";
        }

        return this.internal_send_command(new Command(COMMAND.OPEN, [device, samples_count, mask, cyclic], callback));
    }
}

module.exports = IIODClient;
