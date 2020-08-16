const child = require("child_process");
const fs = require("fs");

const visualize = require("javascript-state-machine/lib/visualize");
const sm = require("./sm");

const dot = visualize(sm);
// const svg = dot2svg(dot);
const png = dot2png(dot);

console.log("visualizing sm.js");

// fs.writeFileSync("./app_sm/state_machine.dot", dot);
// fs.writeFileSync("./app_sm/state_machine.svg", svg);
fs.writeFileSync("./app_sm/state_machine.png", png, "binary");

//-------------------------------------------------------------------------------------------------

function dot2svg(dot) {
    var result = child.spawnSync("dot", ["-Tsvg"], { input: dot });
    if (result.error)
        dotError(result.error.errno);
    return result.stdout.toString();
}

//-------------------------------------------------------------------------------------------------

function dot2png(dot) {
    var result = child.spawnSync("dot", ["-Tpng"], { input: dot });
    if (result.error)
        dotError(result.error.errno);
    return result.stdout;
}

//-------------------------------------------------------------------------------------------------

function dotError(errno) {
    if (errno === "ENOENT")
        throw new Error("dot program not found. Install graphviz (http://graphviz.org)");
    else
        throw new Error("unexpected error: " + errno);
}

  //-------------------------------------------------------------------------------------------------