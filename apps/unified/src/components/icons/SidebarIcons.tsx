/**
 * SidebarIcons — Noun Project inspired SVG icon set
 *
 * Rules:
 *  - 24×24 viewBox, fill=currentColor throughout (no hardcoded colours)
 *  - Solid silhouettes; negative-space detail via fillRule="evenodd"
 *  - All geometric features ≥ 2 units wide so they stay visible at 16 px
 *  - No external dependencies
 */
import React from 'react';

type P = { className?: string; size?: number };

/** Factory — wraps any JSX in a sized currentColor SVG */
function icon(nodes: React.ReactNode) {
  return ({ className, size = 16 }: P) => (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {nodes}
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// WORKSPACE
// ─────────────────────────────────────────────────────────────

/**
 * Floor plan — rectangular room with three desk-square cutouts.
 * Used for: Desk Map
 */
export const IconFloorPlan = icon(
  <path
    fillRule="evenodd"
    d="M2 3h20v18H2V3zm2 2v14h16V5H4zM5 7h6v5H5V7zm8 0h6v5h-6V7zM5 14h6v4H5v-4z"
  />
);

/**
 * Calendar — block with hanging rings, header separator and five day squares.
 * Used for: Weekly View
 */
export const IconCalendar = icon(
  <>
    <rect x="7"    y="1" width="2.5" height="5" rx="1.25" />
    <rect x="14.5" y="1" width="2.5" height="5" rx="1.25" />
    <path
      fillRule="evenodd"
      d="M3 4h18v17a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6.5h18V12H3v-1.5zM5 13h3v3H5v-3zm5.5 0h3v3h-3v-3zM16 13h3v3h-3v-3zM5 18h3v2H5v-2zm5.5 0h3v2h-3v-2z"
    />
  </>
);

/**
 * Clipboard — board with clip bar and three text-line cutouts.
 * Used for: My Reservations
 */
export const IconClipboard = icon(
  <>
    <rect x="8" y="1" width="8" height="4" rx="1.5" />
    <path
      fillRule="evenodd"
      d="M4 4h16v18H4V4zm3 6h10v1.5H7V10zm0 4h10v1.5H7V14zm0 4h7v1.5H7V18z"
    />
  </>
);

/**
 * Open folder — tab + body.
 * Used for: Reservations (admin view)
 */
export const IconFolder = icon(
  <path d="M3 7a2 2 0 012-2h4l2 2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
);

/**
 * Desk — overhead view: desk rectangle + chair back bar + seat arc.
 * Used for: Desks management
 */
export const IconDesk = icon(
  <>
    <rect x="3"  y="5" width="18" height="10" rx="1.5" />
    <rect x="7"  y="3" width="10" height="2"  rx="1" />
    {/* Chair seat — arc below desk, drawn as a filled half-ellipse */}
    <path d="M7 15h10a5 5 0 01-10 0z" />
  </>
);

/**
 * Users — two person silhouettes (head circle + body half-ellipse).
 * Used for: Users
 */
export const IconUsers = icon(
  <>
    <circle cx="8"  cy="7" r="3.5" />
    <path d="M1 20c0-3.866 3.134-7 7-7s7 3.134 7 7H1z" />
    <circle cx="17" cy="7" r="2.8" />
    <path d="M12.5 20c0-3.038 1.938-5.635 4.647-6.626A6.23 6.23 0 0123 20h-10.5z" />
  </>
);

// ─────────────────────────────────────────────────────────────
// MANAGEMENT
// ─────────────────────────────────────────────────────────────

/**
 * Beacon — rounded square device + three upward wifi arcs (stroke).
 * Used for: Devices
 */
export const IconBeacon = icon(
  <>
    <rect x="8" y="14" width="8" height="7" rx="2" />
    {/* Arc 1 — innermost, r=3 centred at (12,14) */}
    <path d="M9 13A3 3 0 0115 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Arc 2 — r=5 */}
    <path d="M7 11A5 5 0 0117 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    {/* Arc 3 — outermost, r=7 */}
    <path d="M5 9A7 7 0 0119 9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </>
);

/**
 * Provisioning / antenna — vertical pole + four widening signal bars.
 * Used for: Provisioning
 */
export const IconProvisioning = icon(
  <>
    <rect x="11"   y="12" width="2"  height="10" rx="1" />
    <rect x="10"   y="10" width="4"  height="1.5" rx="0.75" />
    <rect x="8.5"  y="7.5" width="7"  height="1.5" rx="0.75" />
    <rect x="6.5"  y="5"  width="11" height="1.5" rx="0.75" />
    <rect x="4.5"  y="2.5" width="15" height="1.5" rx="0.75" />
  </>
);

/**
 * Building — facade with two window cutouts and a centred door cutout.
 * Used for: Resources / Rooms
 */
export const IconRoom = icon(
  <path
    fillRule="evenodd"
    d="M3 5h18v17H3V5zm2 2v13h14V7H5zm2 1h4v5H7V8zm8 0h2v5h-2V8zM10 17h4v5h-4v-5z"
  />
);

/**
 * Visitor — person silhouette with a plus sign to the right.
 * Used for: Visitors
 */
export const IconVisitor = icon(
  <>
    <circle cx="9" cy="7" r="3.5" />
    <path d="M2 20c0-3.866 3.134-7 7-7s7 3.134 7 7H2z" />
    <rect x="18" y="10" width="2" height="8" rx="1" />
    <rect x="15" y="13" width="8" height="2" rx="1" />
  </>
);

// ─────────────────────────────────────────────────────────────
// ANALYTICS
// ─────────────────────────────────────────────────────────────

/**
 * Bar chart — three vertical bars + baseline.
 * Used for: Dashboard
 */
export const IconBarChart = icon(
  <>
    <rect x="2"  y="20" width="20" height="2"  rx="1" />
    <rect x="3"  y="12" width="5"  height="8"  rx="1" />
    <rect x="9.5"  y="6"  width="5"  height="14" rx="1" />
    <rect x="16" y="9"  width="5"  height="11" rx="1" />
  </>
);

/**
 * Pie chart — full circle with one triangular wedge removed (evenodd).
 * Used for: Reports
 */
export const IconPieChart = icon(
  <path
    fillRule="evenodd"
    d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2c4.418 0 8 3.582 8 8s-3.582 8-8 8-8-3.582-8-8 3.582-8 8-8zm0 0v8l5.657-5.657A7.962 7.962 0 0012 4z"
  />
);

/**
 * Trend line chart — axes + polyline with data-point dots.
 * Alternative for Reports when a line chart better matches the content.
 */
export const IconTrendChart = icon(
  <>
    <rect x="2"  y="20" width="20" height="1.5" rx="0.75" />
    <rect x="2"  y="3"  width="1.5" height="17" rx="0.75" />
    <path
      d="M4 16 L8 10 L12 14 L16 7 L20 9"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="4"  cy="16" r="1.5" />
    <circle cx="8"  cy="10" r="1.5" />
    <circle cx="12" cy="14" r="1.5" />
    <circle cx="16" cy="7"  r="1.5" />
    <circle cx="20" cy="9"  r="1.5" />
  </>
);

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────

/**
 * Buildings — tall building (left, evenodd windows) + shorter one (right).
 * Used for: Organizations
 */
export const IconBuildings = icon(
  <>
    <path
      fillRule="evenodd"
      d="M2 22V4h11v18H2zm2-2h7V6H4v14zM5 8h2v3H5V8zm4 0h2v3H9V8zm-4 5h2v3H5v-3zm4 0h2v3H9v-3zM7 18h2v4H7v-4z"
    />
    <path
      fillRule="evenodd"
      d="M14 22V10h8v12h-8zm2-2h4V12h-4v8zm1-6h2v2h-2v-2zm0 4h2v2h-2v-2z"
    />
  </>
);

/**
 * Chain link — two interlocked oval rings.
 * Used for: Integrations
 */
export const IconLink = icon(
  <>
    {/* Left ring */}
    <path d="M9.172 14.828a4 4 0 010-5.656l3-3a4 4 0 015.656 5.656l-1.5 1.5-1.414-1.414 1.5-1.5a2 2 0 00-2.828-2.828l-3 3a2 2 0 000 2.828l.707.707-1.414 1.414-.707-.707z" />
    {/* Right ring */}
    <path d="M14.828 9.172a4 4 0 010 5.656l-3 3a4 4 0 01-5.656-5.656l1.5-1.5 1.414 1.414-1.5 1.5a2 2 0 002.828 2.828l3-3a2 2 0 000-2.828l-.707-.707 1.414-1.414.707.707z" />
  </>
);

/**
 * Bell — dome body + hanger nub + clapper circle.
 * Used for: Notifications
 */
export const IconBell = icon(
  <>
    <rect x="10.5" y="1" width="3" height="2.5" rx="1.25" />
    <path d="M12 3.5A7.5 7.5 0 004.5 11v5l-2 2v.5h19V18l-2-2v-5A7.5 7.5 0 0012 3.5z" />
    <path
      fillRule="evenodd"
      d="M9.5 21.5a2.5 2.5 0 005 0h-5z"
    />
  </>
);

/**
 * Credit card — rounded rectangle + chip square cutout + stripe band cutout.
 * Used for: Subscription
 */
export const IconCard = icon(
  <path
    fillRule="evenodd"
    d="M2 7a2.5 2.5 0 012.5-2.5h15A2.5 2.5 0 0122 7v10a2.5 2.5 0 01-2.5 2.5h-15A2.5 2.5 0 012 17V7zm2.5 10.5h15A.5.5 0 0020 17V10H4v7a.5.5 0 00.5.5zM4 8.5h16V7a.5.5 0 00-.5-.5h-15A.5.5 0 004 7v1.5zM6 13h4v2H6v-2zm7 0h1.5v2H13v-2zm3 0h2v2h-2v-2z"
  />
);

// ─────────────────────────────────────────────────────────────
// OPERATOR
// ─────────────────────────────────────────────────────────────

/**
 * Gear / cog — outer toothed ring + inner circle cutout.
 * Uses an 8-tooth shape: outer polygon + central hole via evenodd.
 * Used for: Owner / Settings
 */
export const IconGear = icon(
  <path
    fillRule="evenodd"
    d="M12 1l1.68 2.908 3.217-.548.84 3.1 2.855 1.368-.84 3.1L22 13l-2.248 2.072.84 3.1-2.855 1.368-.84 3.1-3.217-.548L12 25l-1.68-2.908-3.217.548-.84-3.1-2.855-1.368.84-3.1L2 13l2.248-2.072-.84-3.1 2.855-1.368.84-3.1 3.217.548L12 1zm0 6a6 6 0 100 12A6 6 0 0012 7zm0 2a4 4 0 110 8 4 4 0 010-8z"
  />
);

// ─────────────────────────────────────────────────────────────
// BOTTOM BAR
// ─────────────────────────────────────────────────────────────

/**
 * Key — oval bow + long shaft + two teeth.
 * Used for: Change Password
 */
export const IconKey = icon(
  <path
    fillRule="evenodd"
    d="M7.5 4a5.5 5.5 0 100 11A5.5 5.5 0 007.5 4zm0 2a3.5 3.5 0 110 7 3.5 3.5 0 010-7zm3.5 2.5h10v2.5H17v3h-2.5v-3H11V8.5zM7.5 7.5a2 2 0 110 4 2 2 0 010-4z"
  />
);

/**
 * Logout — open-right rectangle (door frame) + rightward arrow.
 * Used for: Logout
 */
export const IconLogout = icon(
  <>
    <path d="M10 5H5a1 1 0 00-1 1v12a1 1 0 001 1h5v-2H6V7h4V5z" />
    <rect x="9"  y="11" width="10" height="2" rx="1" />
    <path d="M17 8l4.5 4-4.5 4V8z" />
  </>
);

/**
 * Globe — circle + two latitude lines + meridian arc.
 * Used for: Language Switcher
 */
export const IconGlobe = icon(
  <path
    fillRule="evenodd"
    d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2c.87 0 2.1 1.7 2.85 4H9.15C9.9 5.7 11.13 4 12 4zm-3.25 6a14.9 14.9 0 000 4h6.5a14.9 14.9 0 000-4H8.75zM9.15 16c.75 2.3 1.98 4 2.85 4s2.1-1.7 2.85-4H9.15zm-3.33 0H3.34A9.966 9.966 0 002 12a9.966 9.966 0 001.34-4h2.48a16.9 16.9 0 000 8zm11.36 0a16.9 16.9 0 000-8h2.48A9.966 9.966 0 0122 12a9.966 9.966 0 01-1.34 4h-2.48zM3.34 8h2.48a16.9 16.9 0 000-4 9.97 9.97 0 00-2.48 4zm15.34 0h2.48a9.97 9.97 0 00-2.48-4 16.9 16.9 0 000 4z"
  />
);

/**
 * Map pin / location teardrop — used for location/office indicators.
 */
export const IconPin = icon(
  <path
    fillRule="evenodd"
    d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"
  />
);

/**
 * Clock — circle ring + hour hand + minute hand.
 * Used for: Timezone settings
 */
export const IconClock = icon(
  <>
    <path
      fillRule="evenodd"
      d="M12 2a10 10 0 100 20A10 10 0 0012 2zm0 2a8 8 0 110 16A8 8 0 0112 4z"
    />
    <rect x="11" y="7" width="2" height="6" rx="1" />
    <rect
      x="11" y="12" width="5" height="2" rx="1"
      transform="rotate(-30 12 13)"
    />
  </>
);
