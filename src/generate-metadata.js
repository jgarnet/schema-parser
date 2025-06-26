const {snakeToCamel, singularize, getNodeKey, getParentRef} = require("./utils");
const DECIMAL_REGEX = /^-?\d+(\.\d+)$/;

function isDate(value) {
    // todo: fix this, as boolean and some integers are being considered date values
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
    const schema = analyze(data);
    schema.key = 'root';
    const seen = new Map();
    const refs = new Map();

    function isSubset(a, b) {
        if (!a || !b) return false;
        for (let item of a) {
            if (!b.has(item)) {
                return false;
            }
        }
        return true;
    }

    function walk(node, nestLevel = 0, key = undefined) {
        if (node.type === 'object') {
            node.nestLevel = nestLevel;
            const propKeys = Object.keys(node.properties);
            const props = propKeys.map(key => `${key}:${node.properties[key].type}`);
            seen.set(`${key ?? node.key}-${nestLevel}`, new Set(props));
            for (const key of propKeys) {
                walk(node.properties[key], nestLevel + 1);
            }
        } else if (node.type === 'array') {
            walk(node.elementType, nestLevel + 1, singularize(node.key));
        }
    }
    walk(schema);

    function getKey(node) {
        return `${node.key}-${node.nestLevel}`;
    }

    // todo: cleanup logic
    function reduce(node) {
        if (node.type === 'object') {
            const nodeKey = getKey(node);
            const props = seen.get(nodeKey);
            for (const [_k, v] of seen.entries()) {
                const k = getNodeKey(_k);
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
                const k = getNodeKey(_k);
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
    return { schema, refs };
}

module.exports = analyzeJsonStructure;