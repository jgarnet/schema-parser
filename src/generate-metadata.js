const {singularize, getSchemaKey, getParentRef, toCamel} = require('./utils');
const {DateTime} = require('luxon');
const {info} = require('./log');
const DECIMAL_REGEX = /^-?\d+(\.\d+)$/;

function isDate(value) {
    const dt = DateTime.fromISO(value);
    return dt.isValid;
}

function equalsSet(a, b) {
    if (!a || !b) return false;
    if (a.size !== b.size) return false;
    for (let item of a) {
        if (!b.has(item)) {
            return false;
        }
    }
    return true;
}

/**
 * Serializes type signature. Used to identify common type structures to reduce model footprint.
 * @param node The target node.
 * @param key The key of the property being checked.
 * @returns {string} The type signature.
 */
function serializeType(node, key) {

    function serializeObject(object) {
        let result = '{';
        const subProps = [];
        for (const subProp of Object.keys(object.properties).sort()) {
            subProps.push(serializeType(object, subProp));
        }
        result += subProps.join(',');
        result += '}';
        return result;
    }

    function serializeArray(array) {
        let result = '[';
        const types = Array.isArray(array.elementType) ? array.elementType : [array.elementType];
        const subTypes = [];
        for (const type of types.sort()) {
            if (type.type === 'object') {
                subTypes.push(serializeObject(type));
            } else if (type.type === 'array') {
                subTypes.push(serializeArray(type));
            } else {
                subTypes.push(type.type);
            }
        }
        result += subTypes.join(',');
        result += ']';
        return result;
    }

    const prop = node.properties[key];
    let signature = `${key}:`;
    if (prop.type === 'object') {
        signature += serializeObject(prop);
    } else if (prop.type === 'array') {
        signature += serializeArray(prop);
    } else {
        signature += prop.type;
    }
    return signature;
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
        // todo: determine how to detect map / dictionary vs actual object
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

    info('Analyzing schema');
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
                // const props = propKeys.map(key => `${key}:${node.properties[key].type}`);
                const props = propKeys.map(key => serializeType(node, key));
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
                    if (k !== node.key && equalsSet(props, v)) {
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
                    if (k !== nodeKey && equalsSet(props, v)) {
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
        info('Reducing common schema types');
        reduce(schema);
    }
    return { schema, refs };
}

module.exports = generateMetadata;