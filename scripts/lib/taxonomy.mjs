const rules = [
  ["commonjs", /commonjs|common-js|common_js|\bcjs\b|require|module[-_.]?exports|exports[-_.]?(?:object|property|default)/i],
  ["dynamic-import", /dynamic[-_. ]?import|dynamic[-_. ]?entry|dynamic[-_. ]?chunk|split[-_. ]?chunk|lazy[-_. ]?(?:load|chunk)/i],
  ["side-effects", /side[-_. ]?effects?|module[-_. ]?side[-_. ]?effects?|effect[-_. ]?free|execution[-_. ]?order|evaluation[-_. ]?order/i],
  ["annotations", /pure[-_. ]?(?:call|comment|annotation|function)|no[-_. ]?side[-_. ]?effects?|annotation|manual[-_. ]?pure|jsx|react[-_. ]?element/i],
  ["assets", /json|css|asset|loader|base64|data[-_. ]?url|text[-_. ]?loader|file[-_. ]?loader/i],
  ["classes", /class|decorator|superclass|private[-_. ]?(?:field|property)|auto[-_. ]?accessor|using[-_. ]?declaration/i],
  ["object-paths", /object|property|properties|member[-_. ]?(?:access|expression)|getter|setter|prototype|array[-_. ]?element|destructur/i],
  ["esm", /export|re[-_. ]?export|import|namespace|barrel|live[-_. ]?binding|module[-_. ]?graph/i],
  ["functions", /function|argument|parameter|return[-_. ]?value|call[-_. ]?(?:effect|behavior)|inline|identity|iife|recursive[-_. ]?call/i],
  ["statements", /dead[-_. ]?code|\bdce\b|tree[-_. ]?shak|declar|branch|control[-_. ]?flow|switch|try|catch|label|jump|conditional|logical|binary|unary|typeof|template|statement/i],
];

export const categoryOrder = [
  "esm",
  "side-effects",
  "dynamic-import",
  "commonjs",
  "annotations",
  "classes",
  "functions",
  "object-paths",
  "statements",
  "assets",
  "configuration",
];

export function classifyCase(...parts) {
  const evidence = parts.filter(Boolean).join(" ");
  for (const [category, pattern] of rules) {
    if (pattern.test(evidence)) return category;
  }
  return "configuration";
}
