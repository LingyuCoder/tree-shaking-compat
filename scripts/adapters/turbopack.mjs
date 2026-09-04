import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { createFixtureRunnerSource, normalizeRelativeSpecifiers } from "../lib/workspace.mjs";
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
    const normalized = normalizeRelativeSpecifiers(item, relative, contents);
    await fs.writeFile(destination, normalized.endsWith("\n") ? normalized : `${normalized}\n`);
  }
  try {
    await fs.access(path.join(fixtureDir, "package.json"));
  } catch {
    await fs.writeFile(
      path.join(fixtureDir, "package.json"),
      item.oracle ? '{"private":true}\n' : '{"private":true,"type":"module"}\n',
    );
  }
  await fs.writeFile(path.join(fixtureDir, "__runner.mjs"), createFixtureRunnerSource(item, { exported: true }));

  const routeDir = path.join(projectRoot, "app", "api", caseSlug);
  await fs.mkdir(routeDir, { recursive: true });
  const specifier = `../../../fixtures/${caseSlug}/__runner.mjs`;
  await fs.writeFile(
    path.join(routeDir, "route.js"),
    `import { runFixture } from ${JSON.stringify(specifier)};\nexport const dynamic = "force-dynamic";\nexport async function GET() {\n  try {\n    return Response.json({ ok: true, value: await runFixture() });\n  } catch (error) {\n    return Response.json({ ok: false, error: error?.stack || String(error) }, { status: 500 });\n  }\n}\n`,
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
    for (const [id, { caseSlug, item }] of caseSlugs) {
      if (item.execution?.runtime === false) {
        values.set(id, { ok: true, actual: null, error: null, stdout: "", stderr: "", skipped: true });
        continue;
      }
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

async function collectRouteOutput(projectRoot, caseSlug) {
  const serverRoot = path.join(projectRoot, ".next", "server");
  const routeFile = path.join(serverRoot, "app", "api", caseSlug, "route.js");
  const traceFile = `${routeFile}.nft.json`;
  const candidates = [routeFile];
  try {
    const trace = JSON.parse(await fs.readFile(traceFile, "utf8"));
    for (const relative of trace.files || []) {
      const file = path.resolve(path.dirname(traceFile), relative);
      const withinServer = path.relative(serverRoot, file);
      if (!withinServer.startsWith("..") && !path.isAbsolute(withinServer) && /\.(?:[cm]?js)$/.test(file)) {
        candidates.push(file);
      }
    }
  } catch {
    // The route entry itself still gives a useful diagnostic if Next omits a trace.
  }
  const files = [...new Set(candidates)];
  const readable = [];
  for (const file of files) {
    try {
      readable.push([file, await fs.readFile(file, "utf8")]);
    } catch {
      // Ignore trace entries which are not materialized in this output mode.
    }
  }
  return {
    code: readable.map(([, code]) => code).join("\n"),
    files: readable.map(([file]) => path.relative(projectRoot, file)),
  };
}

async function executeChunk(items, chunkIndex) {
  const startedAt = Date.now();
  const projectRoot = path.join(runsRoot, "turbopack", "production", `batch-${chunkIndex}`);
  try {
    await fs.rm(projectRoot, { recursive: true, force: true });
    await fs.mkdir(path.join(projectRoot, "app"), { recursive: true });
    await fs.writeFile(
      path.join(projectRoot, "package.json"),
      '{"name":"tree-shaking-turbopack-fixtures","private":true,"type":"module","scripts":{"build":"next build --turbopack"}}\n',
    );
    const externalPackages = [
      ...new Set(
        items
          .flatMap((item) => item.buildOptions?.external || [])
          .filter((specifier) => specifier !== "*" && !specifier.includes("*"))
          .map((specifier) =>
            specifier.startsWith("@") ? specifier.split("/").slice(0, 2).join("/") : specifier.split("/")[0],
          ),
      ),
    ];
    await fs.writeFile(
      path.join(projectRoot, "next.config.mjs"),
      `export default ${JSON.stringify({ output: "standalone", serverExternalPackages: externalPackages })};\n`,
    );
    await fs.writeFile(
      path.join(projectRoot, "app", "layout.js"),
      "export default function Layout({ children }) { return <html><body>{children}</body></html>; }\n",
    );
    await fs.writeFile(path.join(projectRoot, "app", "page.js"), "export default function Page() { return null; }\n");
    await fs.symlink(toolchainModules, path.join(projectRoot, "node_modules"), "dir");

    const caseSlugs = new Map();
    for (const item of items) {
      caseSlugs.set(item.id, { caseSlug: await writeFixture(projectRoot, item), item });
    }
    const nextBin = resolveTool("next/dist/bin/next");
    const build = await runCommand(process.execPath, [nextBin, "build", "--turbopack"], {
      cwd: projectRoot,
      env: { NEXT_TELEMETRY_DISABLED: "1", CI: "1", NODE_ENV: "production" },
      timeoutMs: 20 * 60 * 1000,
    });
    if (!build.ok) throw new Error(build.error || build.stderr || build.stdout || "next build failed");
    const runtimeValues = await runProject(projectRoot, nextBin, caseSlugs);
    const outputs = new Map(
      await Promise.all(items.map(async (item) => [item.id, await collectRouteOutput(projectRoot, caseSlugs.get(item.id).caseSlug)])),
    );
    return new Map(
      items.map((item) => [
        item.id,
        {
          build: { ok: true, durationMs: Date.now() - startedAt, error: null },
          runtime: runtimeValues.get(item.id),
          code: outputs.get(item.id).code,
          files: outputs.get(item.id).files,
          warnings: build.stderr ? [build.stderr.trim()] : [],
          markerPolicy: "strings-only",
          note: "Turbopack is measured through the latest stable Next.js production pipeline; a standalone graph profile is not public.",
        },
      ]),
    );
  } finally {
    await fs.rm(projectRoot, { recursive: true, force: true }).catch(() => {});
  }
}

function failedObservations(items, error) {
  const message = compactError(error);
  return new Map(
    items.map((item) => [
      item.id,
      {
        build: { ok: false, durationMs: 0, error: message },
        runtime: null,
        code: "",
        files: [],
        warnings: [],
      },
    ]),
  );
}

async function executeWithFallback(items, chunkIndex) {
  try {
    return await executeChunk(items, chunkIndex);
  } catch (error) {
    if (items.length === 1) return failedObservations(items, error);
    const message = compactError(error);
    const identified = items.filter((item) => {
      const caseSlug = slug(item.id);
      return message.includes(`/fixtures/${caseSlug}/`) || message.includes(`/api/${caseSlug}/`);
    });
    if (identified.length && identified.length < items.length) {
      const rejected = new Set(identified.map((item) => item.id));
      const remaining = items.filter((item) => !rejected.has(item.id));
      const successful = await executeWithFallback(remaining, `${chunkIndex}r`);
      return new Map([...successful, ...failedObservations(identified, error)]);
    }
    const middle = Math.ceil(items.length / 2);
    const left = await executeWithFallback(items.slice(0, middle), `${chunkIndex}a`);
    const right = await executeWithFallback(items.slice(middle), `${chunkIndex}b`);
    return new Map([...left, ...right]);
  }
}

export async function runBatch({ cases }) {
  const chunkSize = Number(process.env.TURBOPACK_CASES_PER_BUILD || 64);
  const chunks = [];
  for (let index = 0; index < cases.length; index += chunkSize) chunks.push(cases.slice(index, index + chunkSize));
  const maps = [];
  for (let index = 0; index < chunks.length; index++) {
    console.log(`    Turbopack batch ${index + 1}/${chunks.length} (${chunks[index].length} cases)`);
    maps.push(await executeWithFallback(chunks[index], index));
  }
  return new Map(maps.flatMap((value) => [...value]));
}
