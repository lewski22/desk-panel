import { useState, useCallback } from 'react';

export function useDirtyGuard(onConfirmedClose: () => void) {
  const [isDirty,      setIsDirty]      = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);

  const markDirty    = useCallback(() => setIsDirty(true), []);
  const resetDirty   = useCallback(() => setIsDirty(false), []);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowConfirm(true);
    } else {
      onConfirmedClose();
    }
  }, [isDirty, onConfirmedClose]);

  const confirmClose = useCallback(() => {
    setShowConfirm(false);
    setIsDirty(false);
    onConfirmedClose();
  }, [onConfirmedClose]);

  const cancelClose = useCallback(() => setShowConfirm(false), []);

  return { markDirty, resetDirty, requestClose, showConfirm, confirmClose, cancelClose };
}
