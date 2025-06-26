const { singularize, getParentRef, getNodeKey, getTypeName} = require('./utils');

function generateTypeScriptModels(metadata, rootName = "Root") {
    const { schema, refs } = metadata;
    const models = new Map();

    function renderType(meta, propName) {
        switch (meta.type) {
            case 'string':
            case 'boolean':
            case 'null':
                return meta.type === 'null' ? 'null' : meta.type;
            case 'decimal':
            case 'integer':
                return 'number';
            case 'date':
                return 'Date';
            case 'array':
                if (Array.isArray(meta.elementType)) {
                    const unionTypes = meta.elementType.map(et => renderType(et, propName)).join(' | ');
                    return `Array<${unionTypes}>`;
                } else {
                    if (meta.elementType.type === 'object') {
                        if (meta.ref) {
                            const ref = getParentRef(refs, meta.ref) ?? meta.ref;
                            return `Array<${getTypeName(getNodeKey(ref))}>`;
                        }
                        const typeName = getTypeName(singularize(propName));
                        addModel(typeName, meta.elementType);
                        return `Array<${typeName}>`;
                    } else {
                        return `Array<${renderType(meta.elementType, propName)}>`;
                    }
                }
            case 'object':
                if (meta.ref) {
                    const ref = getParentRef(refs, meta.ref) ?? meta.ref;
                    return getTypeName(getNodeKey(ref));
                }
                const typeName = getTypeName(propName);
                addModel(typeName, meta);
                return typeName;
            default:
                return 'any';
        }
    }

    function addModel(name, meta) {
        if (models.has(name)) return;
        if (meta.type !== 'object') return;
        if (meta.ref) return;
        models.set(name, meta);
        for (const [key, val] of Object.entries(meta.properties)) {
            if (val.type === 'object') {
                addModel(getTypeName(key), val);
            } else if (val.type === 'array' && val.elementType.type === 'object') {
                addModel(getTypeName(singularize(key)), val.elementType);
            }
        }
    }

    addModel(rootName, schema);

    const rendered = [];
    for (const [name, meta] of models) {
        const lines = [`interface ${name} {`];
        for (const [key, val] of Object.entries(meta.properties)) {
            lines.push(`\t${key}: ${renderType(val, key)};`);
        }
        lines.push('}');
        rendered.push(lines.join('\n'));
    }

    return rendered;
}

module.exports = generateTypeScriptModels;