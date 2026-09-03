import fs from "node:fs/promises";
import path from "node:path";

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

export async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

export async function listFiles(root, predicate = () => true) {
  const found = [];

  async function visit(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile() && predicate(absolute)) {
        found.push(absolute);
      }
    }
  }

  if (await exists(root)) await visit(root);
  return found.sort();
}
