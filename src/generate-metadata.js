const {singularize, getSchemaKey, getParentRef, toCamel} = require('./utils');
const {DateTime} = require('luxon');
const DECIMAL_REGEX = /^-?\d+(\.\d+)$/;

function isDate(value) {
    const dt = DateTime.fromISO(value);
    return dt.isValid;
}

// todo: explore considering node keys in the case of recursive self-references (i.e. remove node key from consideration during evaluation)
function isSubset(a, b) {
    if (!a || !b) return false;
    for (let item of a) {
        if (!b.has(item)) {
            return false;
        }
    }
    return true;
}

/**
 * Generates a unique node key using the node name and nest level.
 * @param node The node.
 * @returns {string} The unique node key.
 */
function getKey(node) {
    return `${node.key}-${node.nestLevel}`;
}

/**
 * Analyze JSON structure recursively to create metadata describing types
 * @param data JSON input.
 * @param options Configuration options.
 * @returns object schema metadata.
 */
function generateMetadata(data, options = {}) {
    /**
     * Recursively builds object schema.
     * @param value Object being evaluated.
     * @returns object schema.
     */
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
                props[toCamel(key)] = {
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

    const schema = analyze(data);
    schema.key = 'root';
    const seen = new Map(); // keep track of common object structures
    const refs = new Map(); // keep track of repeated type references

    if (options['disableReduce'] !== true) {
        /**
         * Walks through schema tree and records all object structures.
         * @param node The node being marked.
         * @param nestLevel The nest level of the current node.
         * @param key The node's key (i.e. original field name in JSON structure).
         */
        function markSeen(node, nestLevel = 0, key = undefined) {
            if (node.type === 'object') {
                node.nestLevel = nestLevel;
                const propKeys = Object.keys(node.properties);
                const props = propKeys.map(key => `${key}:${node.properties[key].type}`);
                seen.set(`${key ?? node.key}-${nestLevel}`, new Set(props));
                for (const key of propKeys) {
                    markSeen(node.properties[key], nestLevel + 1);
                }
            } else if (node.type === 'array') {
                markSeen(node.elementType, nestLevel + 1, singularize(node.key));
            }
        }
        markSeen(schema);

        /**
         * Identifies re-usable object structures and replaces repetitions with references to reduce model footprint.
         * When repetitions are found, the deepest nested structure / key is favored.
         * @param node The node being reduced.
         */
        function reduce(node) {
            if (node.type === 'object') {
                const nodeKey = getKey(node);
                const props = seen.get(nodeKey);
                for (const [_k, v] of seen.entries()) {
                    const k = getSchemaKey(_k);
                    if (k !== node.key && isSubset(props, v)) {
                        delete node.properties;
                        const targetRef = getParentRef(refs, _k) ?? _k;
                        node.ref = targetRef;
                        refs.set(nodeKey, targetRef);
                        seen.delete(nodeKey);
                        break;
                    }
                }
                for (const prop of Object.keys(node.properties ?? {})) {
                    reduce(node.properties[prop]);
                }
            } else if (node.type === 'array') {
                const nodeKey = singularize(node.key);
                const key = `${nodeKey}-${node.nestLevel}`;
                const props = seen.get(key);
                for (const [_k, v] of seen.entries()) {
                    const k = getSchemaKey(_k);
                    if (k !== nodeKey && isSubset(props, v)) {
                        delete node.elementType;
                        const targetRef = getParentRef(refs, _k) ?? _k;
                        node.ref = targetRef;
                        refs.set(nodeKey, targetRef);
                        seen.delete(key);
                        break;
                    }
                }
                for (const prop of Object.keys(node.elementType?.properties ?? {})) {
                    reduce(node.elementType.properties[prop]);
                }
            }
        }
        reduce(schema);
    }
    return { schema, refs };
}

module.exports = generateMetadata;