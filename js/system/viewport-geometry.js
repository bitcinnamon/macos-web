// Pure viewport-geometry helpers shared by WindowServer and desktop layout.
// Keeping these calculations independent from the DOM makes the reversible
// resize behaviour deterministic and directly unit-testable.

const WINDOW_FIELDS = ['left', 'top', 'width', 'height'];

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function copyGeometry(geometry) {
  return {
    left:finite(geometry?.left),
    top:finite(geometry?.top),
    width:finite(geometry?.width),
    height:finite(geometry?.height),
  };
}

export function sameWindowGeometry(a, b, tolerance = 0.75) {
  if (!a || !b) return false;
  return WINDOW_FIELDS.every((field) =>
    Math.abs(finite(a[field]) - finite(b[field])) <= tolerance);
}

/** Fit a desired window frame completely inside the Leopard desktop safe area. */
export function clampWindowGeometry(geometry, viewport) {
  const desired = copyGeometry(geometry);
  const viewportWidth = Math.max(0, finite(viewport?.width));
  const viewportHeight = Math.max(0, finite(viewport?.height));
  const safeTop = Math.max(0, finite(viewport?.safeTop, 8));
  const safeBottom = Math.max(8, finite(viewport?.safeBottom, 12));
  const availableWidth = Math.max(160, viewportWidth - 16);
  const availableHeight = Math.max(90, viewportHeight - safeTop - safeBottom);
  const width = Math.min(desired.width, availableWidth);
  const height = Math.min(desired.height, availableHeight);
  const maxLeft = Math.max(8, viewportWidth - 8 - width);
  const maxTop = Math.max(safeTop, viewportHeight - safeBottom - height);
  const left = Math.min(maxLeft, Math.max(8, desired.left));
  const top = Math.min(maxTop, Math.max(safeTop, desired.top));

  return {
    left:Math.round(left),
    top:Math.round(top),
    width:Math.round(width),
    height:Math.round(height),
  };
}

/**
 * Resolve one viewport resize without losing the pre-clamp frame.
 *
 * If the current frame still equals the last temporary frame, the saved base
 * remains authoritative. An unrelated style change invalidates stale restore
 * data and becomes the new base instead.
 */
export function resolveWindowViewportGeometry(current, previous, viewport) {
  const currentGeometry = copyGeometry(current);
  const canRestore = previous?.base && previous?.applied
    && sameWindowGeometry(currentGeometry, previous.applied);
  const base = copyGeometry(canRestore ? previous.base : currentGeometry);
  const applied = clampWindowGeometry(base, viewport);
  const adaptation = sameWindowGeometry(base, applied)
    ? null
    : { base, applied };
  return { geometry:applied, adaptation };
}

/** Update selected normal-frame fields after an explicit user interaction. */
export function rebaseWindowViewportAdaptation(previous, current, fields) {
  if (!previous?.base) return null;
  const base = copyGeometry(previous.base);
  const actual = copyGeometry(current);
  (Array.isArray(fields) && fields.length ? fields : WINDOW_FIELDS).forEach((field) => {
    if (WINDOW_FIELDS.includes(field)) base[field] = actual[field];
  });
  return { base, applied:actual };
}

/** Fit a desktop icon while leaving its persisted normal position untouched. */
export function clampDesktopPosition(position, bounds) {
  const width = Math.max(0, finite(bounds?.width));
  const height = Math.max(0, finite(bounds?.height));
  const iconWidth = Math.max(0, finite(bounds?.iconWidth, 86));
  const iconHeight = Math.max(0, finite(bounds?.iconHeight, 92));
  return {
    x:Math.round(Math.max(0, Math.min(finite(position?.x), Math.max(0, width - iconWidth)))),
    y:Math.round(Math.max(0, Math.min(finite(position?.y), Math.max(0, height - iconHeight)))),
  };
}

/**
 * Repair the exact right-column pattern written by the pre-v70 viewport bug.
 *
 * Older builds persisted temporary clamp coordinates into `macweb.deskpos`.
 * A normal Leopard desktop therefore reopened with every untouched icon in a
 * narrow-screen column (for example x=614 after a 700 px viewport).  Only
 * rows that still match the generated 8 + n*92 layout are moved; arbitrary
 * user-arranged icons remain byte-for-byte unchanged.
 */
export function recoverLegacyDesktopPositions(positions, items, viewportWidth, options = {}) {
  const source = positions && typeof positions === 'object' ? positions : {};
  const next = Object.fromEntries(Object.entries(source).map(([key, value]) => [
    key,
    value && typeof value === 'object' ? { ...value } : value,
  ]));
  const width = Math.max(0, finite(viewportWidth));
  const minimumWidth = Math.max(0, finite(options.minimumWidth, 900));
  const rightMargin = Math.max(0, finite(options.rightMargin, 96));
  const minimumDelta = Math.max(1, finite(options.minimumDelta, 96));
  const rowStart = finite(options.rowStart, 8);
  const rowStep = Math.max(1, finite(options.rowStep, 92));
  if (width < minimumWidth) return { positions:next, recovered:false };

  const rows = Array.from(items || []).map((item, index) => ({
    key:typeof item === 'string' ? item : item?.key,
    index,
  })).filter((item) => item.key);
  const normalX = Math.max(0, width - rightMargin);
  const candidates = rows.map(({ key, index }) => {
    const position = source[key];
    const x = Number(position?.x);
    const y = Number(position?.y);
    const normalY = rowStart + index * rowStep;
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(y - normalY) > .75) return null;
    if (normalX - x < minimumDelta) return null;
    return { key, x, normalY };
  }).filter(Boolean);

  const groups = new Map();
  candidates.forEach((candidate) => {
    const groupKey = Math.round(candidate.x);
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(candidate);
  });
  let recovered = false;
  groups.forEach((group) => {
    // Two aligned default rows are a strong fingerprint of the old clamp.
    // A one-icon desktop is also safe when that sole icon is still in row 0.
    if (group.length < 2 && !(rows.length === 1 && group.length === 1)) return;
    group.forEach(({ key, normalY }) => {
      next[key] = { ...next[key], x:normalX, y:normalY };
    });
    recovered = true;
  });
  return { positions:next, recovered };
}
