import React from 'react';
import { isSameDay, isWeekend, isToday } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { Button, Tooltip } from '@/design-system';
import { getUserInitials, getMaintenanceStatusStyle } from './calendarUtils';
import { renderReservationAffaires } from './renderReservationAffaires';
import { STATUS_COLORS } from '../../constants/colors';

const CalendarVehicleRow = ({
  vehicle, blocks, timeSlots,
  days, view,
  resizeState, blockDragState, blockDragPreview, pendingBlockDragRef,
  currentUser, users,
  highlightedReservationIds, googleEvents, calendarTripCache,
  isInDragSelection, isInResizePreview, isInBlockDragPreview,
  handleSlotMouseDown, handleSlotMouseEnter, handleSlotMouseUp, handleSlotClick,
  handleBlockMouseDown, handleBlockDragMove, handleResizeStart,
  handleTooltipShow, handleTooltipHide,
  handleOpenTripFromCalendar, handleTripLinked,
  onDeleteReservation, onMaintenanceClick, confirm,
  getMaintenanceConflicts,
}) => (
  <div className="vehicle-row">
    {timeSlots.map((slot, slotIndex) => {
      const block = blocks.find(b => b.startIndex === slotIndex);
      const isInBlock = blocks.some(b => slotIndex > b.startIndex && slotIndex < b.startIndex + b.span);

      const inResizingBlock = blocks.some(b => {
        const isResizing = resizeState && resizeState.reservation.id === b.id;
        return isResizing && slotIndex >= b.startIndex && slotIndex < b.startIndex + b.span;
      });

      if (inResizingBlock) {
        const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
        const isFirstOfDay = slot.period === 'AM';
        const isLastOfDay = slot.period === 'PM';
        const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
        const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
        return (
          <div
            key={`${vehicle.id}-${slotIndex}`}
            className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''}`}
            data-day-index={dayIndex}
          />
        );
      }

      if (isInBlock) return null;

      if (block) {
        const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
        const isFirstOfDay = slot.period === 'AM';
        const isLastOfDay = slot.period === 'PM' && block.span === 1;
        const isBeingResized = resizeState && resizeState.reservation.id === block.id;
        const isBeingDragged = blockDragState && blockDragState.block.id === block.id;

        if (isBeingResized) return null;

        return (
          <div
            key={`${vehicle.id}-${slotIndex}`}
            className={`time-slot reserved period-${slot.period.toLowerCase()} u-relative ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''}`}
            style={{
              gridColumn: `span ${block.span}`,
              cursor: block.isMaintenance ? 'pointer' : (currentUser?.isAdmin ? 'grab' : 'pointer')
            }}
            onMouseDown={(e) => {
              if (e.target.closest('.tournee-link-btn, .tournee-trip-btn, .reservation-trip-btn, .resize-handle, .reservation-delete-btn')) return;
              if (e.button === 2) return;
              if (block.isMaintenance) {
                e.preventDefault();
                if (onMaintenanceClick) {
                  const maintenanceId = block.maintenanceId || block.id.replace('maint-', '');
                  onMaintenanceClick(vehicle, maintenanceId);
                }
                return;
              }
              handleBlockMouseDown(e, block, vehicle);
            }}
            onMouseMove={(e) => {
              if (!blockDragState && !pendingBlockDragRef.current) return;
              if ((blockDragState && blockDragState.vehicle.id !== vehicle.id) ||
                  (pendingBlockDragRef.current && pendingBlockDragRef.current.vehicle.id !== vehicle.id)) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const relX = e.clientX - rect.left;
              const colWidth = rect.width / block.span;
              const colOffset = Math.max(0, Math.min(block.span - 1, Math.floor(relX / colWidth)));
              const slotBase = new Date(slot.day); slotBase.setHours(0, 0, 0, 0);
              const totalHalfDays = (slot.period === 'PM' ? 1 : 0) + colOffset;
              const hoverDate = new Date(slotBase);
              hoverDate.setDate(hoverDate.getDate() + Math.floor(totalHalfDays / 2));
              const hoverPeriod = totalHalfDays % 2 === 0 ? 'AM' : 'PM';
              if (pendingBlockDragRef.current) {
                handleSlotMouseEnter(vehicle, hoverDate, hoverPeriod);
              } else {
                handleBlockDragMove(vehicle, hoverDate, hoverPeriod);
              }
            }}
            data-day-index={dayIndex}
            data-reservation-id={block.id}
          >
            <div
              className={`reservation u-relative ${isBeingResized ? 'resizing' : ''} ${isBeingDragged ? 'block-drag-ghost' : ''} ${highlightedReservationIds.includes(block.id) ? 'highlighted' : ''} ${block.isMaintenance ? `maintenance-block maintenance-status-${block.maintenanceStatus || 'scheduled'} ${getMaintenanceConflicts(block).length > 0 ? 'maintenance-conflict' : ''}` : ''}`}
              onMouseEnter={(e) => handleTooltipShow(e, block)}
              onMouseLeave={handleTooltipHide}
              style={{
                backgroundColor: block.isMaintenance ? undefined : (vehicle.displayColor || vehicle.color || STATUS_COLORS.info) + '40',
                border: block.isMaintenance ? undefined : `2px solid ${vehicle.displayColor || vehicle.color || STATUS_COLORS.info}`,
                color: 'var(--theme-text-primary)',
              }}
            >
              {block.createdBy && (
                <div className="user-badge" title={`Créé par ${currentUser && block.createdBy === currentUser.id ? currentUser.name : (users.find(u => u.id === block.createdBy)?.name || `Utilisateur ${block.createdBy}`)}`}>
                  {getUserInitials(block.createdBy, currentUser, users)}
                </div>
              )}
              <div className="reservation-content-wrapper">
                <div className="reservation-content">
                  <div className="reservation-name">
                    {block.isMaintenance && getMaintenanceStatusStyle(block.maintenanceStatus, getMaintenanceConflicts(block).length > 0).icon + ' '}
                    {block.clientName || block.prestationName}
                  </div>
                  {block.locationName && <div className="reservation-location">{block.locationName}</div>}
                  {renderReservationAffaires(block, googleEvents, timeSlots, block.startIndex, calendarTripCache[block.id], (eventIds, mode) => handleOpenTripFromCalendar(block, eventIds, mode), () => handleTripLinked(block.id))}
                </div>
              </div>
              {!block.isMaintenance && onDeleteReservation && (
                <Tooltip content="Supprimer cette réservation" position="bottom">
                  <Button variant="ghost"
                    className="reservation-delete-btn"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); confirm({ title: 'Supprimer la réservation', message: 'Supprimer cette réservation ?', variant: 'danger', confirmLabel: 'Supprimer', onConfirm: () => onDeleteReservation(block.id) }); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onMouseUp={(e) => e.stopPropagation()}
                  >
                    <Trash2 size={12} />
                  </Button>
                </Tooltip>
              )}
              {view !== 'year' && !isBeingResized && (
                <>
                  <div className="resize-handle resize-handle-start" onMouseDown={(e) => handleResizeStart(e, block, 'start')} title="Glisser pour modifier le début" />
                  <div className="resize-handle resize-handle-end" onMouseDown={(e) => handleResizeStart(e, block, 'end')} title="Glisser pour modifier la fin" />
                </>
              )}
            </div>
          </div>
        );
      }

      // Empty slot
      const dayIndex = days.findIndex(d => isSameDay(d, slot.day));
      const isFirstOfDay = slot.period === 'AM';
      const isLastOfDay = slot.period === 'PM';
      const isSelected = isInDragSelection(vehicle.id, slot.day, slot.period);
      const isInPreview = isInResizePreview(vehicle.id, slot.day, slot.period);
      const isInMovePreview = isInBlockDragPreview(vehicle.id, slot.day, slot.period);

      return (
        <div
          key={`${vehicle.id}-${slotIndex}`}
          className={`time-slot period-${slot.period.toLowerCase()} ${isWeekend(slot.day) ? 'weekend-slot' : ''} ${isToday(slot.day) ? 'today-slot' : ''} ${isToday(slot.day) && isFirstOfDay ? 'today-left' : ''} ${isToday(slot.day) && isLastOfDay ? 'today-right' : ''} ${isSelected ? 'drag-selected' : ''} ${isInPreview ? 'resize-preview' : ''} ${isInMovePreview ? `block-drag-preview${blockDragPreview?.hasConflict ? ' drag-conflict' : ''}` : ''}`}
          onMouseDown={(e) => !resizeState && handleSlotMouseDown(vehicle, slot.day, slot.period, e)}
          onMouseEnter={() => !resizeState && handleSlotMouseEnter(vehicle, slot.day, slot.period)}
          onMouseUp={handleSlotMouseUp}
          onClick={() => handleSlotClick(vehicle, slot.day, slot.period)}
          data-day-index={dayIndex}
        />
      );
    })}
  </div>
);

export default React.memo(CalendarVehicleRow);
