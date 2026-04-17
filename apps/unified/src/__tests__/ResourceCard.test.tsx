/**
 * ResourceCard — Sprint I
 * Testy karty zasobu (sala/parking/sprzęt)
 */
import { describe, it, expect, vi } from 'vitest';
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
    expect(view.getByText(/resource\.book/)).toBeInTheDocument();
  });

  it('calls onBook when book button clicked', () => {
    const onBook = vi.fn();
    const view = render(<ResourceCard resource={makeResource()} onBook={onBook} />);
    view.getByText(/resource\.book/).click();
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('does not show book button when compact=true', () => {
    const onBook = vi.fn();
    const view = render(<ResourceCard resource={makeResource()} onBook={onBook} compact />);
    expect(view.queryByText(/resource\.book/)).not.toBeInTheDocument();
  });

  it('shows inactive badge for inactive resources', () => {
    const view = render(<ResourceCard resource={makeResource({ status: 'INACTIVE' })} />);
    expect(view.getByText(/resource\.status\.inactive/)).toBeInTheDocument();
  });

  it('renders parking type with vehicleType', () => {
    const view = render(<ResourceCard resource={makeResource({ type: 'PARKING', vehicleType: 'car', capacity: undefined, amenities: [] })} />);
    expect(view.getByText(/car/i)).toBeInTheDocument();
  });
});