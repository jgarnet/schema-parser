const { capitalize, singularize } = require('./utils');

/**
 * Generate Java classes recursively from metadata
 * @param metadata Contains the object schema parsed from the input file.
 * @param rootName The name of the root element in the schema.
 * @returns {any[]} Array of Java class definitions.
 */
function generateJavaModels(metadata, rootName = "Root") {
    if (metadata.type !== 'object') throw new Error('Root must be an object');

    const classes = new Map();

    function toJavaType(meta, propName) {
        switch (meta.type) {
            case 'string': return 'String';
            case 'decimal': return 'Double';
            case 'integer': return 'Integer';
            case 'date': return 'Date';
            case 'boolean': return 'Boolean';
            case 'null': return 'Object';
            case 'any': return 'Object';
            case 'array':
                if (Array.isArray(meta.elementType)) {
                    // heterogeneous array: fallback to Object
                    return 'List<Object>';
                } else {
                    if (meta.elementType.type === 'object') {
                        const typeName = capitalize(singularize(propName));
                        addClass(typeName, meta.elementType);
                        return `List<${typeName}>`;
                    } else {
                        return `List<${toJavaType(meta.elementType, propName)}>`;
                    }
                }
            case 'object':
                const typeName = capitalize(propName);
                addClass(typeName, meta);
                return typeName;
            default:
                return 'Object';
        }
    }

    function addClass(className, meta) {
        if (classes.has(className)) return;
        if (meta.type !== 'object') throw new Error('Class must be an object');

        const lines = [];
        lines.push(`public class ${className} {`);

        // Fields
        for (const [key, val] of Object.entries(meta.properties)) {
            // todo: account for serialization annotations
            lines.push(`\tprivate ${toJavaType(val, key)} ${key};`);
        }
        lines.push('');

        // Getters and setters
        for (const [key, val] of Object.entries(meta.properties)) {
            const type = toJavaType(val, key);
            const capKey = capitalize(key);

            lines.push(`\tpublic ${type} get${capKey}() {`);
            lines.push(`\t\treturn ${key};`);
            lines.push('\t}');
            lines.push('');

            lines.push(`\tpublic void set${capKey}(${type} ${key}) {`);
            lines.push(`\t\tthis.${key} = ${key};`);
            lines.push('\t}');
            lines.push('');
        }

        lines.push('}');
        classes.set(className, lines.join('\n'));
    }

    addClass(capitalize(rootName), metadata);

    return Array.from(classes.values());
}

module.exports = generateJavaModels;