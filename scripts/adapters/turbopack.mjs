import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { listFiles } from "../lib/io.mjs";
import { runsRoot, toolchainModules } from "../lib/paths.mjs";
import { compactError, runCommand } from "../lib/process.mjs";
import { resolveTool } from "../lib/tools.mjs";

function slug(value) {
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function writeFixture(projectRoot, item) {
  const caseSlug = slug(item.id);
  const fixtureDir = path.join(projectRoot, "fixtures", caseSlug);
  await fs.mkdir(fixtureDir, { recursive: true });
  for (const [relative, contents] of Object.entries(item.files)) {
    const destination = path.join(fixtureDir, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, contents.endsWith("\n") ? contents : `${contents}\n`);
  }
  try {
    await fs.access(path.join(fixtureDir, "package.json"));
  } catch {
    await fs.writeFile(path.join(fixtureDir, "package.json"), '{"private":true,"type":"module"}\n');
  }

  const routeDir = path.join(projectRoot, "app", "api", caseSlug);
  await fs.mkdir(routeDir, { recursive: true });
  const specifier = `../../../fixtures/${caseSlug}/${item.entry}`;
  const importLine =
    item.module === "commonjs"
      ? `import fixtureModule from ${JSON.stringify(specifier)};\nconst fixtureRun = fixtureModule.run;`
      : `import { run as fixtureRun } from ${JSON.stringify(specifier)};`;
  await fs.writeFile(
    path.join(routeDir, "route.js"),
    `${importLine}\nexport const dynamic = "force-dynamic";\nexport async function GET() {\n  try {\n    return Response.json({ ok: true, value: await fixtureRun() });\n  } catch (error) {\n    return Response.json({ ok: false, error: error?.stack || String(error) }, { status: 500 });\n  }\n}\n`,
  );
  return caseSlug;
}

async function waitUntilReady(child, port, output) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start exited early\n${output()}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {
      // Server socket is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next start was not ready after 60s\n${output()}`);
}

async function runProject(projectRoot, nextBin, caseSlugs) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: projectRoot,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1", NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const output = () => `${stdout}\n${stderr}`.slice(-20_000);
  try {
    await waitUntilReady(child, port, output);
    const values = new Map();
    for (const [id, caseSlug] of caseSlugs) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/api/${caseSlug}`, {
          headers: { "x-tree-shaking-case": id },
        });
        const payload = await response.json();
        values.set(id, {
          ok: response.ok && payload.ok,
          actual: payload.value,
          error: payload.error || (response.ok ? null : `HTTP ${response.status}`),
          stdout: "",
          stderr: "",
        });
      } catch (error) {
        values.set(id, { ok: false, actual: null, error: compactError(error), stdout: "", stderr: output() });
      }
    }
    return values;
  } finally {
    child.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        resolve();
      }, 5_000);
      child.once("close", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

async function executeChunk(items, chunkIndex) {
  const startedAt = Date.now();
  const projectRoot = path.join(runsRoot, "turbopack", "production", `batch-${chunkIndex}`);
  await fs.rm(projectRoot, { recursive: true, force: true });
  await fs.mkdir(path.join(projectRoot, "app"), { recursive: true });
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    '{"name":"tree-shaking-turbopack-fixtures","private":true,"type":"module","scripts":{"build":"next build --turbopack"}}\n',
  );
  await fs.writeFile(path.join(projectRoot, "next.config.mjs"), "export default { output: \"standalone\" };\n");
  await fs.writeFile(
    path.join(projectRoot, "app", "layout.js"),
    "export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n",
  );
  await fs.writeFile(path.join(projectRoot, "app", "page.js"), "export default function Page() { return null; }\n");
  await fs.symlink(toolchainModules, path.join(projectRoot, "node_modules"), "dir");

  const caseSlugs = new Map();
  for (const item of items) caseSlugs.set(item.id, await writeFixture(projectRoot, item));
  const nextBin = resolveTool("next/dist/bin/next");
  const build = await runCommand(process.execPath, [nextBin, "build", "--turbopack"], {
    cwd: projectRoot,
    env: { NEXT_TELEMETRY_DISABLED: "1", CI: "1", NODE_ENV: "production" },
    timeoutMs: 20 * 60 * 1000,
  });
  if (!build.ok) throw new Error(build.error || build.stderr || build.stdout || "next build failed");
  const outputFiles = await listFiles(path.join(projectRoot, ".next", "server"), (file) => /\.(?:[cm]?js)$/.test(file));
  const code = (await Promise.all(outputFiles.map((file) => fs.readFile(file, "utf8")))).join("\n");
  const runtimeValues = await runProject(projectRoot, nextBin, caseSlugs);
  const relativeFiles = outputFiles.map((file) => path.relative(projectRoot, file)).slice(0, 80);
  return new Map(
    items.map((item) => [
      item.id,
      {
        build: { ok: true, durationMs: Date.now() - startedAt, error: null },
        runtime: runtimeValues.get(item.id),
        code,
        files: relativeFiles,
        warnings: build.stderr ? [build.stderr.trim()] : [],
        note: "Turbopack is measured through the latest stable Next.js production pipeline; a standalone graph profile is not public.",
      },
    ]),
  );
}

async function executeWithFallback(items, chunkIndex) {
  try {
    return await executeChunk(items, chunkIndex);
  } catch (error) {
    if (items.length === 1) {
      return new Map([
        [
          items[0].id,
          {
            build: { ok: false, durationMs: 0, error: compactError(error) },
            runtime: null,
            code: "",
            files: [],
            warnings: [],
          },
        ],
      ]);
    }
    const middle = Math.ceil(items.length / 2);
    const [left, right] = await Promise.all([
      executeWithFallback(items.slice(0, middle), `${chunkIndex}a`),
      executeWithFallback(items.slice(middle), `${chunkIndex}b`),
    ]);
    return new Map([...left, ...right]);
  }
}

export async function runBatch({ cases }) {
  const chunkSize = Number(process.env.TURBOPACK_CASES_PER_BUILD || 12);
  const chunks = [];
  for (let index = 0; index < cases.length; index += chunkSize) chunks.push(cases.slice(index, index + chunkSize));
  const maps = [];
  for (let index = 0; index < chunks.length; index++) maps.push(await executeWithFallback(chunks[index], index));
  return new Map(maps.flatMap((value) => [...value]));
}
