import path from "node:path";
import { requireTool } from "../lib/tools.mjs";

function compile(rspack, config) {
  return new Promise((resolve, reject) => {
    const compiler = rspack(config);
    compiler.run((error, stats) => {
      compiler.close((closeError) => {
        if (error || closeError) return reject(error || closeError);
        const details = stats.toJson({ all: false, errors: true, warnings: true });
        if (stats.hasErrors()) {
          return reject(new Error(details.errors.map((item) => item.message || item).join("\n")));
        }
        resolve(details);
      });
    });
  });
}

export async function build({ workspace, profile }) {
  const { rspack } = requireTool("@rspack/core");
  const stats = await compile(rspack, {
    mode: "production",
    context: workspace.sourceDir,
    entry: workspace.runnerPath,
    target: "node",
    devtool: false,
    experiments: { outputModule: true },
    output: {
      path: workspace.outDir,
      filename: "bundle.mjs",
      chunkFilename: "chunks/[name]-[contenthash].mjs",
      module: true,
      chunkFormat: "module",
      clean: true,
    },
    optimization: {
      usedExports: true,
      sideEffects: true,
      concatenateModules: true,
      minimize: profile === "production",
      mangleExports: false,
    },
    resolve: { extensions: [".mjs", ".js", ".cjs", ".json"] },
    performance: { hints: false },
    infrastructureLogging: { level: "error" },
    stats: "errors-warnings",
  });
  return {
    entryFile: path.join(workspace.outDir, "bundle.mjs"),
    warnings: stats.warnings.map((item) => item.message || String(item)),
  };
}
