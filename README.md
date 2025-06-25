# schema-parser

## Overview

Parses the contents of a target input (i.e. JSON payload) and produces models based on the schema.

## Usage

Write the contents of the target schema into `input.txt`, then run the `generate` command:

```shell
yarn generate $outputType
```

The supported output types are:
- java
- typescript

`generate` takes an optional root class option which will be used to name the root model:

```shell
yarn generate java MyClass
```
If omitted, the root model name will default to `Root`.

Each identified model will be written to its own file in the `output` directory.