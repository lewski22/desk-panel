/**
 * useSortable.test.ts
 * Sprint I1
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act }      from '@testing-library/react';
import { useSortable }           from '../hooks/useSortable';
import { MemoryRouter }          from 'react-router-dom';
import React from 'react';

const wrapper = ({ children }: any) => React.createElement(MemoryRouter, {}, children);

describe('useSortable', () => {
  it('initialises with default field and dir', () => {
    const { result } = renderHook(() => useSortable('name', 'asc'), { wrapper });
    expect(result.current.sort.field).toBe('name');
    expect(result.current.sort.dir).toBe('asc');
  });

  it('toggle same field flips direction', () => {
    const { result } = renderHook(() => useSortable('name', 'asc'), { wrapper });
    act(() => result.current.toggle('name'));
    expect(result.current.sort.dir).toBe('desc');
    act(() => result.current.toggle('name'));
    expect(result.current.sort.dir).toBe('asc');
  });

  it('toggle different field resets to asc', () => {
    const { result } = renderHook(() => useSortable('name', 'asc'), { wrapper });
    act(() => result.current.toggle('date'));
    expect(result.current.sort.field).toBe('date');
    expect(result.current.sort.dir).toBe('asc');
  });

  it('sortArray sorts strings ascending', () => {
    const { result } = renderHook(() => useSortable('name', 'asc'), { wrapper });
    act(() => result.current.toggle('name'));
    act(() => result.current.toggle('name')); // back to asc after two toggles
    const items = [{ name: 'Bravo' }, { name: 'Alpha' }, { name: 'Charlie' }];
    const sorted = result.current.sortArray(items, (i) => i.name);
    expect(sorted.map(i => i.name)).toEqual(['Alpha', 'Bravo', 'Charlie']);
  });

  it('sortArray sorts strings descending', () => {
    const { result } = renderHook(() => useSortable('name', 'desc'), { wrapper });
    const items = [{ name: 'Bravo' }, { name: 'Alpha' }, { name: 'Charlie' }];
    const sorted = result.current.sortArray(items, (i) => i.name);
    expect(sorted.map(i => i.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });

  it('sortArray does not mutate original array', () => {
    const { result } = renderHook(() => useSortable('name', 'asc'), { wrapper });
    const original = [{ name: 'B' }, { name: 'A' }];
    const copy = [...original];
    result.current.sortArray(original, i => i.name);
    expect(original).toEqual(copy);
  });
});
