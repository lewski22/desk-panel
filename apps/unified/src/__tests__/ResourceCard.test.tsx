/**
 * ResourceCard — Sprint I
 * Testy karty zasobu (sala/parking/sprzęt)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    render(<ResourceCard resource={makeResource()} />);
    expect(screen.getByText('Sala Alpha')).toBeInTheDocument();
    expect(screen.getByText('ROOM-A01')).toBeInTheDocument();
  });

  it('shows capacity for rooms', () => {
    render(<ResourceCard resource={makeResource()} />);
    expect(screen.getByText(/10/)).toBeInTheDocument();
  });

  it('shows amenities tags', () => {
    render(<ResourceCard resource={makeResource()} />);
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('whiteboard')).toBeInTheDocument();
  });

  it('shows book button when onBook is provided', () => {
    const onBook = vi.fn();
    render(<ResourceCard resource={makeResource()} onBook={onBook} />);
    expect(screen.getByText(/resource\.book/)).toBeInTheDocument();
  });

  it('calls onBook when book button clicked', () => {
    const onBook = vi.fn();
    render(<ResourceCard resource={makeResource()} onBook={onBook} />);
    fireEvent.click(screen.getByText(/resource\.book/));
    expect(onBook).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });

  it('does not show book button when compact=true', () => {
    const onBook = vi.fn();
    render(<ResourceCard resource={makeResource()} onBook={onBook} compact />);
    expect(screen.queryByText(/resource\.book/)).not.toBeInTheDocument();
  });

  it('shows inactive badge for inactive resources', () => {
    render(<ResourceCard resource={makeResource({ status: 'INACTIVE' })} />);
    expect(screen.getByText(/resource\.status\.inactive/)).toBeInTheDocument();
  });

  it('renders parking type with vehicleType', () => {
    render(<ResourceCard resource={makeResource({ type: 'PARKING', vehicleType: 'car', capacity: undefined, amenities: [] })} />);
    expect(screen.getByText(/car/i)).toBeInTheDocument();
  });
});
