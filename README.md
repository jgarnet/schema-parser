# schema-parser

## Overview

Parses the contents of a target input (i.e. JSON payload) and produces models based on the schema.

## Usage

Write the contents of the target schema into `input.txt`, then run the `generate` command:

Each identified model will be written to its own file in the `output` directory.

### Options

All options may be specified via `.env` if desired. See [.env.example](.env.example) for reference.

#### --type

**Default**: `java`

The type of output models to generate.

```shell
yarn generate --type java
```

The supported output types are:
- java
- typescript

#### --rootName

**Default**: `Root`

Optional root model name which will be used to name the root model:

```shell
yarn generate --type java --root-name MyClass
```
If omitted, the root model name will default to `Root`.

#### --serializer

**Default**: `jackson`

If using `java` type, specifies how to serialize non camel-case fields.

```shell
yarn generate --type java --serializer jackson
```

The supported serializers are:
- jackson
- gson
- jakarta

#### --disable-reduce

**Default**: `false`

Disables model reduction step, which is responsible for de-duplicating common object structures.

```shell
yarn generate --type java --disable-reduce
```

By default, common structures are identified and re-used in the generated models. When multiple objects are identified as using the same structure, the deepest nested / later object in the schema is favored.

For example:

```typescript
const input = {
    "foo": {
        "name": "Jane"
    },
    "bar": {
        "name": "John"
    }
};

// produces model:

interface Root {
    foo: Bar;
    bar: Bar;
}

interface Bar {
    name: string;
}
```

With reduction disabled, each object gets its own type, regardless if it shares the same type structure as other objects:

```typescript
const input = {
    "foo": {
        "name": "Jane"
    },
    "bar": {
        "name": "John"
    }
};

// produces model:

interface Root {
    foo: Foo;
    bar: Bar;
}

interface Foo {
    name: string;
}

interface Bar {
    name: string;
}
```

#### --log

**Default**: `false`

Enables console logging for debugging purposes.

```shell
yarn generate --log
```