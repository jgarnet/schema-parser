const {dashToCamel} = require('./utils');
let OPTIONS = null;

function buildOptions() {
    const options = {};
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = dashToCamel(arg.slice(2));
            let value = i + 1 < args.length ? args[i + 1] : true;
            if (typeof value === 'string') {
                // boolean flags
                if (value.startsWith('--') || value.trim().toLowerCase() === 'true') {
                    value = true;
                } else if (value.trim().toLowerCase() === 'false') {
                    value = false;
                }
            }
            options[key] = value;
            if (value !== null && value !== true) {
                i++;
            }
        }
    }
    return {
        rootName: process.env.SP_ROOT_NAME ?? 'Root',
        type: process.env.SP_TYPE ?? 'java',
        disableReduce: process.env.SP_DISABLE_REDUCE ?? false,
        serializer: process.env.SP_SERIALIZER ?? 'jackson',
        log: process.env.SP_LOG ?? false,
        ...options
    };
}

function getOptions() {
    if (!OPTIONS) {
        OPTIONS = buildOptions();
    }
    return OPTIONS;
}

module.exports = getOptions;