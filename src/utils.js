function capitalize(str) {
    if (!str) {
        return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(name) {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
    if (name.endsWith('ses')) return name.slice(0, -3) + 'sis';
    if (name.endsWith('s')) return name.slice(0, -1);
    return name;
}

// todo: account for all uppercase values
function toCamel(name, symbol) {
    const parts = name?.toLowerCase().split(symbol);
    if (parts.length > 1) {
        return parts[0].toLowerCase() + parts.slice(1).map(capitalize).join('');
    }
    return name;
}

function snakeToCamel(name) {
    return toCamel(name, '_');
}

function dashToCamel(name) {
    return toCamel(name, '-');
}

function getOptions() {
    const options = {};
    if (process.argv.length < 3) {
        return options;
    }
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = dashToCamel(arg.slice(2));
            const value = i + 1 < args.length ? args[i + 1] : null;
            options[key] = value;
            if (value !== null) {
                i++;
            }
        }
    }
    return options;
}

function getNodeKey(key) {
    const parts = key.split('-');
    return parts.slice(0, parts.length - 1).join('');
}

function getParentRef(refs, key, inChain = false) {
    if (refs.has(key)) {
        return getParentRef(refs, refs.get(key), true);
    }
    return inChain ? key : null;
}

function getTypeName(name) {
    if (name.indexOf('-') !== -1) {
        name = dashToCamel(name);
    }
    if (name.indexOf('_') !== -1) {
        name = snakeToCamel(name);
    }
    return capitalize(name);
}

module.exports = {
    capitalize,
    singularize,
    snakeToCamel,
    getOptions,
    dashToCamel,
    getNodeKey,
    getParentRef,
    getTypeName
};