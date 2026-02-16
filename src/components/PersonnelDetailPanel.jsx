import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, User, Phone, Mail, Briefcase, Award, Calendar, MapPin, ExternalLink, Link2, Clock, Check, XCircle, Plus } from 'lucide-react';
import api from '../utils/api';
import { formatPhoneDisplay } from './PhoneInput';
import './PersonnelDetailPanel.css';

const CONTRACT_TYPES = [
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'CDD', label: 'CDD' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'prestataire', label: 'Prestataire' },
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'entreprise', label: 'Entreprise' },
];

const POSITION_CATEGORIES = [
  { value: 'technique', label: 'Technique', color: '#3b82f6' },
  { value: 'artistique', label: 'Artistique', color: '#8b5cf6' },
  { value: 'logistique', label: 'Logistique', color: '#f97316' },
  { value: 'administratif', label: 'Administratif', color: '#10b981' },
  { value: 'autre', label: 'Autre', color: '#6b7280' },
];

const getCategoryColor = (category) => {
  const cat = POSITION_CATEGORIES.find(c => c.value === category);
  return cat?.color || '#6b7280';
};

/* ═══════════════════════════════════════════════
   Contenu partagé : infos personnel
   ═══════════════════════════════════════════════ */

const LEAVE_TYPE_COLORS = {
  unavailable: '#94a3b8', conge_paye: '#60a5fa', rtt: '#a78bfa',
  maladie: '#f87171', sans_solde: '#fb923c', formation: '#34d399',
  repos: '#fbbf24', autre: '#9ca3af',
};
const LEAVE_TYPE_LABELS = {
  unavailable: 'Indisponible', conge_paye: 'CP', rtt: 'RTT',
  maladie: 'Maladie', sans_solde: 'Sans solde', formation: 'Formation',
  repos: 'Repos', autre: 'Autre',
};
const STATUS_LABELS = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' };
const STATUS_COLORS = { pending: '#f59e0b', approved: '#10b981', rejected: '#ef4444' };

const PersonnelDetailContent = ({ person, positions = [], skills = [], onRequestLeave }) => {
  if (!person) return null;

  // Parser les postes par défaut
  let defaultPositions = [];
  try {
    const raw = person.defaultPositions || person.default_positions;
    defaultPositions = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  } catch { /* ignore */ }

  const personSkills = person.skills || [];

  return (
    <>
      {/* Identité */}
      <section className="pdp-section">
        <div className="pdp-identity">
          <div className="pdp-avatar-large">
            <User size={36} />
          </div>
          <div className="pdp-identity-info">
            <div className="pdp-fullname">{person.firstName} {person.lastName}</div>
            <div className="pdp-type-row">
              <span className={`pdp-type-badge type-${person.type}`}>
                {person.type === 'permanent' ? 'Permanent' : 'Contractuel'}
              </span>
              {person.type === 'contractuel' && person.contractType && (
                <span className={`pdp-type-badge pdp-contract-badge type-${person.contractType}`}>
                  {CONTRACT_TYPES.find(c => c.value === person.contractType)?.label || person.contractType}
                </span>
              )}
              {person.status === 'inactive' && (
                <span className="pdp-type-badge pdp-inactive-badge">Inactif</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Coordonnées */}
      {(person.phone || person.email) && (
        <section className="pdp-section">
          <h4 className="pdp-section-title"><Phone size={14} /> Coordonnées</h4>
          <div className="pdp-contact-grid">
            {person.phone && (
              <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} className="pdp-contact-item">
                <Phone size={14} />
                <span>{formatPhoneDisplay(person.phone)}</span>
              </a>
            )}
            {person.email && (
              <a href={`mailto:${person.email}`} className="pdp-contact-item">
                <Mail size={14} />
                <span>{person.email}</span>
              </a>
            )}
          </div>
        </section>
      )}

      {/* Postes habituels */}
      {defaultPositions.length > 0 && (
        <section className="pdp-section">
          <h4 className="pdp-section-title"><Briefcase size={14} /> Postes habituels</h4>
          <div className="pdp-chips">
            {defaultPositions.map((name, i) => {
              const posObj = positions.find(p => p.name === name);
              const catColor = POSITION_CATEGORIES.find(c => c.value === posObj?.category)?.color || '#6b7280';
              return (
                <span key={i} className="pdp-chip" style={{ '--chip-color': catColor }}>
                  <Briefcase size={11} /> {name}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* Compétences */}
      {personSkills.length > 0 && (
        <section className="pdp-section">
          <h4 className="pdp-section-title"><Award size={14} /> Compétences</h4>
          <div className="pdp-chips">
            {personSkills.map((s, i) => (
              <span key={i} className="pdp-chip" style={{ '--chip-color': getCategoryColor(s.category) }}>
                <Award size={11} /> {s.name}
                {s.level && <span className="pdp-chip-level">{s.level}</span>}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Compte utilisateur lié */}
      {person.userId && (
        <section className="pdp-section">
          <div className="pdp-linked-account">
            <Link2 size={13} />
            <span>Lié à un compte utilisateur (ID: {person.userId})</span>
          </div>
        </section>
      )}

      {/* Notes */}
      {person.notes && (
        <section className="pdp-section">
          <h4 className="pdp-section-title"><Calendar size={14} /> Notes</h4>
          <div className="pdp-notes">{person.notes}</div>
        </section>
      )}

      {/* Absences / Congés */}
      <PersonnelAbsences personId={person.id} onRequestLeave={onRequestLeave} />
    </>
  );
};

/* ═══════════════════════════════════════════════
   Absences récentes d'une personne
   ═══════════════════════════════════════════════ */
const PersonnelAbsences = ({ personId, onRequestLeave }) => {
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personId) return;
    setLoading(true);
    api.getAvailabilities({ personId })
      .then(data => setAbsences(data || []))
      .catch(() => setAbsences([]))
      .finally(() => setLoading(false));
  }, [personId]);

  // Trier par date de début desc, garder les 10 derniers
  const sorted = [...absences]
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    .slice(0, 10);

  return (
    <section className="pdp-section">
      <h4 className="pdp-section-title">
        <Clock size={14} /> Absences
        {onRequestLeave && (
          <button className="pdp-absence-add-btn" onClick={() => onRequestLeave(personId)} title="Ajouter une absence">
            <Plus size={12} />
          </button>
        )}
      </h4>
      {loading ? (
        <div className="pdp-absence-loading">Chargement...</div>
      ) : sorted.length === 0 ? (
        <div className="pdp-absence-empty">Aucune absence enregistrée</div>
      ) : (
        <div className="pdp-absence-list">
          {sorted.map(a => {
            const leaveColor = LEAVE_TYPE_COLORS[a.type] || '#94a3b8';
            const leaveLabel = LEAVE_TYPE_LABELS[a.type] || a.type;
            const statusLabel = STATUS_LABELS[a.status] || a.status;
            const statusColor = STATUS_COLORS[a.status] || '#94a3b8';
            const start = new Date(a.start_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
            const end = new Date(a.end_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
            return (
              <div key={a.id} className="pdp-absence-item" style={{ borderLeftColor: leaveColor }}>
                <div className="pdp-absence-row">
                  <span className="pdp-absence-type" style={{ color: leaveColor }}>{leaveLabel}</span>
                  <span className="pdp-absence-status" style={{ color: statusColor }}>
                    {a.status === 'pending' && <Clock size={10} />}
                    {a.status === 'approved' && <Check size={10} />}
                    {a.status === 'rejected' && <XCircle size={10} />}
                    {statusLabel}
                  </span>
                </div>
                <div className="pdp-absence-dates">{start} → {end}</div>
                {a.reason && <div className="pdp-absence-reason">{a.reason}</div>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

/* ═══════════════════════════════════════════════
   Volet glissant (slide panel) personnel
   ═══════════════════════════════════════════════ */
const PersonnelSlidePanel = ({ person, positions = [], skills = [], onClose, onEdit, onRequestLeave }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (person) {
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => { setIsVisible(false); setIsClosing(false); }, 350);
      return () => clearTimeout(timer);
    }
  }, [person]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setIsClosing(true);
    setTimeout(() => onClose(), 350);
  }, [onClose]);

  // Clic extérieur
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) handleClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen, handleClose]);

  if (!isVisible && !person) return null;

  const currentPerson = person || {};

  return (
    <div className={`personnel-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`} ref={panelRef}>
      {/* Header */}
      <div className="pdp-slide-header">
        <div className="pdp-slide-title-row">
          <div className="pdp-slide-avatar"><User size={18} /></div>
          <div className="pdp-slide-title-info">
            <span className="pdp-slide-name">{currentPerson.firstName} {currentPerson.lastName}</span>
            <div className="pdp-slide-badges">
              <span className={`pdp-slide-badge type-${currentPerson.type}`}>
                {currentPerson.type === 'permanent' ? 'Permanent' : 'Contractuel'}
              </span>
              {currentPerson.type === 'contractuel' && currentPerson.contractType && (
                <span className="pdp-slide-badge pdp-contract-type">
                  {CONTRACT_TYPES.find(c => c.value === currentPerson.contractType)?.label || currentPerson.contractType}
                </span>
              )}
            </div>
          </div>
        </div>
        <button className="slide-panel-close" onClick={handleClose}>
          <X size={18} />
        </button>
      </div>

      {/* Body */}
      <div className="pdp-slide-body">
        <PersonnelDetailContent
          person={currentPerson}
          positions={positions}
          skills={skills}
          onRequestLeave={onRequestLeave}
        />
      </div>

      {/* Footer */}
      {onEdit && (
        <div className="pdp-slide-footer">
          <button className="pdp-slide-edit-btn" onClick={() => onEdit?.(currentPerson)}>
            <ExternalLink size={14} /> Modifier la fiche
          </button>
        </div>
      )}
    </div>
  );
};

export { PersonnelSlidePanel };
export default PersonnelSlidePanel;
