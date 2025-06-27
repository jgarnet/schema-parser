const { singularize, getSchemaKey, getParentRef, getTypeName } = require('./utils');

const SERIALIZERS = {
    'jackson': {
        annotation: key => `@JsonProperty("${key}")`,
        importLine: 'import com.fasterxml.jackson.annotation.JsonProperty;'
    },
    'gson': {
        annotation: key => `@SerializedName("${key}")`,
        importLine: 'import com.google.gson.annotations.SerializedName;'
    },
    'jakarta': {
        annotation: key => `@JsonbProperty("${key}")`,
        importLine: 'import jakarta.json.bind.annotation.JsonbProperty;'
    }
};

/**
 * Generate Java classes recursively from metadata
 * @param metadata Contains the object schema parsed from the input file.
 * @param rootName The name of the root element in the schema.
 * @param options Configuration options.
 * @returns {any[]} Array of Java class definitions.
 */
function generateJavaModels(metadata, rootName = "Root",  options) {
    const { schema, refs } = metadata;
    if (schema.type !== 'object') throw new Error('Root must be an object');

    const serializer = options['serializer']?.toLowerCase();
    if (serializer && !SERIALIZERS[serializer]) {
        console.warn(`Unsupported serializer ${serializer}`);
    }
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
                        if (meta.ref) {
                            const ref = getParentRef(refs, meta.ref) ?? meta.ref;
                            return `List<${getTypeName(getSchemaKey(ref))}>`;
                        }
                        const typeName = getTypeName(singularize(propName));
                        addClass(typeName, meta.elementType);
                        return `List<${typeName}>`;
                    } else {
                        return `List<${toJavaType(meta.elementType, propName)}>`;
                    }
                }
            case 'object':
                if (meta.ref) {
                    const ref = getParentRef(refs, meta.ref) ?? meta.ref;
                    return getTypeName(getSchemaKey(ref));
                }
                const typeName = getTypeName(propName);
                addClass(typeName, meta);
                return typeName;
            default:
                return 'Object';
        }
    }

    function addClass(className, meta) {
        if (classes.has(className)) return;
        if (meta.type !== 'object') throw new Error('Class must be an object');
        if (meta.ref) {
            return;
        }

        const lines = [];
        lines.push(`public class ${className} {`);

        // Fields
        for (const [key, val] of Object.entries(meta.properties)) {
            if (SERIALIZERS[serializer] && key !== val.key) {
                const { annotation } = SERIALIZERS[serializer];
                lines.push(`\t${annotation(val.key)}`);
            }
            lines.push(`\tprivate ${toJavaType(val, key)} ${key};`);
        }

        // Getters and setters
        for (const [key, val] of Object.entries(meta.properties)) {
            const type = toJavaType(val, key);
            const capKey = getTypeName(key);

            lines.push('');
            lines.push(`\tpublic ${type} get${capKey}() {`);
            lines.push(`\t\treturn ${key};`);
            lines.push('\t}');

            lines.push('');
            lines.push(`\tpublic void set${capKey}(${type} ${key}) {`);
            lines.push(`\t\tthis.${key} = ${key};`);
            lines.push('\t}');
        }

        lines.push('}');
        classes.set(className, lines.join('\n'));
    }

    addClass(getTypeName(rootName), schema);

    return Array.from(classes.values());
}

module.exports = generateJavaModels;