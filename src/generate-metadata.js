const {snakeToCamel, singularize} = require("./utils");
const DECIMAL_REGEX = /^-?\d+(\.\d+)$/;

function isDate(value) {
    const date = new Date(value);
    return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Analyze JSON structure recursively to create metadata describing types
 * @param data JSON input.
 * @returns object schema metadata.
 */
function analyzeJsonStructure(data) {
    function analyze(value) {
        if (value === null) return { type: 'null' };
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return { type: 'array', elementType: { type: 'any' } };
            }
            // Analyze element types
            const elementTypes = [...new Set(value.map(v => JSON.stringify(analyze(v))))];
            const elementTypeObjs = elementTypes.map(str => JSON.parse(str));
            if (elementTypeObjs.length === 1) {
                return { type: 'array', elementType: elementTypeObjs[0] };
            } else {
                return { type: 'array', elementType: elementTypeObjs };
            }
        }
        if (typeof value === 'object') {
            const props = {};
            for (const key in value) {
                props[snakeToCamel(key)] = {
                    key,
                    ...analyze(value[key])
                };
            }
            return { type: 'object', properties: props };
        }
        if (typeof value === 'number') {
            return { type: DECIMAL_REGEX.test(`${value}`) ? 'decimal' : 'integer' };
        }
        if (isDate(value)) {
            return { type: 'date' };
        }
        return { type: typeof value };
    }
    const metadata = analyze(data);
    metadata.key = 'root';
    const seen = new Map();

    function isSubset(a, b) {
        for (let item of a) {
            if (!b.has(item)) {
                return false;
            }
        }
        return true;
    }

    function walk(node, key = undefined) {
        if (node.type === 'object') {
            const propKeys = Object.keys(node.properties);
            const props = propKeys.map(key => `${key}:${node.properties[key].type}`);
            seen.set(key ?? node.key, new Set(props));
            for (const key of propKeys) {
                walk(node.properties[key]);
            }
        } else if (node.type === 'array') {
            walk(node.elementType, singularize(node.key));
        }
    }
    walk(metadata);
    // todo: associate node key to object field id for reference when building models
    // todo: determine how to parse refs when building models

    function reduce(node) {
        if (node.type === 'object') {
            const props = seen.get(node.key);
            for (const [k, v] of seen.entries()) {
                if (k !== node.key && isSubset(props, v)) {
                    delete node.properties;
                    node.ref = k;
                    seen.delete(node.key);
                    break;
                }
            }
            for (const prop of Object.keys(node.properties ?? {})) {
                reduce(node.properties[prop]);
            }
        } else if (node.type === 'array') {
            const key = singularize(node.key);
            const props = seen.get(key);
            for (const [k, v] of seen.entries()) {
                if (k !== key && isSubset(props, v)) {
                    delete node.elementType;
                    node.ref = k;
                    seen.delete(key);
                    break;
                }
            }
            for (const prop of Object.keys(node.elementType?.properties ?? {})) {
                reduce(node.elementType.properties[prop]);
            }
        }
    }
    reduce(metadata);
    return metadata;
}

module.exports = analyzeJsonStructure;