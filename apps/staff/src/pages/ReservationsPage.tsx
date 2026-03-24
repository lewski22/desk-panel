import React from 'react';
import { useReservations } from '../hooks';
import { ReservationList } from '../components/reservations/ReservationList';

export function ReservationsPage() {
  const { reservations, loading, error, refetch, cancel } = useReservations();

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          ⚠ {error}
        </div>
      )}
      <ReservationList
        reservations={reservations}
        loading={loading}
        onCancel={cancel}
        onRefresh={refetch}
      />
    </div>
  );
}
