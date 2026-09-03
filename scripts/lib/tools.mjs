import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { toolchainModules } from "./paths.mjs";

const toolRequire = createRequire(path.join(toolchainModules, "__resolver.cjs"));

export function resolveTool(specifier) {
  return toolRequire.resolve(specifier);
}

export function requireTool(specifier) {
  return toolRequire(specifier);
}

export async function importTool(specifier) {
  return import(pathToFileURL(resolveTool(specifier)).href);
}

export async function readToolVersion(specifier) {
  let current = resolveTool(specifier);
  while (current !== path.dirname(current)) {
    current = path.dirname(current);
    const candidate = path.join(current, "package.json");
    try {
      const manifest = JSON.parse(await fs.readFile(candidate, "utf8"));
      if (manifest.name === specifier || specifier.startsWith(`${manifest.name}/`)) {
        return manifest.version;
      }
    } catch {
      // Continue towards the package root.
    }
  }
  return null;
}
