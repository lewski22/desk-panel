/**
 * ResourceCard — Sprint I
 * Testy karty zasobu (sala/parking/sprzęt)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { ResourceCard } from '../components/desks/ResourceCard';

const makeResource = (overrides = {}) => ({
  id:         'r1',
  type:       'ROOM',
  name:       'Sala Alpha',
  code:       'ROOM-A01',
  status:     'ACTIVE',
  capacity:   10,
  amenities:  ['TV', 'whiteboard'],
  floor:      '2',
  zone:       'A',
  ...overrides,
});

describe('ResourceCard', () => {
  it('renders room name and code', () => {
    const view = render(<ResourceCard resource={makeResource()} />);
    expect(view.getByText('Sala Alpha')).toBeInTheDocument();
    expect(view.getByText('ROOM-A01')).toBeInTheDocument();
  });

  it('shows capacity for rooms', () => {
    const view = render(<ResourceCard resource={makeResource()} />);
    expect(view.getByText(/10/)).toBeInTheDocument();
  });

  it('shows amenities tags', () => {
    const view = render(<ResourceCard resource={makeResource()} />);
    expect(view.getByText('TV')).toBeInTheDocument();
    expect(view.getByText('whiteboard')).toBeInTheDocument();
  });

  it('shows book button when onBook is provided', () => {
    const onBook = vi.fn();
    const view = render(<ResourceCard resource={makeResource()} onBook={onBook} />);
    expect(view.getByText(/rooms\.pick_slot/)).toBeInTheDocument();
  });

  it('calls onBook when book button clicked', () => {
    const onBook = vi.fn();
    const view = render(<ResourceCard resource={makeResource()} onBook={onBook} />);
    view.getByText(/rooms\.pick_slot/).click();
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('does not show book button when compact=true', () => {
    const onBook = vi.fn();
    const view = render(<ResourceCard resource={makeResource()} onBook={onBook} compact />);
    expect(view.queryByText(/rooms\.pick_slot/)).not.toBeInTheDocument();
  });

  it('shows inactive badge for inactive resources', () => {
    const view = render(<ResourceCard resource={makeResource({ status: 'INACTIVE' })} />);
    expect(view.getByText(/resource\.status\.inactive/)).toBeInTheDocument();
  });

  it('renders parking type with vehicleType', () => {
    const view = render(<ResourceCard resource={makeResource({ type: 'PARKING', vehicleType: 'car', capacity: undefined, amenities: [] })} />);
    // Tabler ti-car icon rendered + translated vehicle label
    expect(view.container.querySelector('.ti-car')).toBeInTheDocument();
  });

  describe('parking assigned to other user', () => {
    beforeEach(() => localStorage.setItem('app_user', JSON.stringify({ id: 'user-current' })));
    afterEach(() => localStorage.removeItem('app_user'));

    it('shows assigned badge with lock icon', () => {
      const view = render(
        <ResourceCard
          resource={makeResource({ type: 'PARKING', assignedUserId: 'user-other', amenities: [] })}
          onBook={vi.fn()}
        />
      );
      expect(view.container.querySelector('.ti-lock')).toBeInTheDocument();
    });

    it('disables both CTA buttons', () => {
      const view = render(
        <ResourceCard
          resource={makeResource({ type: 'PARKING', assignedUserId: 'user-other', amenities: [] })}
          onBook={vi.fn()}
        />
      );
      const disabledButtons = view.getAllByRole('button').filter(b => b.hasAttribute('disabled'));
      expect(disabledButtons.length).toBe(2);
    });
  });
});
