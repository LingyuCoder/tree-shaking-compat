import { isDeepStrictEqual } from "node:util";

export function evaluateObservation(item, observation) {
  if (!observation.build?.ok) {
    return {
      status: observation.unsupported ? "unsupported" : "fail",
      failureKind: observation.unsupported ? "unsupported" : "build",
      ...observation,
    };
  }

  const runtimeOk = Boolean(observation.runtime?.ok) && isDeepStrictEqual(observation.runtime.actual, item.expect.value);
  const unexpectedlyPresent = item.expect.absent.filter((marker) => observation.code.includes(marker));
  const unexpectedlyAbsent = (item.expect.present || []).filter((marker) => !observation.code.includes(marker));
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
    runtime: {
      ...observation.runtime,
      expected: item.expect.value,
      matches: runtimeOk,
    },
    analysis: {
      ok: analysisOk,
      unexpectedlyPresent,
      unexpectedlyAbsent,
      emittedBytes: Buffer.byteLength(observation.code),
      emittedFiles: observation.files || [],
      outputHash: observation.outputHash || null,
    },
    warnings: observation.warnings || [],
    note: observation.note || null,
  };
}
