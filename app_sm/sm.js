const StateMachine = require("javascript-state-machine");

const sm = new StateMachine({
  transitions: [
    { name: "tr_init", from: "none", to: "connect" },
    // { name: "tr_connect", from: "connect_delay", to: "connect" },
    { name: "tr_not_connected", from: "connect", to: "not_connected" },
    { name: "tr_connect_delay", from: "not_connected", to: "connect_delay" },

    //{ name: "ping_send", from: "connected", to: "ping" },
    //{ name: "ping_ok", from: "ping", to: "connected" },
  ]
});

module.exports = sm;