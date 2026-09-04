import { isDeepStrictEqual } from "node:util";

function compactWarnings(values = []) {
  return values.slice(0, 3).map((value) => String(value).slice(0, 1_000));
}

function runtimeRecord(runtime, expected, matches, skipped) {
  const record = {
    ok: skipped ? true : Boolean(runtime?.ok),
    actual: runtime?.actual ?? null,
    expected,
    matches,
    skipped,
  };
  if (!skipped && !runtime?.ok) {
    record.error = runtime?.error || null;
    record.stdout = String(runtime?.stdout || "").slice(-2_000);
    record.stderr = String(runtime?.stderr || "").slice(-2_000);
  }
  return record;
}

export function evaluateObservation(item, observation) {
  observation ||= {
    build: { ok: false, durationMs: 0, error: "Adapter returned no observation." },
    runtime: null,
    code: "",
    files: [],
    warnings: [],
  };
  const requiresRuntime = item.execution?.runtime !== false;
  const stableStrings = new Set(item.oracle?.stringMarkers || []);
  const filterMarker = (marker) =>
    observation.markerPolicy !== "strings-only" || !item.oracle || stableStrings.has(marker);
  const absentMarkers = item.expect.absent.filter(filterMarker);
  const presentMarkers = (item.expect.present || []).filter(filterMarker);
  const assertable = requiresRuntime || absentMarkers.length > 0 || presentMarkers.length > 0;

  if (!assertable && !observation.unsupported) {
    return {
      status: "unverified",
      failureKind: "unverified",
      build: observation.build,
      runtime: runtimeRecord(observation.runtime, item.expect.value, null, true),
      analysis: {
        ok: null,
        assertable: false,
        markerPolicy: observation.markerPolicy || "all",
        markersEvaluated: { absent: [], present: [] },
        unexpectedlyPresent: [],
        unexpectedlyAbsent: [],
        emittedBytes: Buffer.byteLength(observation.code || ""),
        emittedFiles: observation.files || [],
        outputHash: observation.outputHash || null,
      },
      warnings: compactWarnings(observation.warnings),
      note: observation.note || "The upstream fixture has no portable runtime or emitted-code oracle.",
    };
  }

  if (!observation.build?.ok) {
    return {
      status: observation.unsupported ? "unsupported" : "fail",
      failureKind: observation.unsupported ? "unsupported" : "build",
      ...observation,
    };
  }

  const runtimeOk =
    !requiresRuntime || (Boolean(observation.runtime?.ok) && isDeepStrictEqual(observation.runtime.actual, item.expect.value));
  const unexpectedlyPresent = absentMarkers.filter((marker) => observation.code.includes(marker));
  const unexpectedlyAbsent = presentMarkers.filter((marker) => !observation.code.includes(marker));
  const analysisOk = unexpectedlyPresent.length === 0 && unexpectedlyAbsent.length === 0;
  let status = "pass";
  let failureKind = null;
  if (!runtimeOk) {
    status = "fail";
    failureKind = "runtime";
  } else if (!analysisOk) {
    status = "partial";
    failureKind = "pruning";
  }

  return {
    status,
    failureKind,
    build: observation.build,
    runtime: runtimeRecord(observation.runtime, item.expect.value, runtimeOk, !requiresRuntime),
    analysis: {
      ok: analysisOk,
      assertable: true,
      markerPolicy: observation.markerPolicy || "all",
      markersEvaluated: { absent: absentMarkers, present: presentMarkers },
      unexpectedlyPresent,
      unexpectedlyAbsent,
      emittedBytes: Buffer.byteLength(observation.code),
      emittedFiles: observation.files || [],
      outputHash: observation.outputHash || null,
    },
    warnings: compactWarnings(observation.warnings),
    note: observation.note || null,
  };
}
