/**
 * ui.test.tsx — testy komponentów UI
 * Sprint I1
 */
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { TrendBadge, EmptyState, SortHeader } from '../components/ui';

// ── TrendBadge ────────────────────────────────────────────────
describe('TrendBadge', () => {
  it('renders positive trend with up arrow', () => {
    const view = render(<TrendBadge pct={15} />);
    expect(view.getByText(/↑.*15%/)).toBeTruthy();
  });

  it('renders negative trend with down arrow', () => {
    const view = render(<TrendBadge pct={-10} />);
    expect(view.getByText(/↓.*10%/)).toBeTruthy();
  });

  it('renders zero trend as neutral', () => {
    const view = render(<TrendBadge pct={0} />);
    expect(view.getByText(/0%/)).toBeTruthy();
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
    const view = render(<EmptyState icon="📭" title="Brak danych" />);
    expect(view.getByText('Brak danych')).toBeTruthy();
    expect(view.getByText('📭')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const view = render(<EmptyState icon="📭" title="Tytuł" sub="Podtytuł" />);
    expect(view.getByText('Podtytuł')).toBeTruthy();
  });

  it('renders action slot', () => {
    const view = render(<EmptyState icon="📭" title="T" action={<button>Akcja</button>} />);
    expect(view.getByRole('button', { name: 'Akcja' })).toBeTruthy();
  });

  it('renders custom illustration instead of icon', () => {
    const view = render(<EmptyState title="T" illustration={<svg data-testid="custom-svg" />} />);
    expect(view.getByTestId('custom-svg')).toBeTruthy();
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
    expect(container.textContent).toContain('Imię');
    expect(container.textContent).toContain('↕');
  });

  it('shows ↑ when sorted asc', () => {
    const sort = { field: 'name', dir: 'asc' as const };
    const view = render(
      <table><thead><tr>
        <SortHeader field="name" sort={sort} onToggle={() => {}}>Imię</SortHeader>
      </tr></thead></table>
    );
    expect(view.getByText('↑')).toBeTruthy();
  });

  it('shows ↓ when sorted desc', () => {
    const sort = { field: 'name', dir: 'desc' as const };
    const view = render(
      <table><thead><tr>
        <SortHeader field="name" sort={sort} onToggle={() => {}}>Imię</SortHeader>
      </tr></thead></table>
    );
    expect(view.getByText('↓')).toBeTruthy();
  });
});