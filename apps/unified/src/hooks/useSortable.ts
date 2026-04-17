/**
 * useSortable — zarządzanie sortowaniem z URL state
 * Sprint A3 — sortowanie kolumn tabel z ?sort=field&dir=asc/desc
 */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type SortDir = 'asc' | 'desc';

export interface SortState {
  field: string | null;
  dir:   SortDir;
}

export function useSortable(defaultField?: string, defaultDir: SortDir = 'asc') {
  const [params, setParams] = useSearchParams();

  const sort: SortState = useMemo(() => ({
    field: params.get('sort') ?? defaultField ?? null,
    dir:   (params.get('dir') as SortDir) ?? defaultDir,
  }), [params, defaultField, defaultDir]);

  const toggle = useCallback((field: string) => {
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (prev.get('sort') === field) {
        next.set('dir', prev.get('dir') === 'asc' ? 'desc' : 'asc');
      } else {
        next.set('sort', field);
        next.set('dir', 'asc');
      }
      return next;
    }, { replace: true });
  }, [setParams]);

  /** Sortuje tablicę lokalnie (dla małych datasetów bez server-side sort) */
  const sortArray = useCallback(<T>(arr: T[], accessor: (item: T) => unknown): T[] => {
    if (!sort.field) return arr;
    return [...arr].sort((a, b) => {
      const va = accessor(a) ?? '';
      const vb = accessor(b) ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [sort]);

  return { sort, toggle, sortArray };
}
