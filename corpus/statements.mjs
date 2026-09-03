import { defineCase, provenance } from "./_helpers.mjs";

export default [
  defineCase({
    id: "statements/multi-declarator",
    title: "Unused multi-declarator binding",
    category: "statements",
    description: "Removes one pure declarator without dropping its used sibling.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `const used = 19, unused = "TS_STATEMENT_MULTI_DECL_DROP_c7479f";\nexport function run() { return used; }`,
    },
    expect: { value: 19, absent: ["TS_STATEMENT_MULTI_DECL_DROP_c7479f"] },
    provenance: provenance("esbuild", "bun", "rolldown", "rollup", "turbopack"),
  }),
  defineCase({
    id: "statements/dead-if-branch",
    title: "Dead if branch",
    category: "statements",
    description: "Removes a statically unreachable branch.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `if (false) globalThis.__sink("TS_STATEMENT_DEAD_IF_DROP_829ca1");\nexport function run() { return 23; }`,
    },
    expect: { value: 23, absent: ["TS_STATEMENT_DEAD_IF_DROP_829ca1"] },
    provenance: provenance("esbuild", "bun", "rollup", "rolldown", "webpack", "rspack", "turbopack"),
  }),
  defineCase({
    id: "statements/class-static-block-pure",
    title: "Pure class static block",
    category: "statements",
    description: "Removes an unused class whose static block has no observable effect.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `class Unused { static { const value = "TS_CLASS_STATIC_PURE_DROP_f327eb"; void value; } }\nexport function run() { return 29; }`,
    },
    expect: { value: 29, absent: ["TS_CLASS_STATIC_PURE_DROP_f327eb"] },
    provenance: provenance("esbuild", "rollup", "webpack", "rspack", "rolldown"),
  }),
  defineCase({
    id: "statements/class-static-block-effect",
    title: "Effectful class static block",
    category: "statements",
    description: "Retains static initialization even when the class binding is unused.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `class Unused { static { globalThis.__TS_STATIC_EFFECT = "TS_CLASS_STATIC_EFFECT_KEEP_eb03a3"; } }\nexport function run() { return globalThis.__TS_STATIC_EFFECT; }`,
    },
    expect: {
      value: "TS_CLASS_STATIC_EFFECT_KEEP_eb03a3",
      absent: [],
      present: ["TS_CLASS_STATIC_EFFECT_KEEP_eb03a3"],
    },
    provenance: provenance("esbuild", "rollup", "webpack", "rspack"),
  }),
  defineCase({
    id: "statements/excess-pure-argument",
    title: "Excess pure argument",
    category: "statements",
    description: "Drops an unused argument whose evaluation is pure.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function first(value) { return value; }\nconst value = first(31, "TS_EXCESS_PURE_ARG_DROP_b491b3");\nexport function run() { return value; }`,
    },
    expect: { value: 31, absent: ["TS_EXCESS_PURE_ARG_DROP_b491b3"] },
    provenance: provenance("rollup", "rolldown", "webpack", "rspack"),
  }),
  defineCase({
    id: "statements/excess-effectful-argument",
    title: "Excess effectful argument",
    category: "statements",
    description: "Preserves evaluation of an unused argument when it has a side effect.",
    module: "esm",
    entry: "entry.js",
    files: {
      "entry.js": `function first(value) { return value; }\nfirst(37, (globalThis.__TS_EXTRA = "TS_EXCESS_EFFECT_ARG_KEEP_61f955"));\nexport function run() { return globalThis.__TS_EXTRA; }`,
    },
    expect: {
      value: "TS_EXCESS_EFFECT_ARG_KEEP_61f955",
      absent: [],
      present: ["TS_EXCESS_EFFECT_ARG_KEEP_61f955"],
    },
    provenance: provenance("rollup", "rolldown", "webpack", "rspack"),
  }),
];
