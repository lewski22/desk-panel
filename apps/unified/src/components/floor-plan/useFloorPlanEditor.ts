/**
 * useFloorPlanEditor — reducer zarządzający stanem edytora floor plan
 * Sprint D2 — undo/redo, drag, rotate, background
 */
import { useReducer, useCallback } from 'react';
import { DeskMapItem } from '../../types';

// ── Typy ─────────────────────────────────────────────────────
export interface DeskPosition {
  id:       string;
  posX:     number;   // 0–100 %
  posY:     number;
  rotation: number;   // 0/90/180/270
  width:    number;
  height:   number;
}

export interface FloorPlanState {
  positions:        Record<string, DeskPosition>; // id → pozycja
  background:       string | null;                // base64 lub URL
  backgroundW:      number;
  backgroundH:      number;
  gridSize:         number;
  snapToGrid:       boolean;
  zoom:             number;       // 0.5 – 2.0
  past:             Record<string, DeskPosition>[];  // undo stack
  future:           Record<string, DeskPosition>[];  // redo stack
  isDirty:          boolean;
  backgroundCleared: boolean; // true tylko gdy użytkownik jawnie usunął tło (REMOVE_BACKGROUND)
}

// ── Akcje ─────────────────────────────────────────────────────
type Action =
  | { type: 'MOVE_DESK';        id: string; posX: number; posY: number }
  | { type: 'ROTATE_DESK';      id: string }
  | { type: 'RESIZE_DESK';      id: string; width: number; height: number }
  | { type: 'SET_BACKGROUND';   url: string; w: number; h: number }
  | { type: 'LOAD_BACKGROUND';  url: string | null; w?: number; h?: number; gridSize?: number } // ładuje z serwera bez isDirty
  | { type: 'REMOVE_BACKGROUND' }
  | { type: 'SET_GRID';         gridSize: number }
  | { type: 'TOGGLE_SNAP' }
  | { type: 'SET_ZOOM';         zoom: number }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET';            positions: Record<string, DeskPosition> }
  | { type: 'MARK_SAVED' };

const MAX_HISTORY = 50;

function snapPos(v: number, gridSize: number, canvasSize: number, snap: boolean): number {
  if (!snap) return Math.max(0, Math.min(100, v));
  const gridPct = (gridSize / canvasSize) * 100;
  return Math.max(0, Math.min(100, Math.round(v / gridPct) * gridPct));
}

function reducer(state: FloorPlanState, action: Action): FloorPlanState {
  switch (action.type) {

    case 'MOVE_DESK': {
      const prev = state.positions;
      const snappedX = state.snapToGrid
        ? snapPos(action.posX, state.gridSize, state.backgroundW || 1200, true)
        : Math.max(0, Math.min(100, action.posX));
      const snappedY = state.snapToGrid
        ? snapPos(action.posY, state.gridSize, state.backgroundH || 800, true)
        : Math.max(0, Math.min(100, action.posY));

      return {
        ...state,
        positions: {
          ...prev,
          [action.id]: { ...prev[action.id], posX: snappedX, posY: snappedY },
        },
        past:    [...state.past.slice(-MAX_HISTORY), prev],
        future:  [],
        isDirty: true,
      };
    }

    case 'ROTATE_DESK': {
      const prev = state.positions;
      const cur  = prev[action.id];
      if (!cur) return state;
      return {
        ...state,
        positions: { ...prev, [action.id]: { ...cur, rotation: (cur.rotation + 90) % 360 } },
        past:    [...state.past.slice(-MAX_HISTORY), prev],
        future:  [],
        isDirty: true,
      };
    }

    case 'RESIZE_DESK': {
      const prev = state.positions;
      const cur  = prev[action.id];
      if (!cur) return state;
      return {
        ...state,
        positions: { ...prev, [action.id]: { ...cur, width: action.width, height: action.height } },
        past:    [...state.past.slice(-MAX_HISTORY), prev],
        future:  [],
        isDirty: true,
      };
    }

    case 'SET_BACKGROUND':
      return { ...state, background: action.url, backgroundW: action.w, backgroundH: action.h, isDirty: true, backgroundCleared: false };

    // Ładuje tło z serwera — nie zmienia isDirty ani nie trafia do undo history
    case 'LOAD_BACKGROUND':
      return {
        ...state,
        background:       action.url,
        backgroundW:      action.w       ?? state.backgroundW,
        backgroundH:      action.h       ?? state.backgroundH,
        gridSize:         action.gridSize ?? state.gridSize,
        backgroundCleared: false,
      };

    case 'REMOVE_BACKGROUND':
      return { ...state, background: null, isDirty: true, backgroundCleared: true };

    case 'SET_GRID':
      return { ...state, gridSize: action.gridSize };

    case 'TOGGLE_SNAP':
      return { ...state, snapToGrid: !state.snapToGrid };

    case 'SET_ZOOM':
      return { ...state, zoom: Math.max(0.25, Math.min(3, action.zoom)) };

    case 'UNDO': {
      if (state.past.length === 0) return state;
      const prev    = state.past[state.past.length - 1];
      const newPast = state.past.slice(0, -1);
      return {
        ...state,
        positions: prev,
        past:      newPast,
        future:    [state.positions, ...state.future.slice(0, MAX_HISTORY)],
        isDirty:   true,
      };
    }

    case 'REDO': {
      if (state.future.length === 0) return state;
      const next   = state.future[0];
      const newFut = state.future.slice(1);
      return {
        ...state,
        positions: next,
        past:      [...state.past.slice(-MAX_HISTORY), state.positions],
        future:    newFut,
        isDirty:   true,
      };
    }

    case 'RESET':
      return { ...state, positions: action.positions, past: [], future: [], isDirty: false, backgroundCleared: false };

    case 'MARK_SAVED':
      return { ...state, isDirty: false, backgroundCleared: false };

    default:
      return state;
  }
}

// ── Hook ─────────────────────────────────────────────────────
export function useFloorPlanEditor(
  desks:      DeskMapItem[],
  floorPlan?: { floorPlanUrl?: string | null; floorPlanW?: number; floorPlanH?: number; gridSize?: number },
) {
  const initialPositions: Record<string, DeskPosition> = {};
  for (const d of desks) {
    initialPositions[d.id] = {
      id:       d.id,
      posX:     d.posX     ?? 10 + Math.random() * 60,  // fallback: random
      posY:     d.posY     ?? 10 + Math.random() * 60,
      rotation: d.rotation ?? 0,
      width:    d.width    ?? 2,
      height:   d.height   ?? 1,
    };
  }

  const initial: FloorPlanState = {
    positions:         initialPositions,
    background:        floorPlan?.floorPlanUrl ?? null,
    backgroundW:       floorPlan?.floorPlanW   ?? 1200,
    backgroundH:       floorPlan?.floorPlanH   ?? 800,
    gridSize:          floorPlan?.gridSize     ?? 40,
    snapToGrid:        true,
    zoom:              1,
    past:              [],
    future:            [],
    isDirty:           false,
    backgroundCleared: false,
  };

  const [state, dispatch] = useReducer(reducer, initial);

  const moveDeskTo  = useCallback((id: string, posX: number, posY: number) =>
    dispatch({ type: 'MOVE_DESK', id, posX, posY }), []);
  const rotateDesk  = useCallback((id: string) =>
    dispatch({ type: 'ROTATE_DESK', id }), []);
  const resizeDesk  = useCallback((id: string, width: number, height: number) =>
    dispatch({ type: 'RESIZE_DESK', id, width, height }), []);
  const setBackground = useCallback((url: string, w: number, h: number) =>
    dispatch({ type: 'SET_BACKGROUND', url, w, h }), []);
  const loadBackground = useCallback((url: string | null, w?: number, h?: number, gridSize?: number) =>
    dispatch({ type: 'LOAD_BACKGROUND', url, w, h, gridSize }), []);
  const removeBackground = useCallback(() =>
    dispatch({ type: 'REMOVE_BACKGROUND' }), []);
  const setZoom     = useCallback((zoom: number) =>
    dispatch({ type: 'SET_ZOOM', zoom }), []);
  const toggleSnap  = useCallback(() =>
    dispatch({ type: 'TOGGLE_SNAP' }), []);
  const undo        = useCallback(() =>
    dispatch({ type: 'UNDO' }), []);
  const redo        = useCallback(() =>
    dispatch({ type: 'REDO' }), []);
  const reset       = useCallback((positions: Record<string, DeskPosition>) =>
    dispatch({ type: 'RESET', positions }), []);
  const markSaved   = useCallback(() =>
    dispatch({ type: 'MARK_SAVED' }), []);

  return {
    state,
    moveDeskTo, rotateDesk, resizeDesk,
    setBackground, loadBackground, removeBackground,
    setZoom, toggleSnap,
    undo, redo, reset, markSaved,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
