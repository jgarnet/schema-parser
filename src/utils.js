function capitalize(str) {
    if (!str) {
        return str;
    }
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function singularize(name) {
    if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
    if (name.endsWith('s')) return name.slice(0, -1);
    return name;
}

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

module.exports = {
    capitalize,
    singularize,
    snakeToCamel,
    getOptions,
    dashToCamel
};