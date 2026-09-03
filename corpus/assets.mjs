import { defineCase, provenance } from "./_helpers.mjs";

export default [
  defineCase({
    id: "assets/json-unused-key",
    title: "Unused JSON key",
    category: "assets",
    description: "Retains the selected JSON property and removes an unused pure sibling value.",
    features: ["json"],
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `import data from "./data.json";\nexport function run() { return data.used; }`,
      "data.json": `{"used":103,"unused":"TS_JSON_UNUSED_KEY_DROP_9efcdd"}`,
    },
    expect: { value: 103, absent: ["TS_JSON_UNUSED_KEY_DROP_9efcdd"] },
    provenance: provenance("esbuild", "bun", "parcel", "turbopack", "rollup", "rolldown", "webpack", "rspack"),
  }),
];
