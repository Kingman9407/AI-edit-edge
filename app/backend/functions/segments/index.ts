export type Segment = {
  start: number;
  end: number;
};

const EPSILON = 0.001;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function normalizeSegments(
  segments: Segment[],
  duration: number
): Segment[] {
  if (!duration || duration <= 0) return [];

  const clipped = segments
    .map((segment) => ({
      start: clamp(segment.start, 0, duration),
      end: clamp(segment.end, 0, duration),
    }))
    .filter((segment) => segment.end - segment.start > EPSILON)
    .sort((a, b) => a.start - b.start);

  const merged: Segment[] = [];
  for (const segment of clipped) {
    const last = merged[merged.length - 1];
    if (!last || segment.start > last.end + EPSILON) {
      merged.push({ ...segment });
      continue;
    }
    last.end = Math.max(last.end, segment.end);
  }

  return merged;
}

export function buildKeptSegments(
  duration: number,
  removedSegments: Segment[]
): Segment[] {
  if (!duration || duration <= 0) return [];

  const normalized = normalizeSegments(removedSegments, duration);
  const kept: Segment[] = [];
  let cursor = 0;

  for (const segment of normalized) {
    if (segment.start - cursor > EPSILON) {
      kept.push({ start: cursor, end: segment.start });
    }
    cursor = Math.max(cursor, segment.end);
  }

  if (duration - cursor > EPSILON) {
    kept.push({ start: cursor, end: duration });
  }

  return kept;
}
