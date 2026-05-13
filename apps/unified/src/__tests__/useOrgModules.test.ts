/**
 * useOrgModules.test.ts
 * Sprint I1 — moduł guard tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOrgModules } from '../hooks/useOrgModules';

describe('useOrgModules', () => {
  beforeEach(() => localStorage.clear());

  it('returns isEnabled=true for all when no user in localStorage', () => {
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('DESKS')).toBe(true);
    expect(result.current.isEnabled('ROOMS')).toBe(true);
    expect(result.current.isEnabled('PARKING')).toBe(true);
  });

  it('OWNER role: isEnabled always true regardless of enabledModules', () => {
    localStorage.setItem('app_user', JSON.stringify({ role: 'OWNER', enabledModules: ['DESKS'] }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('ROOMS')).toBe(true);
  });

  it('SUPER_ADMIN: respects enabledModules like other non-OWNER roles', () => {
    // SUPER_ADMIN with a specific module list must be restricted (fixes the bypass bug)
    localStorage.setItem('app_user', JSON.stringify({ role: 'SUPER_ADMIN', enabledModules: ['DESKS'] }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('DESKS')).toBe(true);
    expect(result.current.isEnabled('PARKING')).toBe(false);
  });

  it('SUPER_ADMIN: empty enabledModules = all modules active (backward compat / legacy org)', () => {
    localStorage.setItem('app_user', JSON.stringify({ role: 'SUPER_ADMIN', enabledModules: [] }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('PARKING')).toBe(true);
    expect(result.current.isEnabled('ROOMS')).toBe(true);
  });

  it('empty enabledModules = all modules active (backward compat)', () => {
    localStorage.setItem('app_user', JSON.stringify({ role: 'OFFICE_ADMIN', enabledModules: [] }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('ROOMS')).toBe(true);
    expect(result.current.isEnabled('PARKING')).toBe(true);
    expect(result.current.isEnabled('FLOOR_PLAN')).toBe(true);
  });

  it('non-empty enabledModules restricts access', () => {
    localStorage.setItem('app_user', JSON.stringify({
      role: 'OFFICE_ADMIN', enabledModules: ['DESKS']
    }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('DESKS')).toBe(true);
    expect(result.current.isEnabled('ROOMS')).toBe(false);
    expect(result.current.isEnabled('PARKING')).toBe(false);
  });

  it('multiple modules in enabledModules', () => {
    localStorage.setItem('app_user', JSON.stringify({
      role: 'STAFF', enabledModules: ['DESKS', 'ROOMS']
    }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('DESKS')).toBe(true);
    expect(result.current.isEnabled('ROOMS')).toBe(true);
    expect(result.current.isEnabled('PARKING')).toBe(false);
    expect(result.current.isEnabled('WEEKLY_VIEW')).toBe(false);
  });

  it('BEACONS is disabled by default when not in enabledModules', () => {
    localStorage.setItem('app_user', JSON.stringify({
      role: 'SUPER_ADMIN', enabledModules: ['DESKS']
    }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('BEACONS')).toBe(false);
  });

  it('BEACONS is enabled when in enabledModules', () => {
    localStorage.setItem('app_user', JSON.stringify({
      role: 'SUPER_ADMIN', enabledModules: ['DESKS', 'BEACONS']
    }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('BEACONS')).toBe(true);
  });

  it('BEACONS active when enabledModules is empty (all modules = backward compat)', () => {
    localStorage.setItem('app_user', JSON.stringify({
      role: 'SUPER_ADMIN', enabledModules: []
    }));
    const { result } = renderHook(() => useOrgModules());
    expect(result.current.isEnabled('BEACONS')).toBe(true);
  });
});
