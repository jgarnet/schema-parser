const getOptions = require('./options');

function info(...values) {
    if (getOptions().log) {
        console.log(...values);
    }
}

function warn(...values) {
    if (getOptions().log) {
        console.warn(...values);
    }
}

function error(...values) {
    if (getOptions().log) {
        console.error(...values);
    }
}

module.exports = { info, warn, error };