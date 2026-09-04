import fs from "node:fs/promises";
import path from "node:path";

function loaderEntries(item) {
  return Object.entries(item.buildOptions?.loader || {});
}

export function assetModulePlugin(item, name) {
  const loaders = new Map(loaderEntries(item));
  return {
    name,
    async load(id) {
      const clean = id.split("?", 1)[0];
      const kind = loaders.get(path.extname(clean));
      if (!kind) return null;
      const contents = await fs.readFile(clean);
      let value;
      if (kind === "base64") value = contents.toString("base64");
      else if (kind === "dataurl") value = `data:application/octet-stream;base64,${contents.toString("base64")}`;
      else if (kind === "file") value = path.basename(clean);
      else value = contents.toString("utf8");
      return { code: `export default ${JSON.stringify(value)};`, moduleSideEffects: false };
    },
  };
}

export function webpackAssetRules(item) {
  return loaderEntries(item).map(([extension, kind]) => ({
    test: new RegExp(`${extension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`),
    type: kind === "file" ? "asset/resource" : kind === "dataurl" || kind === "base64" ? "asset/inline" : "asset/source",
    ...(kind === "dataurl" || kind === "base64"
      ? { generator: { dataUrl: { encoding: "base64", mimetype: "application/octet-stream" } } }
      : {}),
  }));
}
