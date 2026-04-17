/**
 * RecurringToggle — Sprint I
 * Testy komponentu wyboru cyklu rezerwacji
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render }                                from '@testing-library/react';
import { RecurringToggle }                        from '../components/reservations/RecurringToggle';

describe('RecurringToggle', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => mockOnChange.mockClear());

  it('renders all preset buttons', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    expect(view.getByText('recurring.none')).toBeInTheDocument();
    expect(view.getByText('recurring.daily')).toBeInTheDocument();
    expect(view.getByText('recurring.weekly')).toBeInTheDocument();
  });

  it('calls onChange with enabled=false when "none" selected', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.none').click();
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, rule: '' }));
  });

  it('calls onChange with enabled=true when weekly selected', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.weekly').click();
    expect(mockOnChange).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }));
    expect(mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]?.[0].rule).toMatch(/FREQ=WEEKLY/);
  });

  it('shows date preview when a recurrence rule is active', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.daily').click();
    expect(view.getByText(/recurring\.preview/)).toBeInTheDocument();
  });

  it('shows custom builder when "custom" selected', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.custom').click();
    expect(view.getByText('recurring.days_of_week')).toBeInTheDocument();
    expect(view.getByText('recurring.count')).toBeInTheDocument();
  });

  it('custom builder: count increments', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.custom').click();
    view.getByText('+').click();
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]?.[0];
    expect(lastCall?.rule).toMatch(/COUNT=5/);
  });

  it('custom builder: selecting weekday includes it in BYDAY', () => {
    const view = render(<RecurringToggle startDate="2026-04-21" onChange={mockOnChange} />);
    view.getByText('recurring.custom').click();
    view.getByText('Pn').click();
    const lastCall = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1]?.[0];
    expect(lastCall?.rule).toMatch(/BYDAY=MO/);
  });
});
