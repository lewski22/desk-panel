/**
 * ui.test.tsx — testy komponentów UI
 * Sprint I1
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { TrendBadge, EmptyState, SortHeader } from '../components/ui';

// ── TrendBadge ────────────────────────────────────────────────
describe('TrendBadge', () => {
  it('renders positive trend with up arrow', () => {
    render(<TrendBadge pct={15} />);
    expect(screen.getByText(/↑.*15%/)).toBeTruthy();
  });

  it('renders negative trend with down arrow', () => {
    render(<TrendBadge pct={-10} />);
    expect(screen.getByText(/↓.*10%/)).toBeTruthy();
  });

  it('renders zero trend as neutral', () => {
    render(<TrendBadge pct={0} />);
    expect(screen.getByText(/0%/)).toBeTruthy();
  });

  it('applies emerald color for positive', () => {
    const { container } = render(<TrendBadge pct={5} />);
    expect(container.querySelector('.text-emerald-600')).toBeTruthy();
  });

  it('applies red color for negative', () => {
    const { container } = render(<TrendBadge pct={-5} />);
    expect(container.querySelector('.text-red-500')).toBeTruthy();
  });
});

// ── EmptyState ────────────────────────────────────────────────
describe('EmptyState', () => {
  it('renders title and icon', () => {
    render(<EmptyState icon="📭" title="Brak danych" />);
    expect(screen.getByText('Brak danych')).toBeTruthy();
    expect(screen.getByText('📭')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    render(<EmptyState icon="📭" title="Tytuł" sub="Podtytuł" />);
    expect(screen.getByText('Podtytuł')).toBeTruthy();
  });

  it('renders action slot', () => {
    render(<EmptyState icon="📭" title="T" action={<button>Akcja</button>} />);
    expect(screen.getByRole('button', { name: 'Akcja' })).toBeTruthy();
  });

  it('renders custom illustration instead of icon', () => {
    render(<EmptyState title="T" illustration={<svg data-testid="custom-svg" />} />);
    expect(screen.getByTestId('custom-svg')).toBeTruthy();
  });
});

// ── SortHeader ────────────────────────────────────────────────
describe('SortHeader', () => {
  it('renders children and neutral arrow when not sorted', () => {
    const sort = { field: null, dir: 'asc' as const };
    const { container } = render(
      <table><thead><tr>
        <SortHeader field="name" sort={sort} onToggle={() => {}}>Imię</SortHeader>
      </tr></thead></table>
    );
    expect(screen.getByText('Imię')).toBeTruthy();
    expect(screen.getByText('↕')).toBeTruthy();
  });

  it('shows ↑ when sorted asc', () => {
    const sort = { field: 'name', dir: 'asc' as const };
    render(
      <table><thead><tr>
        <SortHeader field="name" sort={sort} onToggle={() => {}}>Imię</SortHeader>
      </tr></thead></table>
    );
    expect(screen.getByText('↑')).toBeTruthy();
  });

  it('shows ↓ when sorted desc', () => {
    const sort = { field: 'name', dir: 'desc' as const };
    render(
      <table><thead><tr>
        <SortHeader field="name" sort={sort} onToggle={() => {}}>Imię</SortHeader>
      </tr></thead></table>
    );
    expect(screen.getByText('↓')).toBeTruthy();
  });
});
