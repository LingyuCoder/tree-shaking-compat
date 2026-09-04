import fs from "node:fs/promises";
import path from "node:path";
import { importTool, resolveTool } from "../lib/tools.mjs";

export async function build({ workspace, profile }) {
  const { Parcel } = await importTool("@parcel/core");
  if (profile === "production") {
    await fs.writeFile(path.join(workspace.sourceDir, ".terserrc"), '{"compress":true,"mangle":false}\n');
  }
  const bundler = new Parcel({
    entries: workspace.runnerPath,
    projectRoot: workspace.sourceDir,
    defaultConfig: resolveTool("@parcel/config-default"),
    mode: "production",
    shouldDisableCache: true,
    shouldAutoInstall: false,
    logLevel: "error",
    defaultTargetOptions: {
      shouldOptimize: profile === "production",
      shouldScopeHoist: true,
      sourceMaps: false,
    },
    targets: {
      default: {
        context: "node",
        engines: { node: ">=22" },
        includeNodeModules: true,
        distDir: workspace.outDir,
        distEntry: "bundle.mjs",
        outputFormat: "esmodule",
        isLibrary: false,
        sourceMap: false,
      },
    },
  });
  const event = await bundler.run();
  const warnings = event.diagnostics?.map((diagnostic) => diagnostic.message) || [];
  return { entryFile: path.join(workspace.outDir, "bundle.mjs"), warnings };
}
