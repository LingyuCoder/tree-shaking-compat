import corpus from "../../corpus/index.mjs";

const idPattern = /^[a-z0-9][a-z0-9/-]*$/;
const validModules = new Set(["esm", "commonjs"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function validateCases(cases = corpus) {
  const ids = new Set();
  const markers = new Map();

  for (const item of cases) {
    assert(idPattern.test(item.id), `Invalid case id: ${item.id}`);
    assert(!ids.has(item.id), `Duplicate case id: ${item.id}`);
    ids.add(item.id);
    assert(typeof item.title === "string" && item.title, `${item.id}: missing title`);
    assert(typeof item.category === "string" && item.category, `${item.id}: missing category`);
    assert(validModules.has(item.module), `${item.id}: invalid module kind`);
    assert(
      typeof item.entry === "string" && Object.hasOwn(item.files, item.entry),
      `${item.id}: entry is missing from files`,
    );
    if (item.entries) {
      assert(Array.isArray(item.entries) && item.entries.length > 0, `${item.id}: entries must be a non-empty array`);
      for (const entry of item.entries) {
        assert(Object.hasOwn(item.files, entry), `${item.id}: missing entry file ${entry}`);
      }
    }
    assert(item.expect && Object.hasOwn(item.expect, "value"), `${item.id}: missing expected value`);
    assert(Array.isArray(item.expect.absent), `${item.id}: expect.absent must be an array`);
    assert(Array.isArray(item.provenance) && item.provenance.length > 0, `${item.id}: missing provenance`);

    for (const file of Object.keys(item.files)) {
      assert(!file.startsWith("/") && !file.split("/").includes(".."), `${item.id}: unsafe file path ${file}`);
    }
    for (const marker of [...item.expect.absent, ...(item.expect.present || [])]) {
      assert(marker.length >= (item.oracle ? 4 : 12), `${item.id}: marker is too short: ${marker}`);
      if (!item.oracle) {
        const owner = markers.get(marker);
        assert(!owner || owner === item.id, `${item.id}: marker also belongs to ${owner}: ${marker}`);
        markers.set(marker, item.id);
      }
    }
  }
  return cases;
}

export function selectCases({ ids = [], categories = [] } = {}) {
  validateCases();
  const idSet = new Set(ids);
  const categorySet = new Set(categories);
  return corpus.filter(
    (item) => (!idSet.size || idSet.has(item.id)) && (!categorySet.size || categorySet.has(item.category)),
  );
}

export default corpus;
