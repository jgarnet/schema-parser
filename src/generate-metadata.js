const {snakeToCamel} = require("./utils");
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
    return analyze(data);
}

module.exports = analyzeJsonStructure;