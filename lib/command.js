"use strict";

function Command(command, args, callback, call_on_write, reply) {
    this.command = command;
    this.args = args;
    this.callback = callback;
    this.call_on_write = call_on_write;
    if (reply === undefined)
        this.reply = true;
    else
        this.reply = reply;
}

module.exports = Command;
