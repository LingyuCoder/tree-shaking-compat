import { defineCase, provenance } from "./_helpers.mjs";

export default [
  defineCase({
    id: "objects/local-unused-property",
    title: "Local object unused property",
    category: "object-paths",
    description: "Drops a pure property when only a sibling property is read.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `const object = { used: 41, unused: "TS_OBJECT_LOCAL_PROP_DROP_b02bf2" };\nexport function run() { return object.used; }`,
    },
    expect: { value: 41, absent: ["TS_OBJECT_LOCAL_PROP_DROP_b02bf2"] },
    provenance: provenance("esbuild", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "objects/function-parameter-property",
    title: "Object path through function parameter",
    category: "object-paths",
    description: "Propagates the set of read properties from a known callee back to its object argument.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function consume(object) { return object.used; }\nconst value = consume({ used: 43, unused: "TS_OBJECT_PARAM_PROP_DROP_810f23" });\nexport function run() { return value; }`,
    },
    expect: { value: 43, absent: ["TS_OBJECT_PARAM_PROP_DROP_810f23"] },
    provenance: provenance("rollup", "rolldown", "rspack"),
  }),
  defineCase({
    id: "objects/destructured-parameter-property",
    title: "Object path through destructured parameter",
    category: "object-paths",
    description: "Keeps only properties selected by a destructured function parameter.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function consume({ used }) { return used; }\nconst value = consume({ used: 47, unused: "TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42" });\nexport function run() { return value; }`,
    },
    expect: { value: 47, absent: ["TS_OBJECT_DESTRUCTURED_PROP_DROP_af4d42"] },
    provenance: provenance("rollup", "rolldown", "turbopack"),
  }),
  defineCase({
    id: "objects/nested-property-path",
    title: "Nested object property path",
    category: "object-paths",
    description: "Tracks a nested property read and removes an unused sibling path.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `const object = { nested: { used: 53, unused: "TS_OBJECT_NESTED_PROP_DROP_d7f587" } };\nexport function run() { return object.nested.used; }`,
    },
    expect: { value: 53, absent: ["TS_OBJECT_NESTED_PROP_DROP_d7f587"] },
    provenance: provenance("rollup", "rolldown"),
  }),
  defineCase({
    id: "objects/array-element-path",
    title: "Known array element path",
    category: "object-paths",
    description: "Removes an unused pure array element when only a fixed index is observed.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `const values = [59, "TS_ARRAY_ELEMENT_DROP_4a0a2d"];\nexport function run() { return values[0]; }`,
    },
    expect: { value: 59, absent: ["TS_ARRAY_ELEMENT_DROP_4a0a2d"] },
    provenance: provenance("rollup", "rolldown"),
  }),
  defineCase({
    id: "objects/getter-effect",
    title: "Getter read side effect",
    category: "object-paths",
    description: "Preserves a getter invocation while allowing an unrelated pure property to disappear.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `let reads = 0;\nconst object = { get used() { reads++; return 61; }, unused: "TS_OBJECT_GETTER_UNUSED_DROP_912f8c" };\nconst value = object.used;\nexport function run() { return [value, reads]; }`,
    },
    expect: { value: [61, 1], absent: ["TS_OBJECT_GETTER_UNUSED_DROP_912f8c"] },
    provenance: provenance("esbuild", "parcel", "rollup", "rolldown", "webpack"),
  }),
  defineCase({
    id: "objects/unknown-escape-bailout",
    title: "Object escape bailout",
    category: "object-paths",
    description: "Retains all properties once an object escapes to an unknown consumer.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `globalThis.__TS_READ_UNKNOWN = object => object.unused;\nconst object = { used: 1, unused: "TS_OBJECT_ESCAPE_KEEP_02a30d" };\nconst value = globalThis.__TS_READ_UNKNOWN(object);\nexport function run() { return value; }`,
    },
    expect: {
      value: "TS_OBJECT_ESCAPE_KEEP_02a30d",
      absent: [],
      present: ["TS_OBJECT_ESCAPE_KEEP_02a30d"],
    },
    provenance: provenance("rollup", "rolldown", "webpack", "rspack"),
  }),
];
