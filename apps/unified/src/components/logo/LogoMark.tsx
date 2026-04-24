/**
 * LogoMark.tsx
 *
 * Usage:
 *   <LogoMark />                         — default 40px, brand color
 *   <LogoMark size={24} />               — 24px
 *   <LogoMark size={32} pulse />         — 32px with animated ring (hero)
 *   <LogoMark size={20} status="free" /> — status-aware (color = desk status)
 */

import React from 'react';

type DeskStatus = 'free' | 'reserved' | 'occupied' | 'mine' | 'offline';

interface LogoMarkProps {
  size?: number;
  color?: string;
  status?: DeskStatus;
  pulse?: boolean;
  className?: string;
}

const STATUS_COLORS: Record<DeskStatus, string> = {
  free:     '#10B981',
  reserved: '#F59E0B',
  occupied: '#EF4444',
  mine:     '#9C2264',
  offline:  '#71717A',
};

const BRAND = '#9C2264';

export function LogoMark({
  size = 40,
  color,
  status,
  pulse = false,
  className,
}: LogoMarkProps) {
  const bgColor   = color ?? (status ? STATUS_COLORS[status] : BRAND);
  const showPulse = pulse || status === 'free' || status === 'mine';
  const isOffline = status === 'offline';

  const r  = size;
  const cx = r * 0.312;
  const cy = r * 0.500;
  const dr = r * 0.062;

  const ax  = r * 0.450;
  const i1  = r * 0.300;
  const i2  = r * 0.200;
  const i3  = r * 0.050;
  const cx1 = r * 0.700;
  const cx2 = r * 0.820;
  const cx3 = r * 0.980;
  const rx  = r * 0.225;

  const pulseRingR = dr * 2.2;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label={status ? `Beacon ${status}` : 'Reserti'}
      role="img"
    >
      <rect width={size} height={size} rx={rx} fill={bgColor} />

      {showPulse && (
        <circle cx={cx} cy={cy} r={pulseRingR} fill="none" stroke="white" strokeWidth="0.8">
          <animate attributeName="r"       values={`${pulseRingR};${pulseRingR * 2.2}`} dur="2s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.55;0"                               dur="2s" repeatCount="indefinite"/>
        </circle>
      )}

      <circle cx={cx} cy={cy} r={dr} fill="white" opacity={isOffline ? 0.5 : 1}/>

      <path
        d={`M${ax} ${cy - i1} Q${cx1} ${cy - i1} ${cx1} ${cy} Q${cx1} ${cy + i1} ${ax} ${cy + i1}`}
        fill="none"
        stroke="white"
        strokeWidth={size * 0.055}
        strokeLinecap="round"
        opacity={isOffline ? 0.35 : 0.95}
      />

      <path
        d={`M${ax} ${cy - i1 - i2} Q${cx2} ${cy - i1 - i2} ${cx2} ${cy} Q${cx2} ${cy + i1 + i2} ${ax} ${cy + i1 + i2}`}
        fill="none"
        stroke="white"
        strokeWidth={size * 0.035}
        strokeLinecap="round"
        opacity={isOffline ? 0.2 : 0.50}
      />

      {size >= 24 && (
        <path
          d={`M${ax} ${cy - i1 - i2 - i3} Q${cx3} ${cy - i1 - i2 - i3} ${cx3} ${cy} Q${cx3} ${cy + i1 + i2 + i3} ${ax} ${cy + i1 + i2 + i3}`}
          fill="none"
          stroke="white"
          strokeWidth={size * 0.022}
          strokeLinecap="round"
          opacity={isOffline ? 0.12 : 0.22}
        />
      )}

      {isOffline && (
        <>
          <line
            x1={size * 0.72} y1={size * 0.72}
            x2={size * 0.88} y2={size * 0.88}
            stroke="white" strokeWidth={size * 0.055} strokeLinecap="round"
          />
          <line
            x1={size * 0.88} y1={size * 0.72}
            x2={size * 0.72} y2={size * 0.88}
            stroke="white" strokeWidth={size * 0.055} strokeLinecap="round"
          />
        </>
      )}
    </svg>
  );
}

// — Companion: full horizontal logo —

interface LogoProps {
  variant?: 'dark' | 'light' | 'mono';
  size?: number;
  className?: string;
}

export function Logo({ variant = 'light', size = 40, className }: LogoProps) {
  const textColor  = variant === 'light' ? '#1A0A2E' : 'white';
  const markColor  = variant === 'mono' ? 'rgba(255,255,255,0.18)' : BRAND;
  const fontSize   = size * 0.55;
  const gap        = size * 0.3;
  const width      = size + gap + fontSize * 4.2;

  return (
    <svg
      width={width}
      height={size}
      viewBox={`0 0 ${width} ${size}`}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Reserti"
      role="img"
    >
      <LogoMark size={size} color={markColor} />
      <text
        x={size + gap}
        y={size * 0.695}
        fontFamily="'Sora', 'Inter', system-ui, sans-serif"
        fontWeight="700"
        fontSize={fontSize}
        fill={textColor}
        letterSpacing="-0.5"
      >
        Reserti
      </text>
    </svg>
  );
}
