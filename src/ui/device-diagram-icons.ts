/** Inline SVG icons for PC admin → phone AR diagrams (not emoji). */

export function pcAdminDiagramIconHtml(): string {
  return `<svg class="diagram-icon diagram-icon-pc" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect x="6" y="10" width="52" height="34" rx="4" fill="rgba(34,211,238,0.12)" stroke="currentColor" stroke-width="2.5"/>
    <rect x="12" y="16" width="40" height="22" rx="2" fill="rgba(15,23,42,0.92)" stroke="rgba(148,163,184,0.35)" stroke-width="1"/>
    <rect x="28" y="46" width="8" height="6" rx="1" fill="currentColor" opacity="0.8"/>
    <rect x="18" y="52" width="28" height="4" rx="2" fill="currentColor" opacity="0.5"/>
    <rect x="14" y="58" width="36" height="3" rx="1.5" fill="currentColor" opacity="0.35"/>
    <circle cx="32" cy="27" r="2.5" fill="#22d3ee"/>
  </svg>`;
}

export function phoneArDiagramIconHtml(): string {
  return `<svg class="diagram-icon diagram-icon-phone" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
    <rect x="20" y="6" width="24" height="52" rx="5" fill="rgba(45,212,191,0.12)" stroke="currentColor" stroke-width="2.5"/>
    <rect x="24" y="14" width="16" height="34" rx="2" fill="rgba(15,23,42,0.9)"/>
    <circle cx="32" cy="52" r="2.5" fill="currentColor" opacity="0.7"/>
    <path d="M28 38 L32 42 L38 32" stroke="#2dd4bf" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>`;
}
