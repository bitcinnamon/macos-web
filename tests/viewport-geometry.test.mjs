import assert from 'node:assert/strict';
import test from 'node:test';

import {
  clampDesktopPosition,
  recoverLegacyDesktopPositions,
  rebaseWindowViewportAdaptation,
  resolveWindowViewportGeometry,
} from '../js/system/viewport-geometry.js';

const largeViewport = { width:1440, height:900, safeTop:8, safeBottom:72 };
const smallViewport = { width:700, height:500, safeTop:8, safeBottom:72 };

test('viewport shrink is temporary, fully bounded, and later restores the exact frame', () => {
  const original = { left:420, top:170, width:850, height:590 };
  const shrunk = resolveWindowViewportGeometry(original, null, smallViewport);

  assert.deepEqual(shrunk.geometry, { left:8, top:8, width:684, height:420 });
  assert.ok(shrunk.geometry.left + shrunk.geometry.width <= smallViewport.width - 8);
  assert.ok(shrunk.geometry.top + shrunk.geometry.height <= smallViewport.height - 72);
  assert.deepEqual(shrunk.adaptation.base, original);

  const restored = resolveWindowViewportGeometry(
    shrunk.geometry,
    shrunk.adaptation,
    largeViewport,
  );
  assert.deepEqual(restored.geometry, original);
  assert.equal(restored.adaptation, null);
});

test('the reported 1280 to 700 regression restores Finder geometry exactly', () => {
  const original = { left:150, top:62, width:820, height:520 };
  const shrunk = resolveWindowViewportGeometry(original, null, smallViewport);
  assert.deepEqual(shrunk.geometry, { left:8, top:8, width:684, height:420 });

  const restored = resolveWindowViewportGeometry(
    shrunk.geometry,
    shrunk.adaptation,
    { width:1280, height:720, safeTop:8, safeBottom:72 },
  );
  assert.deepEqual(restored.geometry, original);
});

test('multiple small viewport changes always derive from the original frame', () => {
  const original = { left:520, top:220, width:850, height:590 };
  const first = resolveWindowViewportGeometry(original, null, { ...smallViewport, width:800 });
  const second = resolveWindowViewportGeometry(first.geometry, first.adaptation, smallViewport);

  assert.deepEqual(second.adaptation.base, original);
  const restored = resolveWindowViewportGeometry(second.geometry, second.adaptation, largeViewport);
  assert.deepEqual(restored.geometry, original);
});

test('a deliberate drag rebases position but retains temporarily hidden normal size', () => {
  const original = { left:420, top:170, width:850, height:590 };
  const shrunk = resolveWindowViewportGeometry(original, null, smallViewport);
  const dragged = { ...shrunk.geometry, left:10, top:8 };
  const rebased = rebaseWindowViewportAdaptation(
    shrunk.adaptation,
    dragged,
    ['left', 'top'],
  );
  const restored = resolveWindowViewportGeometry(dragged, rebased, largeViewport);

  assert.deepEqual(restored.geometry, { left:10, top:8, width:850, height:590 });
  assert.equal(restored.adaptation, null);
});

test('a deliberate resize becomes the complete new normal frame', () => {
  const original = { left:420, top:170, width:850, height:590 };
  const shrunk = resolveWindowViewportGeometry(original, null, smallViewport);
  const resized = { left:40, top:20, width:620, height:380 };
  const rebased = rebaseWindowViewportAdaptation(
    shrunk.adaptation,
    resized,
    ['left', 'top', 'width', 'height'],
  );
  const grown = resolveWindowViewportGeometry(resized, rebased, largeViewport);

  assert.deepEqual(grown.geometry, resized);
  assert.equal(grown.adaptation, null);
});

test('an unrelated frame change invalidates stale restore data', () => {
  const original = { left:420, top:170, width:850, height:590 };
  const shrunk = resolveWindowViewportGeometry(original, null, smallViewport);
  const programmatic = { left:20, top:20, width:500, height:300 };
  const grown = resolveWindowViewportGeometry(programmatic, shrunk.adaptation, largeViewport);

  assert.deepEqual(grown.geometry, programmatic);
  assert.equal(grown.adaptation, null);
});

test('desktop icon clamping is reversible when normal position is kept separately', () => {
  const normal = { x:1260, y:700 };
  assert.deepEqual(
    clampDesktopPosition(normal, { width:700, height:478 }),
    { x:614, y:386 },
  );
  assert.deepEqual(
    clampDesktopPosition(normal, { width:1440, height:878 }),
    normal,
  );
});

test('legacy persisted clamp column is repaired once at a wide viewport', () => {
  const stored = {
    'Macintosh HD': { x:614, y:8 },
    'Welcome.txt': { x:614, y:100 },
  };
  const recovered = recoverLegacyDesktopPositions(
    stored,
    [{ key:'Macintosh HD' }, { key:'Welcome.txt' }],
    1280,
  );

  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.positions, {
    'Macintosh HD': { x:1184, y:8 },
    'Welcome.txt': { x:1184, y:100 },
  });
  assert.deepEqual(stored, {
    'Macintosh HD': { x:614, y:8 },
    'Welcome.txt': { x:614, y:100 },
  }, 'migration mutated its input');
});

test('legacy desktop recovery preserves custom layouts and waits for a wide viewport', () => {
  const custom = {
    'Macintosh HD': { x:614, y:48 },
    'Welcome.txt': { x:420, y:210 },
  };
  assert.deepEqual(
    recoverLegacyDesktopPositions(custom, [{ key:'Macintosh HD' }, { key:'Welcome.txt' }], 1280),
    { positions:custom, recovered:false },
  );
  assert.equal(
    recoverLegacyDesktopPositions({ 'Macintosh HD':{ x:614, y:8 } }, [{ key:'Macintosh HD' }], 700).recovered,
    false,
  );
});
