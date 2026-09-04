import path from "node:path";
import { requireTool } from "../lib/tools.mjs";
import { webpackAssetRules } from "../lib/fixture-options.mjs";

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

function externalResolver(patterns) {
  return ({ request }, callback) => {
    const matched = patterns.some(
      (pattern) =>
        pattern === "*" ||
        pattern === request ||
        request?.startsWith(`${pattern}/`) ||
        (pattern.endsWith("/*") && request?.startsWith(pattern.slice(0, -1))),
    );
    callback(null, matched ? `module ${request}` : undefined);
  };
}

export async function build({ workspace, profile, item }) {
  const { rspack, SwcJsMinimizerRspackPlugin } = requireTool("@rspack/core");
  const externals = item.buildOptions?.external || [];
  const stats = await compile(rspack, {
    mode: "production",
    context: workspace.sourceDir,
    entry: workspace.runnerPath,
    target: "node",
    externals: externals.length ? [externalResolver(externals)] : undefined,
    externalsType: "module",
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
      minimizer:
        profile === "production"
          ? [new SwcJsMinimizerRspackPlugin({ minimizerOptions: { mangle: false } })]
          : [],
      mangleExports: false,
    },
    resolve: { extensions: [".mjs", ".js", ".cjs", ".jsx", ".ts", ".tsx", ".json"] },
    module: { rules: webpackAssetRules(item) },
    performance: { hints: false },
    infrastructureLogging: { level: "error" },
    stats: "errors-warnings",
  });
  return {
    entryFile: path.join(workspace.outDir, "bundle.mjs"),
    warnings: stats.warnings.map((item) => item.message || String(item)),
  };
}
