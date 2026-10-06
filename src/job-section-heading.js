// Shared marks only: the At a glance airplane remains unique.
export function sectionHeadingMarks(label) {
  return `<svg class="qr-glance-sparks" viewBox="0 0 18 26" aria-hidden="true" focusable="false"><path d="m9 3 3 5M3 11l6 2M3 22l6-4"/></svg>${label}<svg class="qr-glance-underline" viewBox="0 0 140 8" aria-hidden="true" focusable="false"><path d="M3 5Q58 1 137 4M103 7l22-1"/></svg>`;
}
