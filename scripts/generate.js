const { readFileSync, writeFileSync, rmSync, mkdirSync } = require('fs');
const generateMetadata = require('../src/generate-metadata');
const generateJavaModels = require('../src/generate-java-models');
const generateTypescriptModels = require('../src/generate-typescript-models');
const { capitalize } = require('../src/utils');
const getOptions = require('../src/options');
const {info, error} = require('../src/log');

const CLASS_REGEX = /public\s+class\s+([A-Za-z_]\w*)/;
const INTERFACE_REGEX = /interface\s+([A-Za-z_]\w*)/;

function stageOutput() {
    rmSync('output', { recursive: true, force: true });
    mkdirSync('output');
}

function execute() {
    const options =  getOptions();
    const type = options['type'] ?? 'invalid';
    const rootName = capitalize(options['rootName']);
    const input = readFileSync('input.txt', 'utf-8');
    info('Generating metadata from input');
    const metadata = generateMetadata(JSON.parse(input));
    switch (type.toLowerCase()) {
        case 'java':
            stageOutput();
            const classes = generateJavaModels(metadata, rootName);
            for (const result of classes) {
                const className = result.match(CLASS_REGEX)[0].split(/\s/)[2];
                info(`Generating output/${className}.java`);
                writeFileSync(`output/${className}.java`, result);
            }
            break;
        case 'typescript':
            stageOutput();
            const interfaces = generateTypescriptModels(metadata, rootName);
            for (const result of interfaces) {
                const interfaceName = result.match(INTERFACE_REGEX)[0].split(/\s/)[1];
                info(`Generating output/${interfaceName}.ts`);
                writeFileSync(`output/${interfaceName}.ts`, result);
            }
            break;
        default:
            error(`Invalid type: '${type}'`);
    }
}

if (require.main === module) {
    execute();
}

module.exports = execute;