const { readFileSync, writeFileSync, rmSync, mkdirSync } = require('fs');
const generateMetadata = require('../src/generate-metadata');
const generateJavaModels = require('../src/generate-java-models');
const generateTypescriptModels = require('../src/generate-typescript-models');

const CLASS_REGEX = /public\s+class\s+([A-Za-z_]\w*)/;
const INTERFACE_REGEX = /interface\s+([A-Za-z_]\w*)/;

function stageOutput() {
    rmSync('output', { recursive: true, force: true });
    mkdirSync('output');
}

function execute() {
    const type = process.argv[2] ?? 'invalid';
    const rootName = process.argv[3];
    const input = readFileSync('input.txt', 'utf-8');
    const metadata = generateMetadata(JSON.parse(input));
    switch (type.toLowerCase()) {
        case 'java':
            stageOutput();
            const classes = generateJavaModels(metadata, rootName);
            for (const result of classes) {
                const className = result.match(CLASS_REGEX)[0].split(/\s/)[2];
                writeFileSync(`output/${className}.java`, result);
            }
            break;
        case 'typescript':
            stageOutput();
            const interfaces = generateTypescriptModels(metadata, rootName);
            for (const result of interfaces) {
                const interfaceName = result.match(INTERFACE_REGEX)[0].split(/\s/)[1];
                writeFileSync(`output/${interfaceName}.ts`, result);
            }
            break;
        default:
            console.error(`Invalid type: '${type}'`);
    }
}

if (require.main === module) {
    execute();
}

module.exports = execute;