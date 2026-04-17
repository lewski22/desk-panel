/**
 * RecurringToggle — Sprint I
 * Testy komponentu wyboru cyklu rezerwacji
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent }             from '@testing-library/react';
import { RecurringToggle }                        from '../components/reservations/RecurringToggle';

describe('RecurringToggle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => mockOnChange.mockClear());

  it('renders all preset buttons', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    expect(screen.getByText('recurring.none')).toBeInTheDocument();
    expect(screen.getByText('recurring.daily')).toBeInTheDocument();
    expect(screen.getByText('recurring.weekly')).toBeInTheDocument();
  });

  it('calls onChange with enabled=false when "none" selected', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.none'));
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, rule: '' }));
  });

  it('calls onChange with enabled=true when weekly selected', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.weekly'));
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockOnChange.mock.calls.at(-1)?.[0].rule).toMatch(/FREQ=WEEKLY/);
  });

  it('shows date preview when a recurrence rule is active', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.daily'));
    expect(screen.getByText(/recurring\.preview/)).toBeInTheDocument();
  });

  it('shows custom builder when "custom" selected', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.custom'));
    // Custom builder should appear
    expect(screen.getByText('recurring.days_of_week')).toBeInTheDocument();
    expect(screen.getByText('recurring.count')).toBeInTheDocument();
  });

  it('custom builder: count increments', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.custom'));
    const plusBtn = screen.getByText('+');
    fireEvent.click(plusBtn);
    // Rule should contain COUNT=5 (default 4 + 1)
    const lastCall = mockOnChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.rule).toMatch(/COUNT=5/);
  });

  it('custom builder: selecting weekday includes it in BYDAY', () => {
    render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    fireEvent.click(screen.getByText('recurring.custom'));
    fireEvent.click(screen.getByText('Pn')); // Monday
    const lastCall = mockOnChange.mock.calls.at(-1)?.[0];
    expect(lastCall?.rule).toMatch(/BYDAY=MO/);
  });
});
