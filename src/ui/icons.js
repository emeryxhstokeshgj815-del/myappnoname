// Hand-made 24px stroke icons (currentColor).
const S = (d, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;

export const ICONS = {
  learn: S('<path d="M4 19V6a2 2 0 0 1 2-2h11l3 3v12a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2z"/><path d="M8 9h8M8 13h6"/>'),
  play: S('<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>'),
  library: S('<path d="M4 4h4v16H4zM10 4h4v16h-4z"/><path d="m16 5 3.5-.8 2 15.6-3.5.8z"/>'),
  progress: S('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  settings: S('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  close: S('<path d="M18 6 6 18M6 6l12 12"/>'),
  back: S('<path d="M15 18 9 12l6-6"/>'),
  next: S('<path d="m9 18 6-6-6-6"/>'),
  check: S('<path d="M20 6 9 17l-5-5"/>'),
  cross: S('<path d="M18 6 6 18M6 6l12 12"/>'),
  soundOn: S('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  soundOff: S('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="m22 9-6 6M16 9l6 6"/>'),
  hint: S('<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/>'),
  flame: S('<path d="M12 22c4 0 7-2.8 7-7 0-3.5-2.3-6.2-4-8 0 2.6-1.2 4-3 4 .5-3-1-6-4-9 0 4-4 6.5-4 12 0 4.5 3.5 8 8 8z"/>'),
  star: S('<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  heart: S('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>'),
  heartFill: S('<path fill="currentColor" d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21.2l8.8-8.8a5.5 5.5 0 0 0 0-7.8z"/>'),
  search: S('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  speaker: S('<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>'),
  replay: S('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>'),
  slow: S('<path d="M3 17c0-5 4-9 9-9s9 4 9 9"/><path d="M12 17l4-5"/>'),
  clock: S('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  download: S('<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'),
  upload: S('<path d="M12 21V9M7 14l5-5 5 5M4 3h16"/>'),
  trash: S('<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>'),
  info: S('<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>'),
  target: S('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  crown: S('<path d="m3 8 4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>'),
  lab: S('<path d="M9 3h6M10 3v6L4.5 18.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7 15h10"/>'),
  sliders: S('<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>'),
  sparkle: S('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  plus: S('<path d="M12 5v14M5 12h14"/>'),
};

// Achievement badge glyphs (drawn inside a round badge).
export const BADGES = {
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/>',
  stack: '<rect x="5" y="4" width="14" height="4" rx="1"/><rect x="5" y="10" width="14" height="4" rx="1"/><rect x="5" y="16" width="14" height="4" rx="1"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="m9 15 2 2 4-4"/>',
  calendar2: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M12 14h2M16 14h0M8 17h2M12 17h2"/>',
  flame: '<path d="M12 21c3.5 0 6-2.4 6-6 0-3-2-5.3-3.4-6.8 0 2.2-1 3.4-2.6 3.4.4-2.6-.9-5.2-3.4-7.6 0 3.4-3.6 5.6-3.6 10.2 0 3.9 3.1 6.8 7 6.8z"/>',
  flame2: '<path d="M12 21c3.5 0 6-2.4 6-6 0-3-2-5.3-3.4-6.8 0 2.2-1 3.4-2.6 3.4.4-2.6-.9-5.2-3.4-7.6 0 3.4-3.6 5.6-3.6 10.2 0 3.9 3.1 6.8 7 6.8z"/><path d="M12 18c1.4 0 2.4-1 2.4-2.4 0-1.2-.8-2.1-1.4-2.7 0 .9-.4 1.4-1 1.4.2-1-.4-2.1-1.4-3 0 1.4-1.4 2.2-1.4 4 0 1.6 1.2 2.7 2.8 2.7z"/>',
  keys: '<rect x="3" y="7" width="18" height="11" rx="2"/><path d="M7 11h0M11 11h0M15 11h0M8 14h8"/>',
  keys2: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 9h0M11 9h0M15 9h0M7 12h0M11 12h0M15 12h0M8 15h8"/>',
  hourglass: '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9"/>',
  pillar: '<path d="M4 21h16M6 18h12M7 18V8M11 18V8M13 18V8M17 18V8M4 8h16L12 3z"/>',
  sprout: '<path d="M12 21v-9"/><path d="M12 12c0-4 3-6 7-6 0 4-3 6-7 6z"/><path d="M12 14c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
  tree: '<path d="M12 22v-6"/><path d="M12 3 6 11h3l-4 5h14l-4-5h3z"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.3 5.3L4 17l3 3 5.2-5.2a4 4 0 0 0 5.3-5.3l-2.5 2.5-2.5-2.5z"/>',
  grid: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  crown: '<path d="m4 8 4 3.5L12 5l4 6.5L20 8l-1.8 10H5.8z"/>',
  check: '<circle cx="12" cy="12" r="8"/><path d="m8 12 3 3 5-6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  scales: '<path d="M12 4v16M7 20h10M5 7h14M5 7l-3 6h6zM19 7l-3 6h6z"/>',
  pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
  tree2: '<circle cx="12" cy="5" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/><path d="M12 7v9M12 11H6v5M12 11h6v5"/>',
  ear: '<path d="M8 9a4 4 0 0 1 8 0c0 3-3 3.5-3 7a3 3 0 0 1-5 2"/><path d="M11 9.5a1.5 1.5 0 0 1 3 0"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M9 7h6"/>',
  medal: '<circle cx="12" cy="15" r="5"/><path d="M8.5 3 12 10l3.5-7M12 13v4"/>',
  star: '<path d="m12 4 2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 16.3l-4.8 2.6.9-5.4-3.9-3.8 5.4-.8z"/>',
  door: '<path d="M6 21V4h9v17"/><path d="M15 6h3v15M4 21h16M12 12h0"/>',
};

export function badgeSvg(key, unlocked) {
  const glyph = BADGES[key] || BADGES.star;
  return `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
    <circle cx="24" cy="24" r="22" class="badge-bg ${unlocked ? 'on' : 'off'}"/>
    <circle cx="24" cy="24" r="17.5" class="badge-ring ${unlocked ? 'on' : 'off'}" fill="none" stroke-width="1.5"/>
    <g transform="translate(12 12)" fill="none" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" class="badge-glyph ${unlocked ? 'on' : 'off'}">${glyph}</g>
  </svg>`;
}
