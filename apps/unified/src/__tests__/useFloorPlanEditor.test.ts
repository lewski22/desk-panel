/**
 * useFloorPlanEditor.test.ts — reducer + hook tests
 * Sprint I1 — FloorPlan drag/undo/snap
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act }      from '@testing-library/react';
import { useFloorPlanEditor }   from '../components/floor-plan/useFloorPlanEditor';

const DESKS = [
  { id: 'd1', name: 'A-01', code: 'A-01', isOccupied: false, isOnline: true,
    status: 'ACTIVE', posX: 10, posY: 20, rotation: 0, width: 2, height: 1 },
  { id: 'd2', name: 'A-02', code: 'A-02', isOccupied: false, isOnline: true,
    status: 'ACTIVE', posX: null, posY: null, rotation: 0, width: 2, height: 1 },
] as any[];

const FP = { floorPlanUrl: null, floorPlanW: 1200, floorPlanH: 800, gridSize: 40 };

describe('useFloorPlanEditor', () => {
  it('initialises positions from desk data', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    expect(result.current.state.positions['d1'].posX).toBe(10);
    expect(result.current.state.positions['d1'].posY).toBe(20);
  });

  it('moveDeskTo updates position and marks dirty', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    act(() => result.current.moveDeskTo('d1', 50, 60));
    expect(result.current.state.positions['d1'].posX).toBe(50);
    expect(result.current.state.positions['d1'].posY).toBe(60);
    expect(result.current.state.isDirty).toBe(true);
  });

  it('snap rounds to nearest grid step', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    // grid = 40px, canvas = 1200px  →  gridPct = 40/1200*100 ≈ 3.333%
    // posX = 5.1 → should snap to nearest 3.333 multiple ≈ 3.333 or 6.666
    act(() => result.current.moveDeskTo('d1', 5.1, 5.1));
    const { posX } = result.current.state.positions['d1'];
    const gridPct = (40 / 1200) * 100;
    expect(Math.abs(posX % gridPct) < 0.01 || Math.abs(posX % gridPct - gridPct) < 0.01).toBe(true);
  });

  it('undo restores previous position', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    const originalX = result.current.state.positions['d1'].posX;
    act(() => result.current.moveDeskTo('d1', 70, 70));
    expect(result.current.state.positions['d1'].posX).toBe(70);
    act(() => result.current.undo());
    expect(result.current.state.positions['d1'].posX).toBe(originalX);
  });

  it('redo re-applies undone change', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    act(() => result.current.moveDeskTo('d1', 55, 55));
    act(() => result.current.undo());
    act(() => result.current.redo());
    expect(result.current.state.positions['d1'].posX).toBe(55);
  });

  it('canUndo is false initially', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    expect(result.current.canUndo).toBe(false);
  });

  it('canRedo is false initially', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    expect(result.current.canRedo).toBe(false);
  });

  it('rotateDesk cycles through 0→90→180→270→0', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    expect(result.current.state.positions['d1'].rotation).toBe(0);
    act(() => result.current.rotateDesk('d1'));
    expect(result.current.state.positions['d1'].rotation).toBe(90);
    act(() => result.current.rotateDesk('d1'));
    act(() => result.current.rotateDesk('d1'));
    act(() => result.current.rotateDesk('d1'));
    expect(result.current.state.positions['d1'].rotation).toBe(0);
  });

  it('markSaved clears isDirty flag', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    act(() => result.current.moveDeskTo('d1', 30, 30));
    expect(result.current.state.isDirty).toBe(true);
    act(() => result.current.markSaved());
    expect(result.current.state.isDirty).toBe(false);
  });

  it('toggleSnap switches snap state', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    expect(result.current.state.snapToGrid).toBe(true);
    act(() => result.current.toggleSnap());
    expect(result.current.state.snapToGrid).toBe(false);
  });

  it('setZoom clamps between 0.25 and 3', () => {
    const { result } = renderHook(() => useFloorPlanEditor(DESKS, FP));
    act(() => result.current.setZoom(0.1));
    expect(result.current.state.zoom).toBe(0.25);
    act(() => result.current.setZoom(99));
    expect(result.current.state.zoom).toBe(3);
  });
});
