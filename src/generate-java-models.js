const { singularize, getSchemaKey, getParentRef, getTypeName } = require('./utils');
const getOptions = require('./options');
const {warn, info} = require('./log');

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
 * @returns {any[]} Array of Java class definitions.
 */
function generateJavaModels(metadata, rootName = "Root") {
    const options = getOptions();
    const { schema, refs } = metadata;
    if (schema.type !== 'object') throw new Error('Root must be an object');

    const serializer = options['serializer']?.toLowerCase();
    if (serializer && !SERIALIZERS[serializer]) {
        warn(`Unsupported serializer ${serializer}`);
    }
    const classes = new Map();
    const imports = new Map();

    function addImport(className, importLine) {
        if (!imports.has(className)) {
            imports.set(className, new Set());
        }
        imports.get(className).add(importLine);
    }

    function addClass(className, meta) {
        if (classes.has(className)) return;
        if (meta.type !== 'object') throw new Error('Class must be an object');
        if (meta.ref) {
            return;
        }
        info(`Adding class ${className}`);

        const lines = [];
        lines.push(`public class ${className} {`);

        function toJavaType(meta, propName) {
            switch (meta.type) {
                case 'string': return 'String';
                case 'decimal': return 'Double';
                case 'integer': return 'Integer';
                case 'date':
                    addImport(className, 'import java.util.Date;');
                    return 'Date';
                case 'boolean': return 'Boolean';
                case 'null': return 'Object';
                case 'any': return 'Object';
                case 'array':
                    addImport(className, 'import java.util.List;');
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

        // Fields
        for (const [key, val] of Object.entries(meta.properties)) {
            if (SERIALIZERS[serializer] && key !== val.key) {
                const { annotation, importLine } = SERIALIZERS[serializer];
                lines.push(`\t${annotation(val.key)}`);
                addImport(className, importLine);
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

        // import lines

        if (imports.has(className)) {
            const importLines = imports.get(className);
            // whitespace before class declaration
            lines.unshift('');
            // reverse sort order of import lines so unshift orders alphabetically sorted
            for (const importLine of [...importLines].sort((a, b) => b.localeCompare(a))) {
                lines.unshift(importLine);
            }
        }

        // package

        if (options['package']) {
            lines.unshift('');
            lines.unshift(`package ${options['package']};`);
        }

        classes.set(className, lines.join('\n'));
    }

    addClass(getTypeName(rootName), schema);

    return Array.from(classes.values());
}

module.exports = generateJavaModels;