// Single shared HTML escaping for every module that builds DOM through
// innerHTML / insertAdjacentHTML / outerHTML.
//
// Before this module existed the same 5-character replace was copy-pasted as
// `esc`, `escapeHtml` and `helpEscape` across apps, and two of the `esc`
// variants forgot the apostrophe. Import this one and route every interpolation
// of user or file content through `html()` so a data value can never turn into
// markup. Trusted icon/SVG strings do not need it.

const ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape a value for use as HTML text content (or a quoted attribute value). */
export function html(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ESCAPE_MAP[character]);
}

/** Alias for attribute contexts; identical character set keeps it simple. */
export const attr = html;
