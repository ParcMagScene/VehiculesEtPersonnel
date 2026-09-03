import { format } from 'date-fns';
import { useCallback, useRef, useState } from 'react';

import api from '../../utils/api';

// ═══════════════════════════════════════════════════════════════
// useDragHandlers Hook
// Manages all drag creation, drag moving, and resize operations
// Returns: handlers, state, refs
// ═══════════════════════════════════════════════════════════════

export const useDragHandlers = ({
  days,
  view,
  coveredSlotsForPerson,
  loadPlanning,
  toast,
  onAssignmentDialogOpen,
}) => {
  // Drag-to-create state
  const [dragCreate, setDragCreate] = useState(null);
  const isDragCreatingRef = useRef(false);

  // Drag-to-move state
  const [dragMove, setDragMove] = useState(null);
  const isDragMovingRef = useRef(false);
  const pendingBlockDragRef = useRef(null);

  // Resize state
  const [resizeState, setResizeState] = useState(null);
  const isResizingRef = useRef(false);

  // Shared refs
  const lastDragSlotRef = useRef(null);
  const wasDraggedRef = useRef(false);

  // ═══ Drag creation (new mission) ═══
  const handleSlotMouseDown = useCallback(
    (person, slotIndex, e) => {
      if (view === 'year' || e.button !== 0) return;
      const covered = coveredSlotsForPerson(person.id);
      if (covered.has(slotIndex)) return;
      e.preventDefault();
      isDragCreatingRef.current = true;
      wasDraggedRef.current = false;
      lastDragSlotRef.current = slotIndex;
      setDragCreate({ person, startSlotIdx: slotIndex, endSlotIdx: slotIndex });
    },
    [view, coveredSlotsForPerson],
  );

  const handleSlotMouseEnter = useCallback(
    (person, slotIndex) => {
      // Drag creation: extend selection
      if (isDragCreatingRef.current && dragCreate && dragCreate.person.id === person.id) {
        if (slotIndex !== dragCreate.startSlotIdx) wasDraggedRef.current = true;
        setDragCreate((prev) => ({ ...prev, endSlotIdx: slotIndex }));
      }

      // Drag move: detect when entering from pending
      if (
        pendingBlockDragRef.current &&
        pendingBlockDragRef.current.person.id === person.id &&
        slotIndex !== pendingBlockDragRef.current.slotIndex
      ) {
        const p = pendingBlockDragRef.current;
        isDragMovingRef.current = true;
        wasDraggedRef.current = true;
        const newStartIdx = slotIndex - p.offsetSlots;
        setDragMove({
          span: p.span,
          person: p.person,
          offsetSlots: p.offsetSlots,
          originalStartIdx: p.originalStartIdx,
          currentStartIdx: Math.max(0, Math.min(newStartIdx, days.length - p.span.slotCount)),
        });
        pendingBlockDragRef.current = null;
      }

      // Drag move: continue movement
      if (isDragMovingRef.current && dragMove && dragMove.person.id === person.id) {
        const newStartIdx = slotIndex - dragMove.offsetSlots;
        if (newStartIdx >= 0 && newStartIdx + dragMove.span.slotCount <= days.length) {
          setDragMove((prev) => ({ ...prev, currentStartIdx: newStartIdx }));
        }
      }

      // Resize: adjust on hover
      if (isResizingRef.current && resizeState && resizeState.person.id === person.id) {
        if (resizeState.edge === 'end') {
          const newSlotCount = Math.max(1, slotIndex - resizeState.currentStartIdx + 1);
          setResizeState((prev) => ({ ...prev, currentSlotCount: newSlotCount }));
        } else {
          const endIdx = resizeState.currentStartIdx + resizeState.currentSlotCount - 1;
          if (slotIndex <= endIdx) {
            setResizeState((prev) => ({
              ...prev,
              currentStartIdx: slotIndex,
              currentSlotCount: endIdx - slotIndex + 1,
            }));
          }
        }
      }
    },
    [dragCreate, dragMove, resizeState, days.length],
  );

  const handleGlobalMouseUp = useCallback(() => {
    // Pending block drag cancelled
    if (pendingBlockDragRef.current) {
      pendingBlockDragRef.current = null;
      return;
    }

    // Drag creation finished
    if (isDragCreatingRef.current && dragCreate) {
      isDragCreatingRef.current = false;
      const minIdx = Math.min(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const maxIdx = Math.max(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const startDay = days[minIdx];
      const endDay = days[maxIdx];
      if (startDay) {
        onAssignmentDialogOpen({
          person: dragCreate.person,
          day: startDay,
          endDay: endDay || startDay,
          period: 'AM',
        });
      }
      setDragCreate(null);
      return;
    }

    // Drag move finished
    if (isDragMovingRef.current && dragMove) {
      isDragMovingRef.current = false;
      const { span, currentStartIdx, originalStartIdx } = dragMove;
      if (currentStartIdx !== originalStartIdx && days[currentStartIdx]) {
        const delta = currentStartIdx - originalStartIdx;
        const newStart = new Date(span.missionStart);
        newStart.setDate(newStart.getDate() + delta);
        const newEnd = new Date(span.missionEnd);
        newEnd.setDate(newEnd.getDate() + delta);
        api
          .updateMission(span.mission.id, {
            start_date: format(newStart, 'yyyy-MM-dd'),
            end_date: format(newEnd, 'yyyy-MM-dd'),
          })
          .then(() => loadPlanning())
          .catch((err) => {
            console.error('[useDragHandlers] Move error:', err);
            toast.error('Erreur déplacement de la mission');
            loadPlanning();
          });
      }
      setDragMove(null);
      return;
    }

    // Resize finished
    if (isResizingRef.current && resizeState) {
      isResizingRef.current = false;
      const { span, currentStartIdx, currentSlotCount, originalStartIdx, originalSlotCount } =
        resizeState;
      if (currentStartIdx !== originalStartIdx || currentSlotCount !== originalSlotCount) {
        const deltaStart = currentStartIdx - originalStartIdx;
        const deltaEnd =
          currentStartIdx + currentSlotCount - (originalStartIdx + originalSlotCount);
        const newStart = new Date(span.missionStart);
        newStart.setDate(newStart.getDate() + deltaStart);
        const newEnd = new Date(span.missionEnd);
        newEnd.setDate(newEnd.getDate() + deltaEnd);
        api
          .updateMission(span.mission.id, {
            start_date: format(newStart, 'yyyy-MM-dd'),
            end_date: format(newEnd, 'yyyy-MM-dd'),
          })
          .then(() => loadPlanning())
          .catch((err) => {
            console.error('[useDragHandlers] Resize error:', err);
            toast.error('Erreur modification de la mission');
            loadPlanning();
          });
      }
      setResizeState(null);
      return;
    }
  }, [dragCreate, dragMove, resizeState, days, loadPlanning, toast, onAssignmentDialogOpen]);

  // ═══ Block drag (mission) ═══
  const handleBlockMouseDown = useCallback(
    (e, span, person, slotIndex) => {
      if (view === 'year' || e.button !== 0) return;
      if (e.target.closest('.pp-resize-handle') || e.target.closest('.pp-assignment-delete'))
        return;
      e.preventDefault();
      e.stopPropagation();
      wasDraggedRef.current = false;
      pendingBlockDragRef.current = {
        span,
        person,
        slotIndex,
        offsetSlots: slotIndex - span.startSlotIdx,
        originalStartIdx: span.startSlotIdx,
      };
    },
    [view],
  );

  // ═══ Resize ═══
  const handleResizeStart = useCallback(
    (e, span, person, edge) => {
      if (view === 'year' || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      setResizeState({
        span,
        person,
        edge,
        originalStartIdx: span.startSlotIdx,
        originalSlotCount: span.slotCount,
        currentStartIdx: span.startSlotIdx,
        currentSlotCount: span.slotCount,
      });
    },
    [view],
  );

  // Check if slot is in active drag selection
  const isInDragSelection = useCallback(
    (personId, slotIndex) => {
      if (!dragCreate || dragCreate.person.id !== personId) return false;
      const minIdx = Math.min(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      const maxIdx = Math.max(dragCreate.startSlotIdx, dragCreate.endSlotIdx);
      return slotIndex >= minIdx && slotIndex <= maxIdx;
    },
    [dragCreate],
  );

  // Check if any drag operation is active
  const isAnyDragActive = () =>
    isDragCreatingRef.current || isDragMovingRef.current || isResizingRef.current;

  return {
    // State
    dragCreate,
    dragMove,
    resizeState,
    // Handlers
    handleSlotMouseDown,
    handleSlotMouseEnter,
    handleGlobalMouseUp,
    handleBlockMouseDown,
    handleResizeStart,
    isInDragSelection,
    isAnyDragActive,
    // Refs
    wasDraggedRef,
    pendingBlockDragRef,
    isDragCreatingRef,
    isDragMovingRef,
    isResizingRef,
  };
};

export default useDragHandlers;
