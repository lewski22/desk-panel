/**
 * UsageBar.test.tsx — Sprint I (B spec test)
 * Kolory przy 0/70/90/100% + unlimited
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { UsageBar } from '../components/subscription/UsageBar';

describe('UsageBar', () => {
  it('renders label and count', () => {
    render(<UsageBar label="Biurka" used={5} limit={10} pct={50} />);
    expect(screen.getByText('Biurka')).toBeTruthy();
    expect(screen.getByText(/5.*10.*50%/)).toBeTruthy();
  });

  it('uses emerald bar color below 70%', () => {
    const { container } = render(<UsageBar label="X" used={5} limit={10} pct={50} />);
    expect(container.querySelector('.bg-emerald-500')).toBeTruthy();
  });

  it('uses amber bar color at 70–89%', () => {
    const { container } = render(<UsageBar label="X" used={7} limit={10} pct={70} />);
    expect(container.querySelector('.bg-amber-400')).toBeTruthy();
  });

  it('uses red bar color at 90%+', () => {
    const { container } = render(<UsageBar label="X" used={9} limit={10} pct={90} />);
    expect(container.querySelector('.bg-red-500')).toBeTruthy();
  });

  it('shows warning icon at 80%+', () => {
    render(<UsageBar label="X" used={8} limit={10} pct={80} />);
    expect(screen.getByText(/⚠/)).toBeTruthy();
  });

  it('does not show warning below 80%', () => {
    render(<UsageBar label="X" used={7} limit={10} pct={70} />);
    expect(screen.queryByText(/⚠/)).toBeFalsy();
  });

  it('renders unlimited when limit is null', () => {
    render(<UsageBar label="X" used={42} limit={null} pct={0} />);
    expect(screen.getByText(/42.*∞/)).toBeTruthy();
  });

  it('100% fills bar completely', () => {
    const { container } = render(<UsageBar label="X" used={10} limit={10} pct={100} />);
    const bar = container.querySelector('.bg-red-500') as HTMLElement;
    expect(bar?.style.width).toBe('100%');
  });
});
