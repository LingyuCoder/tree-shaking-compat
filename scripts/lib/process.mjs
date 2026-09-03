import { spawn } from "node:child_process";

export function runCommand(command, args, options = {}) {
  const {
    cwd,
    env = {},
    timeoutMs = 10 * 60 * 1000,
    inherit = false,
    maxOutput = 2_000_000,
  } = options;

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    if (!inherit) {
      child.stdout.on("data", (chunk) => {
        if (stdout.length < maxOutput) stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        if (stderr.length < maxOutput) stderr += chunk;
      });
    }

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({
        ok: false,
        code: null,
        signal: null,
        stdout,
        stderr,
        error: error.message,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });

    child.on("close", (code, signal) => {
      clearTimeout(timer);
      resolve({
        ok: code === 0 && !timedOut,
        code,
        signal,
        stdout,
        stderr,
        error: timedOut ? `Timed out after ${timeoutMs}ms` : null,
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

export function compactError(value, limit = 4_000) {
  const text = value instanceof Error ? value.stack || value.message : String(value);
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}
