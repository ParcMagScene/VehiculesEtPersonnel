import React, { useState, useEffect, useCallback, startTransition } from 'react';
import useWindowWidth from '../../hooks/useWindowWidth';
import { formatDateSimple } from '../../utils/formatUtils';
import {
  format, isSameDay, isSameWeek, isSameMonth, isSameYear, setMonth,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link, ChevronLeft, ChevronRight, Truck } from 'lucide-react';
import { Button, Tooltip } from '@/design-system';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { TIMING } from '../../constants';
import { getDriveLinksCount } from './calendarUtils';
import useCalendarDrag from './useCalendarDrag';
import useCalendarTrips from './useCalendarTrips';
import useCalendarData from './useCalendarData';
import CalendarVehicleRow from './CalendarVehicleRow';
import CalendarHeaders from './CalendarHeaders';
import CalendarVehicleColumn from './CalendarVehicleColumn';
import MonthSelector from '../MonthSelector';
import WeekSelector from '../WeekSelector';
import YearSelector from '../YearSelector';
import ReservationModal from './ReservationModal';
import TripDetailsModal from './TripDetailsModal';
import './Calendar.css';

const Calendar = ({
  view, setView, currentDate, setCurrentDate,
  onOpenManagement, vehicles, reservations, maintenances = [],
  onAddReservation, onUpdateReservation, _onUpdateMaintenance,
  onDeleteReservation, clients, drivers, persons = [], locations,
  users = [], onScroll, googleEvent, onCloseGoogleEvent, googleEvents,
  highlightedReservationIds = [], reservationToEdit, onReservationEditComplete,
  onVehicleClick, onVehicleDoubleClick, onMaintenanceClick, onRequestViewEvent,
  currentUser, quickReservationSlot, onQuickReservationHandled,
}) => {
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({ company: false, location: false });
  const [tooltipState, setTooltipState] = useState({ visible: false, block: null, x: 0, y: 0 });
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [showWeekSelector, setShowWeekSelector] = useState(false);
  const [showYearSelector, setShowYearSelector] = useState(false);
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const windowWidth = useWindowWidth();

  // ═══ DATA HOOK ═══
  const {
    days, periods, reservationLookup, getReservation, getMaintenanceConflicts,
    vehicleGroups, availabilityCount, allVehicleBlocks, gridColumns,
  } = useCalendarData({ view, currentDate, reservations, maintenances, vehicles, windowWidth });

  // ═══ DRAG HOOK ═══
  const {
    dragState, isDragging, resizeState, resizePreview,
    blockDragState, blockDragPreview, pendingBlockDragRef,
    handleSlotMouseDown, handleSlotMouseEnter, handleSlotMouseUp,
    isInResizePreview, handleResizeStart,
    handleBlockMouseDown, handleBlockDragMove,
    isInBlockDragPreview, isInDragSelection,
    handleSlotClick,
    handleGlobalMouseMove, handleGlobalMouseUp,
  } = useCalendarDrag({
    view, currentUser, days, reservations,
    onUpdateReservation,
    onSelectSlot: setSelectedSlot,
    onSelectReservation: setSelectedReservation,
  });

  // ═══ TRIPS HOOK ═══
  const {
    calendarTripModal, setCalendarTripModal,
    calendarTripCache,
    calendarGoogleMapsApiKey, calendarCompanyAddress,
    handleOpenTripFromCalendar, handleSaveTripFromCalendar, handleTripLinked,
  } = useCalendarTrips({ vehicles, googleEvents, reservations, googleEvent });

  // ═══ NAVIGATION ═══
  const goToPrevious = useCallback(() => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() - 1);
    else if (view === 'week') d.setDate(d.getDate() - 7);
    else if (view === 'month') d.setMonth(d.getMonth() - 1);
    else d.setFullYear(d.getFullYear() - 1);
    startTransition(() => setCurrentDate(d));
  }, [currentDate, view, setCurrentDate]);

  const goToNext = useCallback(() => {
    const d = new Date(currentDate);
    if (view === 'day') d.setDate(d.getDate() + 1);
    else if (view === 'week') d.setDate(d.getDate() + 7);
    else if (view === 'month') d.setMonth(d.getMonth() + 1);
    else d.setFullYear(d.getFullYear() + 1);
    startTransition(() => setCurrentDate(d));
  }, [currentDate, view, setCurrentDate]);

  const goToToday = useCallback(() => startTransition(() => setCurrentDate(new Date())), [setCurrentDate]);

  const getDateLabel = () => {
    let label = '';
    if (view === 'day') label = format(currentDate, "EEEE d MMMM yyyy", { locale: fr });
    else if (view === 'week') label = format(currentDate, "'Semaine du' d MMMM yyyy", { locale: fr });
    else if (view === 'month') label = format(currentDate, 'MMMM yyyy', { locale: fr });
    else label = format(currentDate, 'yyyy', { locale: fr });
    return label.charAt(0).toUpperCase() + label.slice(1);
  };

  const isCurrentPeriod = () => {
    const today = new Date();
    if (view === 'day') return isSameDay(currentDate, today);
    if (view === 'week') return isSameWeek(currentDate, today, { weekStartsOn: 1 });
    if (view === 'month') return isSameMonth(currentDate, today);
    return isSameYear(currentDate, today);
  };
  const showTodayHighlight = !isCurrentPeriod();

  const handleMonthClick = useCallback((monthIndex) => {
    if (view === 'year') { setCurrentDate(setMonth(currentDate, monthIndex)); setView('month'); }
  }, [view, currentDate, setCurrentDate, setView]);

  const handleWeekClick = useCallback((weekDate) => {
    if (view === 'year') { setCurrentDate(weekDate); setView('week'); }
  }, [view, setCurrentDate, setView]);

  const handleDayClick = useCallback((day) => {
    if (view === 'month') { setCurrentDate(day); setView('day'); }
  }, [view, setCurrentDate, setView]);

  // ═══ EFFECTS ═══
  useEffect(() => {
    if (quickReservationSlot) {
      setSelectedSlot(quickReservationSlot);
      setSelectedReservation(null);
      if (onQuickReservationHandled) onQuickReservationHandled();
    }
  }, [quickReservationSlot, onQuickReservationHandled]);

  useEffect(() => {
    if (googleEvent) setSelectedSlot({ googleEvent });
  }, [googleEvent]);

  useEffect(() => {
    if (reservationToEdit) setSelectedReservation(reservationToEdit);
  }, [reservationToEdit]);

  const handleScroll = (e) => { if (onScroll) onScroll(e.target.scrollLeft); };

  const handleTooltipShow = useCallback((event, block) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipState({ visible: true, block, x: rect.left + rect.width / 2, y: rect.top });
  }, []);
  const handleTooltipHide = useCallback(() => {
    setTooltipState({ visible: false, block: null, x: 0, y: 0 });
  }, []);

  // Scroll-to-position on view/date change
  useEffect(() => {
    if (view === 'month' || view === 'year') {
      let rafId = null;
      let timeoutId = null;
      const scrollToPosition = () => {
        rafId = requestAnimationFrame(() => {
          const container = document.querySelector('.calendar-scroll-area');
          const headersContainer = document.querySelector('.calendar-headers-scroll-area');
          if (!container) return;
          const today = new Date();
          const isToday = currentDate.getDate() === today.getDate() &&
            currentDate.getMonth() === today.getMonth() &&
            currentDate.getFullYear() === today.getFullYear();
          if (isToday) {
            const todayElement = document.querySelector('.calendar-header-cell.today');
            if (todayElement) {
              const scrollLeft = todayElement.offsetLeft - (container.offsetWidth / 2) + (todayElement.offsetWidth / 2);
              container.scrollLeft = scrollLeft;
              if (headersContainer) headersContainer.scrollLeft = scrollLeft;
            }
          } else {
            container.scrollLeft = 0;
            if (headersContainer) headersContainer.scrollLeft = 0;
          }
        });
      };
      timeoutId = setTimeout(scrollToPosition, 100);
      return () => { clearTimeout(timeoutId); if (rafId) cancelAnimationFrame(rafId); };
    }
  }, [view, currentDate]);

  // Scroll sync vertical
  useEffect(() => {
    const vehicleColumn = document.querySelector('.vehicle-column');
    const scrollArea = document.querySelector('.calendar-scroll-area');
    const headersScrollArea = document.querySelector('.calendar-headers-scroll-area');
    if (!vehicleColumn || !scrollArea) return;
    let scrollRaf = null;
    const onScroll = (e) => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
      scrollRaf = requestAnimationFrame(() => {
        if (e.target === scrollArea) {
          vehicleColumn.scrollTop = scrollArea.scrollTop;
          if (headersScrollArea) headersScrollArea.scrollLeft = scrollArea.scrollLeft;
        } else if (e.target === vehicleColumn) {
          scrollArea.scrollTop = vehicleColumn.scrollTop;
        }
      });
    };
    vehicleColumn.addEventListener('scroll', onScroll);
    scrollArea.addEventListener('scroll', onScroll);
    return () => {
      vehicleColumn.removeEventListener('scroll', onScroll);
      scrollArea.removeEventListener('scroll', onScroll);
      if (scrollRaf) cancelAnimationFrame(scrollRaf);
    };
  }, [vehicles]);

  // Height sync
  useEffect(() => {
    const syncRowHeights = () => {
      const leftColumn = document.querySelector('.vehicle-column');
      const grid = document.querySelector('.calendar-scroll-area .calendar-grid');
      if (!leftColumn || !grid) return;
      const leftChildren = Array.from(leftColumn.children);
      const gridChildren = Array.from(grid.children);
      leftChildren.forEach((leftChild, index) => {
        const gridChild = gridChildren[index];
        if (!gridChild) return;
        const leftHeight = leftChild.offsetHeight;
        if (gridChild.classList.contains('vehicle-row')) {
          gridChild.querySelectorAll('.time-slot').forEach(slot => {
            slot.style.height = `${leftHeight}px`;
            slot.style.minHeight = `${leftHeight}px`;
          });
        } else if (gridChild.classList.contains('vehicle-section-separator')) {
          gridChild.style.height = `${leftHeight}px`;
          gridChild.style.minHeight = `${leftHeight}px`;
        }
      });
    };
    const timer1 = setTimeout(syncRowHeights, 50);
    const timer2 = setTimeout(syncRowHeights, TIMING.DOUBLE_CLICK);
    const timer3 = setTimeout(syncRowHeights, TIMING.PRINT_DELAY);
    window.addEventListener('resize', syncRowHeights);
    return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); window.removeEventListener('resize', syncRowHeights); };
  }, [vehicles, view, reservations, collapsedSections]);

  // ═══ HANDLERS ═══
  const handleSaveReservation = (reservationData) => {
    let success = false;
    if (selectedReservation) success = onUpdateReservation(selectedReservation.id, reservationData);
    else success = onAddReservation(reservationData);
    if (success !== false) { setSelectedSlot(null); setSelectedReservation(null); }
  };

  const handleDeleteReservation = () => {
    if (selectedReservation) { onDeleteReservation(selectedReservation.id); setSelectedReservation(null); }
  };

  const closeModal = () => {
    setSelectedSlot(null);
    setSelectedReservation(null);
    if (onCloseGoogleEvent) onCloseGoogleEvent();
    if (onReservationEditComplete) onReservationEditComplete();
  };

  // ═══ SHARED PROPS for CalendarVehicleRow ═══
  const rowProps = {
    days, view, resizeState, blockDragState, blockDragPreview, pendingBlockDragRef,
    currentUser, users, highlightedReservationIds, googleEvents, calendarTripCache,
    isInDragSelection, isInResizePreview, isInBlockDragPreview,
    handleSlotMouseDown, handleSlotMouseEnter, handleSlotMouseUp, handleSlotClick,
    handleBlockMouseDown, handleBlockDragMove, handleResizeStart,
    handleTooltipShow, handleTooltipHide,
    handleOpenTripFromCalendar, handleTripLinked,
    onDeleteReservation, onMaintenanceClick, confirm,
    getMaintenanceConflicts,
  };

  return (
    <div className="calendar-container" onMouseMove={handleGlobalMouseMove} onMouseUp={handleGlobalMouseUp}>
      {/* Toolbar */}
      <div className="cal-nav-toolbar">
        <div className="cal-nav-views">
          <Button variant="ghost" className={`cal-nav-view-btn ${view === 'day' ? 'active' : ''}`} onClick={() => setView('day')}>Jour</Button>
          <Button variant="ghost" className={`cal-nav-view-btn ${view === 'week' ? 'active' : ''}`} onClick={() => setView('week')}>Semaine</Button>
          <Button variant="ghost" className={`cal-nav-view-btn ${view === 'month' ? 'active' : ''}`} onClick={() => setView('month')}>Mois</Button>
        </div>
        <div className="cal-nav-date">
          <Button variant="ghost" className="cal-nav-btn" onClick={goToPrevious} aria-label="Période précédente"><ChevronLeft size={18} /></Button>
          <Button variant="ghost" className={`cal-nav-btn cal-nav-today ${showTodayHighlight ? 'highlight' : ''}`} onClick={goToToday}>Aujourd'hui</Button>
          <Button variant="ghost" className="cal-nav-btn" onClick={goToNext} aria-label="Période suivante"><ChevronRight size={18} /></Button>
          <span
            className="cal-nav-label clickable"
            onClick={() => {
              if (view === 'day') setShowWeekSelector(true);
              if (view === 'month') setShowMonthSelector(true);
              if (view === 'week') setShowWeekSelector(true);
            }}
            title={view === 'day' ? 'Sélectionner une date' : view === 'month' ? 'Sélectionner un mois' : 'Sélectionner une semaine'}
          >
            {getDateLabel()}
          </span>
        </div>
        {onOpenManagement && (
          <Button variant="ghost" className="cal-management-btn" onClick={onOpenManagement} aria-label="Ouvrir la gestion">
            <Truck size={16} /> Gestion
          </Button>
        )}
      </div>

      <div className="calendar">
        {/* Headers */}
        <div className="calendar-headers-row">
          <div className="vehicle-column-header">
            <span>Véhicules entreprise</span>
            <Tooltip content="Véhicules disponibles aujourd'hui (hors locations)" position="bottom">
              <span className="vehicle-availability-badge">
                {availabilityCount.company.available}/{availabilityCount.company.total}
              </span>
            </Tooltip>
            <Button variant="ghost"
              className="section-toggle-button"
              onClick={() => setCollapsedSections(prev => ({ ...prev, company: !prev.company }))}
              title={collapsedSections.company ? 'Développer' : 'Rétracter'}
            >
              {collapsedSections.company ? '▼' : '▲'}
            </Button>
          </div>
          <CalendarHeaders
            view={view} days={days} currentDate={currentDate} gridColumns={gridColumns}
            handleMonthClick={handleMonthClick} handleWeekClick={handleWeekClick} handleDayClick={handleDayClick}
          />
        </div>

        {/* Content */}
        <div className="calendar-content-row">
          <CalendarVehicleColumn
            vehicleGroups={vehicleGroups} collapsedSections={collapsedSections} setCollapsedSections={setCollapsedSections}
            availabilityCount={availabilityCount} maintenances={maintenances}
            onVehicleClick={onVehicleClick} onVehicleDoubleClick={onVehicleDoubleClick}
          />

          <div className="calendar-scroll-area" onScroll={handleScroll}>
            <div className={`calendar-grid ${view}-view u-relative`} style={{ gridTemplateColumns: gridColumns }}>
              {!collapsedSections.company && vehicleGroups.companyVehicles.map((vehicle) => {
                const precomputed = allVehicleBlocks.get(vehicle.id) || { blocks: [], timeSlots: [] };
                return <CalendarVehicleRow key={vehicle.id} vehicle={vehicle} blocks={precomputed.blocks} timeSlots={precomputed.timeSlots} {...rowProps} />;
              })}

              {vehicleGroups.locationVehicles.length > 0 && (
                <div className="vehicle-section-separator" style={{ gridColumn: '1 / -1' }}>
                  <span>Véhicules de location</span>
                  <Tooltip content="Véhicules de location disponibles aujourd'hui" position="bottom">
                    <span className="vehicle-availability-badge location">
                      {availabilityCount.location.available}/{availabilityCount.location.total}
                    </span>
                  </Tooltip>
                  <Button variant="ghost"
                    className="section-toggle-button"
                    onClick={() => setCollapsedSections(prev => ({ ...prev, location: !prev.location }))}
                  >
                    {collapsedSections.location ? '▼' : '▲'}
                  </Button>
                </div>
              )}

              {!collapsedSections.location && vehicleGroups.locationVehicles.map((vehicle) => {
                const precomputed = allVehicleBlocks.get(vehicle.id) || { blocks: [], timeSlots: [] };
                return <CalendarVehicleRow key={vehicle.id} vehicle={vehicle} blocks={precomputed.blocks} timeSlots={precomputed.timeSlots} {...rowProps} />;
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {(selectedSlot || selectedReservation) && (
        <ReservationModal
          slot={selectedSlot} reservation={selectedReservation}
          vehicles={vehicles} clients={clients} drivers={drivers} persons={persons} locations={locations}
          onSave={handleSaveReservation} onDelete={handleDeleteReservation} onClose={closeModal}
          googleEvent={selectedSlot?.googleEvent || googleEvent} googleEvents={googleEvents}
          onRequestViewEvent={onRequestViewEvent} currentUser={currentUser}
        />
      )}

      {calendarTripModal && !calendarTripModal.combinedEvents && (
        <TripDetailsModal
          event={calendarTripModal.event} tripDetail={calendarTripModal.tripDetail}
          onSave={handleSaveTripFromCalendar} onClose={() => setCalendarTripModal(null)}
          drivers={drivers} persons={persons} vehicle={calendarTripModal.vehicle} nextEvent={null}
          googleMapsApiKey={calendarGoogleMapsApiKey} companyAddress={calendarCompanyAddress} initialLocations={locations}
        />
      )}

      {calendarTripModal && calendarTripModal.combinedEvents && (
        <TripDetailsModal
          event={calendarTripModal.combinedEvents[0].event}
          tripDetail={calendarTripModal.combinedEvents[0].tripDetail}
          onSave={handleSaveTripFromCalendar} onClose={() => setCalendarTripModal(null)}
          drivers={drivers} persons={persons} vehicle={calendarTripModal.vehicle}
          nextEvent={calendarTripModal.combinedEvents.length > 1 ? calendarTripModal.combinedEvents[1].event : null}
          googleMapsApiKey={calendarGoogleMapsApiKey} companyAddress={calendarCompanyAddress}
          initialLocations={locations} combinedEvents={calendarTripModal.combinedEvents}
        />
      )}

      {/* Tooltip */}
      {tooltipState.visible && tooltipState.block && (
        <div className="emag-tooltip" style={{ left: `${tooltipState.x}px`, top: `${tooltipState.y}px`, opacity: 1, visibility: 'visible' }}>
          <div className="tooltip-row">
            <span className="tooltip-label">Type:</span>
            <span className="tooltip-value">{tooltipState.block.isMaintenance ? 'Intervention' : 'Réservation'}</span>
          </div>
          {tooltipState.block.isMaintenance ? (
            <>
              <div className="tooltip-row"><span className="tooltip-label">Prestation:</span><span className="tooltip-value">{tooltipState.block.prestationName || 'Non spécifiée'}</span></div>
              <div className="tooltip-row"><span className="tooltip-label">Garage:</span><span className="tooltip-value">{tooltipState.block.garageName || 'Non spécifié'}</span></div>
              <div className="tooltip-row"><span className="tooltip-label">Début:</span><span className="tooltip-value">{tooltipState.block.start_date || tooltipState.block.startDate || 'Non spécifié'}</span></div>
              <div className="tooltip-row"><span className="tooltip-label">Fin:</span><span className="tooltip-value">{tooltipState.block.end_date || tooltipState.block.endDate || 'Non spécifiée'}</span></div>
            </>
          ) : (
            <>
              <div className="tooltip-row"><span className="tooltip-label">Client:</span><span className="tooltip-value">{tooltipState.block.clientName || 'Non spécifié'}</span></div>
              <div className="tooltip-row"><span className="tooltip-label">Début:</span><span className="tooltip-value">{tooltipState.block.startDate || tooltipState.block.date ? `${formatDateSimple(tooltipState.block.startDate || tooltipState.block.date)} ${(tooltipState.block.startPeriod || tooltipState.block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifié'}</span></div>
              <div className="tooltip-row"><span className="tooltip-label">Fin:</span><span className="tooltip-value">{tooltipState.block.endDate || tooltipState.block.date ? `${formatDateSimple(tooltipState.block.endDate || tooltipState.block.date)} ${(tooltipState.block.endPeriod || tooltipState.block.period) === 'AM' ? 'Matin' : 'Après-midi'}` : 'Non spécifiée'}</span></div>
            </>
          )}
          {tooltipState.block.description && (
            <div className="tooltip-row"><span className="tooltip-label">Description:</span><span className="tooltip-value">{tooltipState.block.description}</span></div>
          )}
          {(() => {
            const driveCount = getDriveLinksCount(tooltipState.block);
            return driveCount > 0 ? (
              <div className="tooltip-row"><span className="tooltip-label"><Link size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Drive:</span><span className="tooltip-value">{driveCount} lien{driveCount > 1 ? 's' : ''}</span></div>
            ) : null;
          })()}
          <div className="tooltip-row">
            <span className="tooltip-label">Créé par:</span>
            <span className="tooltip-value">
              {currentUser && tooltipState.block.createdBy === currentUser.id
                ? currentUser.name
                : users.find(u => u.id === tooltipState.block.createdBy)?.name || `Utilisateur ${tooltipState.block.createdBy}`}
            </span>
          </div>
        </div>
      )}

      {/* Date selectors */}
      {showMonthSelector && (
        <MonthSelector currentDate={currentDate} onSelectMonth={(date) => { setCurrentDate(date); setShowMonthSelector(false); }} onClose={() => setShowMonthSelector(false)} />
      )}
      {showWeekSelector && (
        <WeekSelector currentDate={currentDate} onSelectWeek={(date) => { setCurrentDate(date); setShowWeekSelector(false); }} onClose={() => setShowWeekSelector(false)} />
      )}
      {showYearSelector && (
        <YearSelector currentDate={currentDate} onSelectYear={(date) => { setCurrentDate(date); setShowYearSelector(false); }} onClose={() => setShowYearSelector(false)} />
      )}
      {ConfirmDialogRenderer}
    </div>
  );
};

export default React.memo(Calendar);
