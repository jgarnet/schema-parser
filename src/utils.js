require('dotenv').config();
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

function _toCamel(name, symbol) {
    const parts = name?.toLowerCase().split(symbol);
    if (parts.length > 1) {
        return parts[0].toLowerCase() + parts.slice(1).map(capitalize).join('');
    }
    return name;
}

function snakeToCamel(name) {
    return _toCamel(name, '_');
}

function dashToCamel(name) {
    return _toCamel(name, '-');
}

function toCamel(name) {
    if (name.indexOf('-') !== -1) {
        name = dashToCamel(name);
    }
    if (name.indexOf('_') !== -1) {
        name = snakeToCamel(name);
    }
    if (/^[A-Z]*$/.test(name)) {
        name = name.toLowerCase();
    }
    return name;
}

/**
 * Retrieves original node key based on schema definition (removing nest level suffix).
 * @param key The node key with nest level (i.e. node-1).
 * @returns {string} The schema key (i.e. node).
 */
function getSchemaKey(key) {
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
    toCamel(name);
    return capitalize(name);
}

module.exports = {
    capitalize,
    singularize,
    snakeToCamel,
    dashToCamel,
    getSchemaKey,
    getParentRef,
    getTypeName,
    toCamel
};