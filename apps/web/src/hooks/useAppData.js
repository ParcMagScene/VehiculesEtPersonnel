import { useState, useEffect, useCallback, useMemo } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import { saveToIndexedDB, STORES } from '../utils/indexedDB';
import { getPeriodTimestamp } from '../utils/dateUtils';
import logger from '../utils/logger';

import { STATUS } from '../constants';

/**
 * Hook centralisant les données métier (véhicules, réservations, maintenances, etc.)
 * et les opérations CRUD associées. Extrait d'App.jsx.
 */
export function useAppData({ isAuthenticated, isAuthLoading, currentUser, toast, onAuthError }) {
  const [vehicles, setVehicles] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [clients, setClients] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [users, setUsers] = useState([]);
  const [persons, setPersons] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState({ apiKey: '', calendarId: '' });
  const [garages, setGarages] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);

  // ══════ Chargement initial + reset au logout ══════
  useEffect(() => {
    if (!isAuthenticated || isAuthLoading) {
      // Reset au logout ou pendant la vérification auth
      setIsDataLoading(true);
      setVehicles([]);
      setReservations([]);
      setClients([]);
      setDrivers([]);
      setLocations([]);
      setGarages([]);
      setMaintenances([]);
      setUsers([]);
      setPersons([]);
      setCalendarConfig({ apiKey: '', calendarId: '' });
      return;
    }

    const loadDataFromAPI = async () => {
      try {
        setIsDataLoading(true);

        const results = await Promise.allSettled([
          api.getVehicles(), api.getReservations(), api.getClients(),
          api.getDrivers(), api.getLocations(), api.getGarages(),
          api.getMaintenances(), api.getConfig('googleCalendar'),
          api.getUsersNames(), api.getPersons()
        ]);

        const get = (i, fallback = []) => results[i].status === 'fulfilled' ? results[i].value : fallback;
        const failed = results.filter(r => r.status === 'rejected');

        if (failed.length > 0) {
          logger.warn(`${failed.length}/10 endpoints échoués au chargement initial`);
          const authFail = failed.find(r => r.reason?.message?.includes('401') || r.reason?.message?.includes('authentification'));
          if (authFail) { onAuthError(); return; }
        }

        setVehicles((get(0) || []).sort((a, b) => (a.order || 0) - (b.order || 0)));
        setReservations(get(1));
        setClients(get(2));
        setDrivers(get(3));
        setLocations(get(4));
        setGarages(get(5));
        setMaintenances(get(6));
        setUsers(get(8));
        setPersons(get(9) || []);

        const configData = get(7, null);
        if (configData?.value) {
          try { setCalendarConfig(JSON.parse(configData.value)); }
          catch { setCalendarConfig({ apiKey: '', calendarId: '' }); }
        }
      } catch (error) {
        console.error('❌ Erreur lors du chargement des données:', error);
        if (error.message?.includes('authentification') || error.message?.includes('401')) {
          onAuthError();
        }
      } finally {
        setIsDataLoading(false);
      }
    };

    loadDataFromAPI();
  }, [isAuthenticated, isAuthLoading, onAuthError]);

  // ══════ Sauvegarde IndexedDB (individual debounced saves) ══════
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.vehicles, vehicles), 500);
    return () => clearTimeout(t);
  }, [vehicles, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.reservations, reservations), 500);
    return () => clearTimeout(t);
  }, [reservations, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.clients, clients), 500);
    return () => clearTimeout(t);
  }, [clients, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.drivers, drivers), 500);
    return () => clearTimeout(t);
  }, [drivers, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.locations, locations), 500);
    return () => clearTimeout(t);
  }, [locations, isDataLoading]);
  useEffect(() => {
    if (isDataLoading || (!calendarConfig?.apiKey && !calendarConfig?.calendarId)) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.calendarConfig, calendarConfig), 500);
    return () => clearTimeout(t);
  }, [calendarConfig, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.garages, garages), 500);
    return () => clearTimeout(t);
  }, [garages, isDataLoading]);
  useEffect(() => {
    if (isDataLoading) return;
    const t = setTimeout(() => saveToIndexedDB(STORES.maintenances, maintenances), 500);
    return () => clearTimeout(t);
  }, [maintenances, isDataLoading]);

  // ══════ Mise à jour automatique des statuts de maintenance ══════
  useEffect(() => {
    const updateMaintenanceStatuses = () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      setMaintenances(prev => {
        let hasChanges = false;
        const updated = prev.map(maintenance => {
          if (maintenance.status === 'reported' || maintenance.status === STATUS.COMPLETED || !maintenance.startDate) {
            return maintenance;
          }
          const startDate = new Date(maintenance.startDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(maintenance.endDate || maintenance.startDate);
          endDate.setHours(0, 0, 0, 0);

          let newStatus = maintenance.status;
          if (today < startDate) newStatus = 'scheduled';
          else if (today >= startDate && today <= endDate) newStatus = 'in_progress';
          else if (today > endDate) newStatus = 'completed';

          if (newStatus !== maintenance.status) {
            hasChanges = true;
            return { ...maintenance, status: newStatus };
          }
          return maintenance;
        });
        return hasChanges ? updated : prev;
      });
    };

    if (!isDataLoading) {
      updateMaintenanceStatuses();
      const interval = setInterval(updateMaintenanceStatuses, 3600000);
      return () => clearInterval(interval);
    }
  }, [isDataLoading]);

  // ══════ Vérification chevauchements ══════
  const checkOverlap = useCallback((vehicleId, startDate, startPeriod, endDate, endPeriod, excludeId = null) => {
    const newStart = getPeriodTimestamp(startDate, startPeriod);
    const newEnd = getPeriodTimestamp(endDate, endPeriod);
    const conflicts = [];

    for (const r of reservations) {
      if (excludeId !== null && String(r.id) === String(excludeId)) continue;
      if (String(r.vehicleId) !== String(vehicleId)) continue;
      const existingStart = getPeriodTimestamp(r.date, r.period);
      const existingEnd = getPeriodTimestamp(r.endDate || r.date, r.endPeriod || r.period);
      if (Math.max(newStart, existingStart) <= Math.min(newEnd, existingEnd)) {
        conflicts.push({ date: r.date, period: r.period, reservation: r });
      }
    }
    return conflicts;
  }, [reservations]);

  // ══════ Réservations CRUD ══════
  const addReservation = useCallback(async (reservationData) => {
    const reservationsToAdd = Array.isArray(reservationData) ? reservationData : [reservationData];
    const newReservations = [];

    for (const data of reservationsToAdd) {
      const { vehicleId, date, period, endDate, endPeriod, ...otherData } = data;

      const conflicts = checkOverlap(vehicleId, date, period, endDate, endPeriod);
      if (conflicts.length > 0) {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const conflictInfo = conflicts[0];
        toast.warning(`Chevauchement : "${vehicle?.name}" déjà réservé le ${format(new Date(conflictInfo.date), 'd MMMM yyyy', { locale: fr })} (${conflictInfo.period})`);
        return false;
      }

      if (!currentUser?.isAdmin) {
        try {
          await api.createReservationRequest({
            id: `${Date.now()}.${Math.random()}`,
            vehicleId, startDate: date, startPeriod: period, endDate, endPeriod, ...otherData
          });
          toast.success('Demande de réservation envoyée aux administrateurs pour validation.');
          return true;
        } catch (error) {
          console.error('❌ Erreur création demande:', error);
          toast.error(`Erreur création demande: ${error.message}`);
          return false;
        }
      }

      try {
        const createdReservation = await api.createReservation({
          id: `${Date.now()}.${Math.random()}`,
          vehicleId, startDate: date, startPeriod: period, endDate, endPeriod, ...otherData
        });
        newReservations.push(createdReservation);
      } catch (error) {
        console.error('❌ Erreur création réservation:', error);
        toast.error(`Erreur création réservation: ${error.message}`);
        return false;
      }
    }

    setReservations(prev => [...prev, ...newReservations]);
    return true;
  }, [checkOverlap, vehicles, currentUser, toast]);

  const updateReservation = useCallback(async (id, updatedReservation) => {
    logger.log('📝 updateReservation appelé - ID:', id, 'Objet:', updatedReservation);

    if (!currentUser?.isAdmin) {
      toast.warning('Seuls les administrateurs peuvent modifier des réservations.');
      return false;
    }

    if (!id || (!updatedReservation.id && id)) {
      logger.warn('⚠️ Objet sans ID détecté, ajout de l\'ID:', id);
      updatedReservation = { ...updatedReservation, id };
    }

    const oldReservation = reservations.find(r => r.id === id);
    if (!oldReservation) {
      console.error('❌ Réservation introuvable:', id);
      return false;
    }

    const { vehicleId, date, period, endDate, endPeriod } = updatedReservation;
    if (!vehicleId) {
      console.error('❌ vehicleId manquant dans updatedReservation:', updatedReservation);
      return false;
    }

    const conflicts = checkOverlap(vehicleId, date, period, endDate, endPeriod, id);
    if (conflicts.length > 0) {
      const vehicle = vehicles.find(v => v.id === vehicleId);
      toast.warning(`Chevauchement : "${vehicle?.name}" a ${conflicts.length} réservation(s) sur cette période`);
      return false;
    }

    try {
      const finalReservation = {
        ...updatedReservation,
        id,
        // Le backend valide start_date/end_date : on normalise depuis date/period du calendrier.
        startDate: updatedReservation.startDate ?? updatedReservation.date,
        startPeriod: updatedReservation.startPeriod ?? updatedReservation.period,
        endDate: updatedReservation.endDate,
        endPeriod: updatedReservation.endPeriod,
      };
      logger.log('✅ Envoi API - Objet final:', finalReservation);
      await api.updateReservation(id, finalReservation);
      setReservations(prev => prev.map(r => r.id === id ? finalReservation : r));
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour réservation:', error);
      toast.error(`Erreur mise à jour: ${error.message}`);
      return false;
    }
  }, [currentUser, reservations, checkOverlap, vehicles, toast]);

  const deleteReservation = useCallback(async (id) => {
    logger.log('🗑️ deleteReservation appelé - ID:', id);

    if (!currentUser?.isAdmin) {
      toast.warning('Seuls les administrateurs peuvent supprimer des réservations.');
      return false;
    }

    try {
      const result = await api.deleteReservation(id);
      logger.log('✅ Suppression API réussie:', result);
      setReservations(prev => prev.filter(r => r.id !== id));
      logger.log('✅ État local mis à jour');
    } catch (error) {
      console.error('❌ Erreur suppression réservation:', error);
      toast.error(`Erreur suppression: ${error.message}`);
    }
  }, [currentUser, toast]);

  // ══════ Maintenances ══════
  const loadMaintenances = useCallback(async () => {
    try {
      const data = await api.getMaintenances();
      setMaintenances(data);
    } catch (error) {
      console.error('Erreur lors du rechargement des maintenances:', error);
      toast.error('Erreur rechargement maintenances');
    }
  }, [toast]);

  const handleMaintenanceSave = useCallback(async (maintenance) => {
    try {
      logger.log('🔧 handleMaintenanceSave appelé avec:', maintenance);

      if (maintenance._deleted) {
        await api.deleteMaintenance(maintenance.id);
        setMaintenances(prev => prev.filter(m => String(m.id) !== String(maintenance.id)));
      } else if (maintenances.find(m => String(m.id) === String(maintenance.id))) {
        logger.log('✅ Mise à jour de la maintenance existante:', maintenance.id);
        await api.updateMaintenance(maintenance.id, maintenance);
        const maintenancesData = await api.getMaintenances();
        setMaintenances(maintenancesData);
      } else {
        logger.log('➕ Création d\'une nouvelle maintenance:', maintenance.id);
        await api.createMaintenance(maintenance);
        const maintenancesData = await api.getMaintenances();
        setMaintenances(maintenancesData);
      }
    } catch (error) {
      console.error('❌ Erreur gestion maintenance:', error);
      toast.error(`Erreur: ${error.message}`);
    }
  }, [maintenances, toast]);

  const updateMaintenanceFromResize = useCallback(async (id, updatedData) => {
    try {
      const existingMaintenance = maintenances.find(m => m.id === id);
      if (!existingMaintenance) {
        console.error('❌ Maintenance introuvable:', id);
        return false;
      }

      const fullMaintenance = {
        ...existingMaintenance,
        ...updatedData,
        id,
        date: updatedData.startDate || updatedData.date,
        end_date: updatedData.endDate
      };

      logger.log('🔄 Mise à jour maintenance - Dates:', {
        avant: { date: existingMaintenance.date, endDate: existingMaintenance.endDate },
        après: { date: fullMaintenance.date, endDate: fullMaintenance.endDate }
      });

      await handleMaintenanceSave(fullMaintenance);
      return true;
    } catch (error) {
      console.error('❌ Erreur mise à jour maintenance:', error);
      toast.error(`Erreur mise à jour maintenance: ${error.message}`);
      return false;
    }
  }, [maintenances, handleMaintenanceSave, toast]);

  const handleUpdateIntervention = useCallback(async (updatedIntervention) => {
    try {
      logger.log('🔧 Mise à jour intervention:', updatedIntervention);
      await api.updateMaintenance(updatedIntervention.id, updatedIntervention);
      setMaintenances(prev => prev.map(m =>
        m.id === updatedIntervention.id ? updatedIntervention : m
      ));
      const maintenancesData = await api.getMaintenances();
      setMaintenances(maintenancesData);
    } catch (error) {
      console.error('❌ Erreur mise à jour intervention:', error);
      toast.error(`Erreur mise à jour intervention: ${error.message}`);
    }
  }, [toast]);

  const handleDeleteIntervention = useCallback(async (interventionId) => {
    try {
      logger.log('🗑️ Suppression intervention:', interventionId);
      await api.deleteMaintenance(interventionId);
      setMaintenances(prev => prev.filter(m => m.id !== interventionId));
    } catch (error) {
      console.error('❌ Erreur suppression intervention:', error);
      toast.error(`Erreur suppression intervention: ${error.message}`);
    }
  }, [toast]);

  return useMemo(() => ({
    // State
    vehicles, setVehicles,
    reservations, setReservations,
    clients, setClients,
    drivers, setDrivers,
    locations, setLocations,
    users, persons,
    calendarConfig, setCalendarConfig,
    garages, setGarages,
    maintenances, setMaintenances,
    isDataLoading,
    // Réservations
    addReservation, updateReservation, deleteReservation,
    // Maintenances
    handleMaintenanceSave, updateMaintenanceFromResize,
    handleUpdateIntervention, handleDeleteIntervention,
    loadMaintenances,
  }), [
    vehicles, reservations, clients, drivers, locations, users, persons,
    calendarConfig, garages, maintenances, isDataLoading,
    addReservation, updateReservation, deleteReservation,
    handleMaintenanceSave, updateMaintenanceFromResize,
    handleUpdateIntervention, handleDeleteIntervention,
    loadMaintenances,
  ]);
}
