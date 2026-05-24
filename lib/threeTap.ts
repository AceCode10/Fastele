const MAX_TAPS = 3;

const reported = new Set<string>();

export function assertTapDepth(flow: string, taps: number) {
  if (!__DEV__) return;
  if (taps <= MAX_TAPS) return;
  if (reported.has(flow)) return;
  reported.add(flow);
  console.warn(
    `[3-TAP RULE BROKEN] Flow "${flow}" took ${taps} taps. Max allowed: ${MAX_TAPS}. ` +
      `Redesign before merging. See spec §9.`
  );
}

export function resetTapDepthWarnings() {
  reported.clear();
}
