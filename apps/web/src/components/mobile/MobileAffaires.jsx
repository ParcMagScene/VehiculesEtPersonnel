import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowLeft, ChevronLeft, ChevronRight, Calendar, MapPin, User, Phone,
  FileText, Truck, Clock, Package, Users, DollarSign, Briefcase,
  ClipboardList, CheckCircle, AlertCircle,
} from 'lucide-react';
import { format, addDays, startOfDay, parseISO, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../utils/api';
import { AFFAIRE_TYPES, getTypeInfo } from '../../utils/affaireConstants';
import './MobileAffaires.css';
import { Avatar, Button, Input, SearchBar, Spinner } from '@/design-system';

import { STATUS } from '../../constants';

// Statut temporel
const getAffaireStatus = (a, todayStr) => {
  const debut = a.dateDebut || '';
  const fin = a.dateFin || a.dateDebut || '';
  if (!debut) return 'unknown';
  if (fin < todayStr) return 'past';
  if (debut <= todayStr && fin >= todayStr) return 'active';
  return 'upcoming';
};

function MobileAffaires({ onBack }) {
  const [affaires, setAffaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAffaire, setSelectedAffaire] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(startOfDay(new Date()));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState(null); // null = tous
  const searchRef = useRef(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Charger toutes les affaires
  const loadAffaires = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAffaires();
      setAffaires(data);
    } catch (err) {
      console.error('Erreur chargement affaires:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAffaires(); }, [loadAffaires]);

  // Filtrer : affaires en cours ou à venir dans la semaine suivante depuis la date courante
  const filteredAffaires = useMemo(() => {
    const currentStr = format(currentDate, 'yyyy-MM-dd');
    const weekEnd = format(addDays(currentDate, 7), 'yyyy-MM-dd');
    const term = searchTerm.toLowerCase().trim();

    return affaires
      .filter(a => {
        const debut = a.dateDebut || '';
        const fin = a.dateFin || a.dateDebut || '';
        if (!debut) return false;
        const isActive = debut <= currentStr && fin >= currentStr;
        const isUpcoming = debut > currentStr && debut <= weekEnd;
        if (!isActive && !isUpcoming) return false;

        // Filtre par type
        if (filterType && a.type !== filterType) return false;

        // Recherche texte
        if (term) {
          const haystack = [a.numeroAffaire, a.client, a.nom, a.titre, a.eventName, a.adresseLivraison]
            .filter(Boolean).join(' ').toLowerCase();
          if (!haystack.includes(term)) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const sa = getAffaireStatus(a, currentStr);
        const sb = getAffaireStatus(b, currentStr);
        if (sa === STATUS.ACTIVE && sb !== STATUS.ACTIVE) return -1;
        if (sb === STATUS.ACTIVE && sa !== STATUS.ACTIVE) return 1;
        return (a.dateDebut || '').localeCompare(b.dateDebut || '');
      });
  }, [affaires, currentDate, searchTerm, filterType]);

  // Navigation par jour
  const navigate = (dir) => setCurrentDate(prev => addDays(prev, dir));
  const isToday = isSameDay(currentDate, new Date());

  // Charger les détails quand on sélectionne une affaire
  const openDetail = useCallback(async (affaire) => {
    setSelectedAffaire(affaire);
    if (!affaire.id) { setDetailData(null); return; }
    setDetailLoading(true);
    try {
      const [links, personnelCounts, allReservations, tasks, allMissions] = await Promise.all([
        api.getAffaireLinks(affaire.id).catch(() => ({ children: [], parents: [], total: 0 })),
        api.getAffairesPersonnelCounts().catch(() => ({})),
        api.getReservations().catch(() => []),
        api.getTasks({ affaire_num: affaire.numeroAffaire }).catch(() => []),
        api.getMissions().catch(() => []),
      ]);

      // Filtrer les réservations liées
      const reservations = (Array.isArray(allReservations) ? allReservations : [])
        .filter(r => r.affaire === affaire.numeroAffaire);

      // Extraire le personnel depuis les missions
      const linkedMissions = (Array.isArray(allMissions) ? allMissions : [])
        .filter(m => m.affaire === affaire.numeroAffaire);
      const personnelMap = new Map();
      linkedMissions.forEach(m => {
        (m.assignments || []).forEach(a => {
          if (a.personId && !personnelMap.has(a.personId)) {
            personnelMap.set(a.personId, { id: a.personId, name: a.personName || a.name || `Personne #${a.personId}`, role: a.role || '' });
          }
        });
      });
      const personnel = Array.from(personnelMap.values());

      setDetailData({
        links,
        personnelCount: personnelCounts[affaire.numeroAffaire] || personnel.length || 0,
        reservations,
        tasks: Array.isArray(tasks) ? tasks : [],
        personnel,
      });
    } catch {
      setDetailData(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ═══ Vue Détail ═══
  if (selectedAffaire) {
    const a = selectedAffaire;
    const typeInfo = getTypeInfo(a.type);
    const status = getAffaireStatus(a, todayStr);
    const statusLabel = status === STATUS.ACTIVE ? 'En cours' : status === 'upcoming' ? 'À venir' : status === 'past' ? 'Terminée' : '';

    return (
      <div className="mobile-affaires">
        <div className="maff-header">
          <Button variant="ghost" className="maff-back" onClick={() => { setSelectedAffaire(null); setDetailData(null); }}>
            <ArrowLeft size={20} />
          </Button>
          <h2>{a.numeroAffaire || 'Affaire'}</h2>
        </div>

        <div className="maff-detail">
          {/* Bandeau type + statut */}
          <div className="maff-detail-top">
            <span className="maff-type-tag" style={{ background: typeInfo.color }}>
              {typeInfo.icon} {typeInfo.label}
            </span>
            <span className={`maff-status-badge ${status}`}>{statusLabel}</span>
          </div>

          {/* Nom / Titre */}
          {(a.nom || a.titre || a.eventName) && (
            <div className="maff-detail-title">
              {a.nom || a.titre || a.eventName}
            </div>
          )}

          {/* Dates */}
          <div className="maff-detail-section">
            <h4><Calendar size={16} /> Période</h4>
            <div className="maff-detail-row">
              {a.dateDebut && format(parseISO(a.dateDebut), 'd MMMM yyyy', { locale: fr })}
              {a.dateFin && a.dateFin !== a.dateDebut && (
                <> → {format(parseISO(a.dateFin), 'd MMMM yyyy', { locale: fr })}</>
              )}
            </div>
          </div>

          {/* Client & Contact */}
          {(a.client || a.interlocuteur || a.tel) && (
            <div className="maff-detail-section">
              <h4><User size={16} /> Contact</h4>
              {a.client && <div className="maff-detail-row maff-client">{a.client}</div>}
              {a.interlocuteur && <div className="maff-detail-row muted">{a.interlocuteur}</div>}
              {a.tel && (
                <a href={`tel:${a.tel.replace(/[^\d+]/g, '')}`} className="maff-detail-row maff-phone">
                  <Phone size={14} /> {a.tel}
                </a>
              )}
            </div>
          )}

          {/* Adresse */}
          {a.adresseLivraison && (
            <div className="maff-detail-section">
              <h4><MapPin size={16} /> Lieu</h4>
              <div className="maff-detail-row">{a.adresseLivraison}</div>
            </div>
          )}

          {/* Description */}
          {a.description && (
            <div className="maff-detail-section">
              <h4><FileText size={16} /> Description</h4>
              <div className="maff-detail-desc">{a.description}</div>
            </div>
          )}

          {/* Devis */}
          {a.devis && (
            <div className="maff-detail-section">
              <h4><DollarSign size={16} /> Devis</h4>
              <div className="maff-detail-row">{a.devis}</div>
            </div>
          )}

          {/* Compteurs */}
          <div className="maff-detail-section">
            <h4><Package size={16} /> Ressources</h4>
            <div className="maff-detail-counters">
              {a.reservationCount > 0 && (
                <div className="maff-counter">
                  <Truck size={16} />
                  <span>{a.reservationCount} réservation{a.reservationCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {(detailData?.personnelCount > 0 || a.personnelCount > 0) && (
                <div className="maff-counter">
                  <Users size={16} />
                  <span>{detailData?.personnelCount || a.personnelCount} personne{(detailData?.personnelCount || a.personnelCount) > 1 ? 's' : ''}</span>
                </div>
              )}
              {a.vehicleCount > 0 && (
                <div className="maff-counter">
                  <Truck size={16} />
                  <span>{a.vehicleCount} véhicule{a.vehicleCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {a.blImportCount > 0 && (
                <div className="maff-counter">
                  <FileText size={16} />
                  <span>{a.blImportCount} BL/BP</span>
                </div>
              )}
              {a.orderCount > 0 && (
                <div className="maff-counter">
                  <DollarSign size={16} />
                  <span>{a.orderCount} commande{a.orderCount > 1 ? 's' : ''}</span>
                </div>
              )}
              {!a.reservationCount && !a.vehicleCount && !a.blImportCount && !a.orderCount && !(detailData?.personnelCount > 0 || a.personnelCount > 0) && (
                <div className="maff-counter muted">Aucune ressource liée</div>
              )}
            </div>
          </div>

          {/* Réservations liées */}
          {detailData?.reservations?.length > 0 && (
            <div className="maff-detail-section">
              <h4><Truck size={16} /> Réservations</h4>
              <div className="maff-resa-list">
                {detailData.reservations.map((r, i) => (
                  <div key={r.id || i} className="maff-resa-card">
                    <div className="maff-resa-name">{r.vehicleName || r.vehicle || r.vehicleId || 'Véhicule'}</div>
                    <div className="maff-resa-dates">
                      <Calendar size={13} />
                      {r.startDate && format(parseISO(r.startDate), 'd MMM', { locale: fr })}
                      {r.endDate && r.endDate !== r.startDate && (
                        <> → {format(parseISO(r.endDate), 'd MMM', { locale: fr })}</>
                      )}
                    </div>
                    {r.status && <span className={`maff-resa-status ${r.status}`}>{r.status}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Planification / Tâches */}
          {detailData?.tasks?.length > 0 && (
            <div className="maff-detail-section">
              <h4><ClipboardList size={16} /> Planification</h4>
              <div className="maff-tasks-list">
                {detailData.tasks.map((t, i) => (
                  <div key={t.id || i} className="maff-task-card">
                    <span className={`maff-task-status-icon ${t.status === STATUS.DONE ? 'done' : t.status === 'in_progress' ? 'progress' : ''}`}>
                      {t.status === STATUS.DONE ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
                    </span>
                    <div className="maff-task-info">
                      <div className="maff-task-title">{t.title || t.description || 'Tâche'}</div>
                      {t.section && <div className="maff-task-section">{t.section}</div>}
                    </div>
                    {t.assignee && <span className="maff-task-assignee">{t.assignee}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Personnel affecté */}
          {detailData?.personnel?.length > 0 && (
            <div className="maff-detail-section">
              <h4><Users size={16} /> Personnel affecté</h4>
              <div className="maff-personnel-list">
                {detailData.personnel.map((p, i) => (
                  <div key={p.id || i} className="maff-person-card">
                    <Avatar name={p.name} size="xs" />
                    <div className="maff-person-info">
                      <div className="maff-person-name">{p.name}</div>
                      {p.role && <div className="maff-person-role">{p.role}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Affaires liées (Tournée) */}
          {detailData?.links && (detailData.links.children.length > 0 || detailData.links.parents.length > 0) && (
            <div className="maff-detail-section">
              <h4><Briefcase size={16} /> Affaires liées</h4>
              {detailData.links.parents.map(p => (
                <div key={p.id} className="maff-linked-card" onClick={() => openDetail(p)}>
                  <span className="maff-linked-label">Parent</span>
                  <span className="maff-linked-num">{p.numeroAffaire}</span>
                  <span className="maff-linked-name">{p.nom || p.client || ''}</span>
                </div>
              ))}
              {detailData.links.children.map(c => (
                <div key={c.id} className="maff-linked-card" onClick={() => openDetail(c)}>
                  <span className="maff-linked-label">Enfant</span>
                  <span className="maff-linked-num">{c.numeroAffaire}</span>
                  <span className="maff-linked-name">{c.nom || c.client || ''}</span>
                </div>
              ))}
            </div>
          )}

          {detailLoading && (
            <div className="maff-detail-loading">
              <Spinner size="lg" />
            </div>
          )}
        </div>
      </div>
    );
  }

  // ═══ Vue Liste ═══
  return (
    <div className="mobile-affaires">
      <div className="maff-header">
        <Button variant="ghost" className="maff-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </Button>
        <h2>Affaires</h2>
      </div>

      {/* Navigation date */}
      <div className="maff-date-nav">
        <Button variant="ghost" className="maff-nav-btn" onClick={() => navigate(-1)}>
          <ChevronLeft size={20} />
        </Button>
        <Button variant="ghost"           className={`maff-date-label ${isToday ? 'today' : ''}`}
          onClick={() => setCurrentDate(startOfDay(new Date()))}
        >
          {format(currentDate, 'EEEE d MMMM', { locale: fr })}
        </Button>
        <Button variant="ghost" className="maff-nav-btn" onClick={() => navigate(1)}>
          <ChevronRight size={20} />
        </Button>
      </div>
      {!isToday && (
        <Button variant="ghost" className="maff-today-btn" onClick={() => setCurrentDate(startOfDay(new Date()))}>
          Aujourd'hui
        </Button>
      )}

      {/* Recherche */}
      <SearchBar
        ref={searchRef}
        value={searchTerm}
        onChange={setSearchTerm}
        placeholder="Rechercher (n°, client, lieu…)"
      />

      {/* Filtres par type */}
      <div className="maff-type-filters">
        <Button variant="ghost"           className={`maff-filter-pill ${filterType === null ? 'active' : ''}`}
          onClick={() => setFilterType(null)}
        >
          Tous
        </Button>
        {AFFAIRE_TYPES.map(t => (
          <Button variant="ghost"             key={t.value}
            className={`maff-filter-pill ${filterType === t.value ? 'active' : ''}`}
            style={filterType === t.value ? { background: t.color, color: '#fff', borderColor: t.color } : {}}
            onClick={() => setFilterType(filterType === t.value ? null : t.value)}
          >
            {t.icon} {t.label}
          </Button>
        ))}
      </div>

      {/* Sous-titre */}
      <div className="maff-subtitle">
        En cours & à venir (7 jours)
        <span className="maff-count">{filteredAffaires.length}</span>
      </div>

      {loading ? (
        <div className="maff-loading">
          <Spinner size="lg" />
          <p>Chargement…</p>
        </div>
      ) : filteredAffaires.length === 0 ? (
        <div className="maff-empty">
          <Briefcase size={40} />
          <p>Aucune affaire en cours ou à venir</p>
        </div>
      ) : (
        <div className="maff-list">
          {filteredAffaires.map(a => {
            const currentStr = format(currentDate, 'yyyy-MM-dd');
            const status = getAffaireStatus(a, currentStr);
            const typeInfo = getTypeInfo(a.type);
            const isActive = status === STATUS.ACTIVE;
            return (
              <div
                key={a.id || a.numeroAffaire}
                className={`maff-card ${isActive ? 'active' : ''}`}
                onClick={() => openDetail(a)}
              >
                <div className="maff-card-header">
                  <span className="maff-card-type" style={{ background: typeInfo.color }}>
                    {typeInfo.icon}
                  </span>
                  <span className="maff-card-num">{a.numeroAffaire}</span>
                  <span className={`maff-card-status ${status}`}>
                    {isActive ? 'En cours' : 'À venir'}
                  </span>
                </div>

                <div className="maff-card-title">
                  {a.nom || a.titre || a.eventName || '—'}
                </div>

                {a.client && (
                  <div className="maff-card-client">{a.client}</div>
                )}

                <div className="maff-card-footer">
                  <span className="maff-card-dates">
                    <Calendar size={13} />
                    {a.dateDebut && format(parseISO(a.dateDebut), 'd MMM', { locale: fr })}
                    {a.dateFin && a.dateFin !== a.dateDebut && (
                      <> → {format(parseISO(a.dateFin), 'd MMM', { locale: fr })}</>
                    )}
                  </span>
                  {a.adresseLivraison && (
                    <span className="maff-card-lieu">
                      <MapPin size={13} />
                      <span>{a.adresseLivraison}</span>
                    </span>
                  )}
                </div>

                {/* Badges compteurs */}
                {(a.reservationCount > 0 || a.personnelCount > 0 || a.blImportCount > 0) && (
                  <div className="maff-card-badges">
                    {a.reservationCount > 0 && (
                      <span className="maff-badge"><Truck size={12} /> {a.reservationCount}</span>
                    )}
                    {a.personnelCount > 0 && (
                      <span className="maff-badge"><Users size={12} /> {a.personnelCount}</span>
                    )}
                    {a.blImportCount > 0 && (
                      <span className="maff-badge"><FileText size={12} /> {a.blImportCount}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MobileAffaires;
