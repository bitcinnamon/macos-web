// Shared Aqua-style icons. Each access mints unique paint IDs so multiple
// inlined copies on the desktop/Dock do not fight over the same gradient.

let iconSeq = 0;
const uid = (prefix) => `${prefix}-${++iconSeq}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Macintosh HD — classic Mac OS X Aqua icon (matches the well-known
 * silver internal hard disk: top-down chassis, platter rings, black label,
 * front vents, green LED). Geometry stays inside the 64 viewBox.
 */
function hdSvg() {
  const g = uid('hd');
  // Concentric platter rings (classic embossed disc on the lid)
  const rings = [18.5, 15.5, 12.5, 9.5, 6.5, 4].map((r, i) =>
    `<circle cx="32" cy="34" r="${r}" fill="none" stroke="${i % 2 ? '#9aa5b2' : '#d5dde6'}" stroke-width="${i === 0 ? 1.4 : 0.85}" opacity="${0.95 - i * 0.06}"/>`
  ).join('');
  return `<svg viewBox="0 0 64 64" aria-hidden="true" overflow="visible">
  <defs>
    <linearGradient id="${g}-body" x1="0" y1="0" x2="0.15" y2="1">
      <stop stop-color="#f8fafc"/><stop offset=".35" stop-color="#d0d7e0"/>
      <stop offset=".55" stop-color="#a8b3c0"/><stop offset="1" stop-color="#c5ced8"/>
    </linearGradient>
    <linearGradient id="${g}-lid" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#ffffff"/><stop offset=".4" stop-color="#e2e8ef"/>
      <stop offset="1" stop-color="#b4bfcb"/>
    </linearGradient>
    <radialGradient id="${g}-platter" cx=".42" cy=".38">
      <stop stop-color="#f2f5f8"/><stop offset=".45" stop-color="#c2cbd5"/><stop offset="1" stop-color="#8e99a7"/>
    </radialGradient>
    <linearGradient id="${g}-front" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#6a7380"/><stop offset=".4" stop-color="#3a4350"/><stop offset="1" stop-color="#1a1f26"/>
    </linearGradient>
    <linearGradient id="${g}-label" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#2a3038"/><stop offset="1" stop-color="#0a0c10"/>
    </linearGradient>
    <radialGradient id="${g}-led" cx=".35" cy=".3">
      <stop stop-color="#e8ffd4"/><stop offset=".4" stop-color="#7af05a"/><stop offset="1" stop-color="#1a8a20"/>
    </radialGradient>
    <filter id="${g}-sh" x="-18%" y="-10%" width="136%" height="130%">
      <feDropShadow dy="2.2" stdDeviation="1.6" flood-opacity=".38"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <!-- main silver body (slight perspective: top dominates) -->
    <path d="M14 8.5
      q0-2.5 2.5-2.5h31q2.5 0 2.5 2.5
      v38.5q0 1.5-1.5 1.5H15.5q-1.5 0-1.5-1.5z"
      fill="url(#${g}-body)" stroke="#6a7582" stroke-width="1"/>
    <!-- lid surface -->
    <path d="M15.5 9.2
      q0-1.6 1.6-1.6h29.8q1.6 0 1.6 1.6
      v33.8q0 1.2-1.2 1.2H16.7q-1.2 0-1.2-1.2z"
      fill="url(#${g}-lid)" stroke="#8a95a3" stroke-width=".7"/>
    <!-- soft top sheen -->
    <path d="M18 10.5h28" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>

    <!-- black capacity label -->
    <rect x="20" y="11.5" width="24" height="7.2" rx="1" fill="url(#${g}-label)" stroke="#000" stroke-width=".4"/>
    <text x="27.5" y="15.2" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="2.6" font-weight="700" fill="#e8e8e8">80 GB Internal Hard Disk</text>
    <text x="27.2" y="17.4" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="1.55" fill="#9aa0a8">Apple Computer  ·  Mac OS X</text>
    <!-- tiny lock mark on label right -->
    <rect x="39.2" y="13.1" width="3.2" height="2.6" rx=".35" fill="none" stroke="#c8cdd3" stroke-width=".45"/>
    <path d="M39.7 13.1v-.7a1.1 1.1 0 0 1 2.2 0v.7" fill="none" stroke="#c8cdd3" stroke-width=".45"/>

    <!-- platter disc (the big circular motif) -->
    <circle cx="32" cy="34" r="19.2" fill="url(#${g}-platter)" stroke="#7a8694" stroke-width="1"/>
    ${rings}
    <!-- spindle hub -->
    <circle cx="32" cy="34" r="5.2" fill="#dce3ea" stroke="#6a7582" stroke-width=".9"/>
    <circle cx="32" cy="34" r="2.6" fill="#eef2f6" stroke="#8a95a3" stroke-width=".7"/>
    <circle cx="32" cy="34" r="1" fill="#a8b3c0"/>
    <!-- platter highlight arc -->
    <path d="M20 24c6-7 18-8 26-1" fill="none" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".45"/>

    <!-- four lid screws -->
    <g>
      ${[[17.2, 10.8], [46.8, 10.8], [17.2, 46.5], [46.8, 46.5]].map(([x, y]) => `
        <circle cx="${x}" cy="${y}" r="1.55" fill="#c5ced8" stroke="#5a6572" stroke-width=".55"/>
        <circle cx="${x}" cy="${y}" r=".55" fill="#8a95a3"/>
      `).join('')}
    </g>

    <!-- front face (darker bezel under the lid) -->
    <path d="M14.5 48.5h35q1.2 0 1.2 1.2v4.8q0 1.5-1.5 1.5h-34.4q-1.5 0-1.5-1.5v-4.8q0-1.2 1.2-1.2z"
      fill="url(#${g}-front)" stroke="#2a313a" stroke-width=".85"/>
    <!-- front recess / undercut -->
    <path d="M16 49.2h32v2.2H16z" fill="#12161c" opacity=".55"/>
    <!-- vertical vent slots -->
    <g stroke="#0a0d12" stroke-width="1.15" stroke-linecap="round">
      ${[26, 28.2, 30.4, 32.6, 34.8, 37].map((x) => `<path d="M${x} 51.2v2.6"/>`).join('')}
    </g>
    <g stroke="#8a95a3" stroke-width=".45" stroke-linecap="round" opacity=".35">
      ${[26, 28.2, 30.4, 32.6, 34.8, 37].map((x) => `<path d="M${x} 51.3v1.2"/>`).join('')}
    </g>
    <!-- green LED bottom-right of front -->
    <circle cx="46.8" cy="52.6" r="1.35" fill="#0a100e" stroke="#1a2220" stroke-width=".4"/>
    <circle cx="46.8" cy="52.6" r=".9" fill="url(#${g}-led)"/>
    <circle cx="46.5" cy="52.3" r=".28" fill="#fff" opacity=".9"/>
  </g>
</svg>`;
}

function folderSvg() {
  const g = uid('fld');
  // Geometry stays inside 6..58 so Finder's fixed fi-img box does not clip the right edge.
  return `<svg viewBox="0 0 64 64" aria-hidden="true" overflow="visible">
  <defs>
    <linearGradient id="${g}-body" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#d8f0ff"/><stop offset=".4" stop-color="#6fbaef"/><stop offset="1" stop-color="#1f6fb8"/>
    </linearGradient>
    <linearGradient id="${g}-lip" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fff"/><stop offset="1" stop-color="#a8d8f7"/>
    </linearGradient>
    <filter id="${g}-sh" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dy="1.6" stdDeviation="1.1" flood-opacity=".38"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <path d="M8 20
      q0-5 5-5h12l6 6h25q5 0 5 5v24q0 5-5 5H13q-5 0-5-5z"
      fill="url(#${g}-body)" stroke="#155a96" stroke-width="1.3"/>
    <path d="M9 28h46v-4q0-4-5-4H28l-6-6H13q-4 0-4 5z"
      fill="url(#${g}-lip)" opacity=".72"/>
    <path d="M11 21h16" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".65"/>
    <path d="M11 48h42" stroke="#0f4a82" stroke-opacity=".22"/>
  </g>
</svg>`;
}

function textfileSvg() {
  const g = uid('doc');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${g}-p" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fff"/><stop offset="1" stop-color="#dfe6ee"/>
    </linearGradient>
    <filter id="${g}-sh" x="-20%" y="-15%" width="140%" height="150%">
      <feDropShadow dy="1.8" stdDeviation="1.2" flood-opacity=".38"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <path d="M13 4h26l13 13v43H13z" fill="url(#${g}-p)" stroke="#6f7a86" stroke-width="1.45"/>
    <path d="M39 4v13h13" fill="#c9d2db" stroke="#6f7a86"/>
    <path d="M39 4 52 17" stroke="#9aa5b0"/>
    <g stroke="#7d8db0" stroke-width="2" stroke-linecap="round">
      <path d="M20 27h24M20 34h24M20 41h20M20 48h15"/>
    </g>
  </g>
</svg>`;
}

function trashSvg(full = false) {
  const g = uid(full ? 'trf' : 'tr');
  const paper = full ? `
    <g clip-path="url(#${g}-clip)" stroke="#657484" stroke-width=".7">
      <path d="m17 25 6-9 9 6-4 11z" fill="#f6f3ea"/>
      <path d="m27 25 10-8 8 9-9 9z" fill="#fffdf6"/>
      <path d="m39 26 9-7 5 11-11 6z" fill="#e7edf4"/>
      <path d="m22 33 6-9 9 8-4 9z" fill="#d9e6f5"/>
    </g>` : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${g}-glass" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="#7f91a4" stop-opacity=".62"/><stop offset=".2" stop-color="#f9fcff" stop-opacity=".9"/>
      <stop offset=".5" stop-color="#c2cfdb" stop-opacity=".5"/><stop offset=".8" stop-color="#fff" stop-opacity=".92"/>
      <stop offset="1" stop-color="#738496" stop-opacity=".68"/>
    </linearGradient>
    <linearGradient id="${g}-rim" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fff"/><stop offset=".45" stop-color="#aab7c5"/><stop offset=".55" stop-color="#657584"/><stop offset="1" stop-color="#e2e9f0"/>
    </linearGradient>
    <filter id="${g}-sh" x="-30%" y="-25%" width="160%" height="170%">
      <feDropShadow dy="2" stdDeviation="1.3" flood-opacity=".42"/>
    </filter>
    <clipPath id="${g}-clip"><path d="M15.5 18 20 57h24l4.5-39z"/></clipPath>
  </defs>
  <g filter="url(#${g}-sh)">
    ${paper}
    <path d="M15.5 18 20 57h24l4.5-39z" fill="url(#${g}-glass)" stroke="#5c6b7a" stroke-width="1.2"/>
    <g clip-path="url(#${g}-clip)" fill="none" stroke="#6d7e90" stroke-width=".8" opacity=".82">
      <path d="M20.5 14 25 60M28.5 14l1.2 46M35.5 14l-1.2 46M43.5 14 39 60"/>
      <path d="M14 27h36M16 35h32M17.5 43h29M19 51h26"/>
    </g>
    <path d="M19 53.5h26L44 57H20z" fill="#7a8b9c" opacity=".78"/>
    <ellipse cx="32" cy="17.8" rx="17" ry="5" fill="url(#${g}-rim)" stroke="#556472"/>
    <ellipse cx="32" cy="17.2" rx="14" ry="2.4" fill="#768696" opacity=".65"/>
    <path d="M18.5 16.3c4.5-2.4 22.5-3 27.2.3" fill="none" stroke="#fff" stroke-width="1.1" opacity=".88"/>
  </g>
</svg>`;
}

/** Classic Leopard Finder happy-face for Dock. */
export function finderIconSvg() {
  const g = uid('fnd');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${g}-l" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#e6f7ff"/><stop offset=".45" stop-color="#8ec8ef"/><stop offset="1" stop-color="#2f87c8"/>
    </linearGradient>
    <linearGradient id="${g}-r" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#6eb8e6"/><stop offset=".5" stop-color="#2a7fbf"/><stop offset="1" stop-color="#0f5a96"/>
    </linearGradient>
    <filter id="${g}-sh" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".42"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <path d="M7 14q0-7 7-7h18v50H14q-7 0-7-7z" fill="url(#${g}-l)"/>
    <path d="M32 7h18q7 0 7 7v36q0 7-7 7H32z" fill="url(#${g}-r)"/>
    <rect x="7" y="7" width="50" height="50" rx="10" fill="none" stroke="#0d4f86" stroke-width="1.6"/>
    <path d="M32 7c-7 14-9 28-3 42" fill="none" stroke="#0f4f82" stroke-width="1.5"/>
    <path d="M26 7c-7 16-6 36 2 46" fill="none" stroke="#eef9ff" stroke-width="2.2" opacity=".9"/>
    <path d="M17 28q3.5-3.5 7 0M40 28q3.5-3.5 7 0" fill="none" stroke="#0b3f6c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M15 43q10 9 22 5 8-2 13-9" fill="none" stroke="#0b3f6c" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M32 33l-2.2 8h5.2" fill="none" stroke="#0b3f6c" stroke-width="1.7" stroke-linecap="round"/>
  </g>
</svg>`;
}

export function safariIconSvg() {
  const g = uid('saf');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="${g}-face" cx=".35" cy=".28">
      <stop stop-color="#dff4ff"/><stop offset=".4" stop-color="#5eb0e6"/><stop offset="1" stop-color="#0f5fa3"/>
    </radialGradient>
    <linearGradient id="${g}-ring" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fff"/><stop offset=".4" stop-color="#b4bec8"/><stop offset=".55" stop-color="#6a7480"/><stop offset="1" stop-color="#eef2f5"/>
    </linearGradient>
    <filter id="${g}-sh"><feDropShadow dy="2" stdDeviation="1.5" flood-opacity=".4"/></filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <circle cx="32" cy="32" r="29" fill="url(#${g}-ring)" stroke="#4f5863"/>
    <circle cx="32" cy="32" r="23.5" fill="url(#${g}-face)" stroke="#e8f7ff"/>
    <g stroke="#f2fbff" stroke-linecap="round">${Array.from({ length: 24 }, (_, i) =>
      `<path d="M32 11v${i % 3 === 0 ? 4.5 : 2.2}" transform="rotate(${i * 15} 32 32)" stroke-width="${i % 3 === 0 ? 1.6 : .75}"/>`).join('')}</g>
    <path d="m46 17-11 19-17 11 11-20z" fill="#fff" stroke="#2d4660"/>
    <path d="m46 17-11 19-6-8z" fill="#e02f2f"/>
    <circle cx="32" cy="32" r="2.6" fill="#2d4660"/>
  </g>
</svg>`;
}

export function sysprefsIconSvg() {
  const g = uid('sp');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${g}-case" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#fbfcfd"/><stop offset=".48" stop-color="#c8ced5"/><stop offset=".54" stop-color="#7e8791"/><stop offset="1" stop-color="#e7eaed"/>
    </linearGradient>
    <radialGradient id="${g}-gear" cx=".35" cy=".3">
      <stop stop-color="#f2f4f6"/><stop offset=".55" stop-color="#8b959f"/><stop offset="1" stop-color="#4d5660"/>
    </radialGradient>
    <filter id="${g}-sh"><feDropShadow dy="2" stdDeviation="1.4" flood-opacity=".42"/></filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <rect x="6" y="6" width="52" height="52" rx="10" fill="url(#${g}-case)" stroke="#535c66" stroke-width="1.5"/>
    <path d="M10 12h44" stroke="#fff" stroke-width="2" opacity=".8"/>
    <g transform="translate(32 34)">
      ${[0,45,90,135,180,225,270,315].map((a) => `<rect x="-3.6" y="-22" width="7.2" height="11" rx="2" fill="#5f6973" transform="rotate(${a})"/>`).join('')}
      <circle r="16" fill="url(#${g}-gear)" stroke="#4b5560" stroke-width="1.8"/>
      <circle r="7.5" fill="#e8ecf0" stroke="#62707c" stroke-width="1.8"/>
    </g>
  </g>
</svg>`;
}

/**
 * Mail (Leopard-era): postage stamp plate, sky-blue field, white envelope,
 * small cancellation / stamp mark — glossy Aqua depth.
 */
export function mailIconSvg() {
  const g = uid('mail');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="${g}-plate" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#9fd4f5"/><stop offset=".45" stop-color="#3b93d4"/><stop offset="1" stop-color="#145a9a"/>
    </linearGradient>
    <linearGradient id="${g}-env" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#ffffff"/><stop offset="1" stop-color="#d7e0e9"/>
    </linearGradient>
    <linearGradient id="${g}-flap" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#f4f8fc"/><stop offset="1" stop-color="#b8c8d6"/>
    </linearGradient>
    <radialGradient id="${g}-stamp" cx=".35" cy=".3">
      <stop stop-color="#ffef9a"/><stop offset=".55" stop-color="#e8a83a"/><stop offset="1" stop-color="#b56a18"/>
    </radialGradient>
    <filter id="${g}-sh" x="-25%" y="-20%" width="150%" height="150%">
      <feDropShadow dy="2.2" stdDeviation="1.5" flood-opacity=".42"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <!-- perforated stamp plate -->
    <path d="M8 8h48v48H8z" fill="url(#${g}-plate)" stroke="#0f4a82" stroke-width="1.4"/>
    <path d="M8 8h48v48H8z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2.2 2.4"/>
    <path d="M10 11h44" stroke="#fff" stroke-width="1.6" opacity=".55"/>
    <!-- envelope body -->
    <path d="M12 22h40v28H12z" fill="url(#${g}-env)" stroke="#4a6a86" stroke-width="1.2"/>
    <!-- V flap -->
    <path d="M12 22 32 38 52 22" fill="url(#${g}-flap)" stroke="#4a6a86" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 50 27 36M52 50 37 36" fill="none" stroke="#7f97ad" stroke-width="1.2"/>
    <!-- corner stamp -->
    <rect x="40" y="11" width="12" height="14" rx="1.2" fill="url(#${g}-stamp)" stroke="#8a5410" stroke-width="1"/>
    <circle cx="46" cy="17.5" r="3.2" fill="none" stroke="#8a5410" stroke-width="1"/>
    <path d="M43.5 17.5h5M46 15v5" stroke="#8a5410" stroke-width=".9"/>
    <path d="M41 12.5h10" stroke="#fff" stroke-opacity=".5" stroke-width=".8"/>
  </g>
</svg>`;
}

/**
 * iChat (Tiger/Leopard): glossy green speech bubble with a white smile face.
 */
export function ichatIconSvg() {
  const g = uid('ichat');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="${g}-bub" cx=".32" cy=".22">
      <stop stop-color="#e8ffe4"/><stop offset=".28" stop-color="#8ae07a"/><stop offset=".72" stop-color="#2fad3a"/><stop offset="1" stop-color="#0f6b1a"/>
    </radialGradient>
    <linearGradient id="${g}-face" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#ffffff"/><stop offset="1" stop-color="#e4f5e2"/>
    </linearGradient>
    <filter id="${g}-sh" x="-25%" y="-20%" width="150%" height="155%">
      <feDropShadow dy="2.2" stdDeviation="1.6" flood-opacity=".42"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <!-- bubble + tail -->
    <path d="M8 28c0-12.5 10.8-21 24-21s24 8.5 24 21-10.8 22-24 22c-3.2 0-6.2-.3-9-.9L10 58l4.2-13.5C10.2 40.5 8 34.8 8 28z"
      fill="url(#${g}-bub)" stroke="#0a5a14" stroke-width="1.5"/>
    <path d="M14 16c8-6 28-7 38 2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>
    <!-- white face disc -->
    <circle cx="32" cy="28" r="14.5" fill="url(#${g}-face)" stroke="#1f7a2a" stroke-width="1" opacity=".98"/>
    <!-- eyes -->
    <ellipse cx="26.2" cy="26" rx="2.4" ry="3" fill="#17351c"/>
    <ellipse cx="37.8" cy="26" rx="2.4" ry="3" fill="#17351c"/>
    <circle cx="25.5" cy="25" r=".7" fill="#fff" opacity=".85"/>
    <circle cx="37.1" cy="25" r=".7" fill="#fff" opacity=".85"/>
    <!-- smile -->
    <path d="M24 32.5c2.8 4.2 13.2 4.2 16 0" fill="none" stroke="#17351c" stroke-width="2.4" stroke-linecap="round"/>
  </g>
</svg>`;
}

/**
 * Dashboard (Leopard): dark chrome tachometer / gauge with red needle.
 */
export function dashboardIconSvg() {
  const g = uid('dash');
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = -120 + i * (240 / 11);
    const long = i % 2 === 0;
    return `<path d="M32 11v${long ? 5.5 : 3}" transform="rotate(${a} 32 32)" stroke="#e8eef4" stroke-width="${long ? 2 : 1.1}" stroke-linecap="round"/>`;
  }).join('');
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <radialGradient id="${g}-face" cx=".4" cy=".32">
      <stop stop-color="#3a424c"/><stop offset=".55" stop-color="#12151a"/><stop offset="1" stop-color="#050608"/>
    </radialGradient>
    <linearGradient id="${g}-bezel" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#f4f6f8"/><stop offset=".4" stop-color="#a7b0ba"/><stop offset=".55" stop-color="#5a646f"/><stop offset="1" stop-color="#dce2e8"/>
    </linearGradient>
    <linearGradient id="${g}-needle" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#ff7a6e"/><stop offset="1" stop-color="#c01810"/>
    </linearGradient>
    <filter id="${g}-sh" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dy="2.2" stdDeviation="1.5" flood-opacity=".45"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <circle cx="32" cy="32" r="29" fill="url(#${g}-bezel)" stroke="#3d4650"/>
    <circle cx="32" cy="32" r="24.5" fill="url(#${g}-face)" stroke="#6a7380" stroke-width="1.2"/>
    <circle cx="32" cy="32" r="22.5" fill="none" stroke="#000" stroke-opacity=".35"/>
    <!-- tick marks -->
    <g>${ticks}</g>
    <!-- arc accent -->
    <path d="M14.5 40.5a20 20 0 0 1 35 0" fill="none" stroke="#5ad0ff" stroke-width="1.4" opacity=".35" stroke-linecap="round"/>
    <!-- needle -->
    <path d="M32 32 L46 17" stroke="url(#${g}-needle)" stroke-width="3.2" stroke-linecap="round"/>
    <path d="M32 32 L46 17" stroke="#ffd0cc" stroke-width="1" stroke-linecap="round" opacity=".7"/>
    <circle cx="32" cy="32" r="4.2" fill="#f0f3f6" stroke="#2a3138" stroke-width="1.2"/>
    <circle cx="32" cy="32" r="1.8" fill="#c01810"/>
    <!-- glass highlight -->
    <path d="M18 16c6-5 22-6 30 2" fill="none" stroke="#fff" stroke-width="2" opacity=".22" stroke-linecap="round"/>
  </g>
</svg>`;
}

/**
 * QuickTime Player (Mac OS X / Leopard): chrome bezel + deep blue disc + classic Q.
 */
export function quicktimeIconSvg() {
  const g = uid('qt');
  return `<svg viewBox="0 0 64 64" aria-hidden="true" overflow="visible">
  <defs>
    <linearGradient id="${g}-bezel" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#ffffff"/><stop offset=".38" stop-color="#c0c8d2"/>
      <stop offset=".52" stop-color="#6a7480"/><stop offset="1" stop-color="#e8edf2"/>
    </linearGradient>
    <radialGradient id="${g}-face" cx=".34" cy=".28">
      <stop stop-color="#cfe6ff"/><stop offset=".32" stop-color="#4f8fd9"/>
      <stop offset=".72" stop-color="#1a4fad"/><stop offset="1" stop-color="#0b2a6a"/>
    </radialGradient>
    <linearGradient id="${g}-q" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#ffffff"/><stop offset=".55" stop-color="#d7e8fb"/><stop offset="1" stop-color="#9bb6d8"/>
    </linearGradient>
    <linearGradient id="${g}-tail" x1="0" y1="0" x2="1" y2="1">
      <stop stop-color="#f4f8ff"/><stop offset="1" stop-color="#8aa8d0"/>
    </linearGradient>
    <filter id="${g}-sh" x="-25%" y="-25%" width="150%" height="160%">
      <feDropShadow dy="2.2" stdDeviation="1.5" flood-opacity=".45"/>
    </filter>
  </defs>
  <g filter="url(#${g}-sh)">
    <circle cx="32" cy="32" r="28.5" fill="url(#${g}-bezel)" stroke="#4f5863" stroke-width="1.2"/>
    <circle cx="32" cy="32" r="23.5" fill="url(#${g}-face)" stroke="#e8f3ff" stroke-width="1.1"/>
    <!-- glass rim -->
    <circle cx="32" cy="32" r="21.5" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1.2"/>
    <!-- Q ring -->
    <circle cx="30.5" cy="30" r="11.5" fill="none" stroke="url(#${g}-q)" stroke-width="6.2"/>
    <circle cx="30.5" cy="30" r="11.5" fill="none" stroke="#1a3f7a" stroke-width="1" opacity=".35"/>
    <!-- Q tail -->
    <path d="M37.5 37.5 50.5 50.5" stroke="url(#${g}-tail)" stroke-width="6.5" stroke-linecap="round"/>
    <path d="M37.5 37.5 50.5 50.5" stroke="#1a3f7a" stroke-width="1.2" stroke-linecap="round" opacity=".35"/>
    <path d="M38.2 38.2 49.2 49.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>
    <!-- highlight -->
    <path d="M18 16c7-6 24-7 33 3" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" opacity=".28"/>
  </g>
</svg>`;
}

export const ICONS = {
  get hd() { return hdSvg(); },
  get folder() { return folderSvg(); },
  get textfile() { return textfileSvg(); },
  get trash() { return trashSvg(false); },
  get trashFull() { return trashSvg(true); },
  get finder() { return finderIconSvg(); },
  get safari() { return safariIconSvg(); },
  get sysprefs() { return sysprefsIconSvg(); },
  get mail() { return mailIconSvg(); },
  get ichat() { return ichatIconSvg(); },
  get dashboard() { return dashboardIconSvg(); },
  get quicktime() { return quicktimeIconSvg(); },
};
