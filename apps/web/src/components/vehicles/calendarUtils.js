import api from '../../utils/api';
import { STATUS } from '../../constants';

// Fonction pour obtenir les initiales d'un utilisateur
export const getUserInitials = (userId, currentUser, users = []) => {
  if (currentUser && userId === currentUser.id && currentUser.name) {
    return currentUser.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  // Chercher dans la liste des utilisateurs
  const user = users.find((u) => u.id === userId);
  if (user && user.name) {
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  }

  return `U${userId.toString().slice(-1)}`;
};

// Helper pour compter les liens Google Drive d'un bloc
export const getDriveLinksCount = (block) => {
  const raw = block.googleDriveLinks;
  if (Array.isArray(raw) && raw.length > 0) return raw.length;
  const link = block.googleDriveLink;
  if (!link) return 0;
  try {
    const parsed = JSON.parse(link);
    if (Array.isArray(parsed)) return parsed.length;
  } catch {
    /* ignore */
  }
  return link.trim() ? 1 : 0;
};

// Helper pour délier un trajet depuis le calendrier
export const unlinkTripDirectly = async (reservationId, eventId, btn, onLinked) => {
  try {
    if (!reservationId) return;
    if (btn) btn.classList.add('linking');
    await api.unlinkTrip({ reservationId, eventId });
    if (btn) btn.classList.remove('linking');
    if (onLinked) onLinked();
  } catch (err) {
    if (btn) btn.classList.remove('linking');
    console.error('Erreur déliaison trajet:', err);
  }
};

export const linkTripsDirectly = async (reservationId, eventId1, eventId2, btn, onLinked) => {
  try {
    if (!reservationId) return;
    if (btn) btn.classList.add('linking');
    await api.linkTrips({ reservationId, eventId1, eventId2 });
    if (btn) {
      btn.classList.remove('linking');
      btn.classList.add('linked');
    }
    if (onLinked) onLinked();
  } catch (err) {
    if (btn) btn.classList.remove('linking');
    console.error('Erreur liaison trajets:', err);
  }
};

// Transformer les trip details de snake_case vers camelCase
export const transformTripSnake = (detail) => {
  if (!detail) return undefined;
  return {
    ...detail,
    departureLocation: detail.departure_location || detail.departureLocation,
    departureDate: detail.departure_date || detail.departureDate,
    departureTime: detail.departure_time || detail.departureTime,
    arrivalLocation: detail.arrival_location || detail.arrivalLocation,
    arrivalDate: detail.arrival_date || detail.arrivalDate,
    arrivalTime: detail.arrival_time || detail.arrivalTime,
    returnDepartureLocation: detail.return_departure_location || detail.returnDepartureLocation,
    returnDepartureDate: detail.return_departure_date || detail.returnDepartureDate,
    returnDepartureTime: detail.return_departure_time || detail.returnDepartureTime,
    returnArrivalLocation: detail.return_arrival_location || detail.returnArrivalLocation,
    returnArrivalDate: detail.return_arrival_date || detail.returnArrivalDate,
    returnArrivalTime: detail.return_arrival_time || detail.returnArrivalTime,
    driverName: detail.driver_name || detail.driverName,
    hasJunctionWithNext: detail.has_junction_with_next || detail.hasJunctionWithNext,
    junctionLocation: detail.junction_location || detail.junctionLocation,
    outboundDuration: detail.outbound_duration || detail.outboundDuration,
    returnDuration: detail.return_duration || detail.returnDuration,
    tripGroupId: detail.trip_group_id || detail.tripGroupId,
  };
};

// Couleurs des interventions selon le statut
export const getMaintenanceStatusStyle = (status, hasConflict) => {
  // Les interventions terminées ou annulées ne montrent pas les conflits
  if (hasConflict && status !== STATUS.COMPLETED && status !== STATUS.CANCELLED) {
    return {
      bg: 'var(--theme-danger-bg)',
      border: '2px solid var(--theme-danger-dark)',
      icon: '⚠️',
    };
  }
  const styles = {
    scheduled: { bg: 'var(--theme-info-bg)', border: '2px dashed var(--theme-info)', icon: '📅' },
    completed: {
      bg: 'var(--theme-success-bg)',
      border: '2px solid var(--theme-success-alt)',
      icon: '✅',
    },
    reported: { bg: 'var(--theme-danger-bg)', border: '2px solid var(--theme-danger)', icon: '⚠️' },
    pending: {
      bg: 'var(--theme-purple-bg)',
      border: '2px dashed var(--theme-primary-light)',
      icon: '📝',
    },
    in_progress: {
      bg: 'var(--theme-warning-bg)',
      border: '2px solid var(--theme-warning)',
      icon: '🔧',
    },
    IN_PROGRESS: {
      bg: 'var(--theme-warning-bg)',
      border: '2px solid var(--theme-warning)',
      icon: '🔧',
    },
    cancelled: {
      bg: 'var(--theme-bg-tertiary)',
      border: '2px dashed var(--theme-text-gray)',
      icon: '❌',
    },
    rescheduled: {
      bg: 'var(--theme-orange-bg, #ffedd5)',
      border: '2px dashed var(--theme-warning, #f97316)',
      icon: '🔄',
    },
  };
  return (
    styles[status] || {
      bg: 'var(--theme-bg-tertiary)',
      border: '2px dashed var(--theme-text-gray)',
      icon: '🔧',
    }
  );
};
