// Generate Java classes recursively from metadata
function generateJavaModels(metadata, rootName = "Root") {
    if (metadata.type !== 'object') throw new Error('Root must be an object');

    const classes = new Map();

    function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    function singularize(name) {
        if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
        if (name.endsWith('s')) return name.slice(0, -1);
        return name;
    }

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
            lines.push(`    private ${toJavaType(val, key)} ${key};`);
        }
        lines.push('');

        // Getters and setters
        for (const [key, val] of Object.entries(meta.properties)) {
            const type = toJavaType(val, key);
            const capKey = capitalize(key);

            lines.push(`    public ${type} get${capKey}() {`);
            lines.push(`        return ${key};`);
            lines.push('    }');
            lines.push('');

            lines.push(`    public void set${capKey}(${type} ${key}) {`);
            lines.push(`        this.${key} = ${key};`);
            lines.push('    }');
            lines.push('');
        }

        lines.push('}');
        classes.set(className, lines.join('\n'));
    }

    addClass(capitalize(rootName), metadata);

    return Array.from(classes.values());
}

module.exports = generateJavaModels;