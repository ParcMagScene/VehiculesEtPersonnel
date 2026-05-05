import './PersonnelDetailPanel.css';

import {
  Award,
  Briefcase,
  Calendar,
  Check,
  Clock,
  ExternalLink,
  Link2,
  Mail,
  Phone,
  Plus,
  X,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Avatar, Button, SectionHeader, Tag, Tooltip } from '@/design-system';

import { STATUS } from '../../constants';
import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';
import api from '../../utils/api';
import { formatPhoneDisplay } from '../PhoneInput';

const CONTRACT_TYPES = [
  { value: 'intermittent', label: 'Intermittent' },
  { value: 'CDD', label: 'CDD' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'prestataire', label: 'Prestataire' },
  { value: 'auto-entrepreneur', label: 'Auto-entrepreneur' },
  { value: 'entreprise', label: 'Entreprise' },
];

const POSITION_CATEGORIES = [
  { value: 'administratif', label: 'Administration & Direction', color: '#7c3aed' },
  { value: 'direction', label: 'Direction technique & Régie', color: STATUS_COLORS.dangerDark },
  { value: 'son', label: 'Son (Audio)', color: STATUS_COLORS.info },
  { value: 'lumiere', label: 'Lumière', color: ACCENT_COLORS.amber },
  { value: 'video', label: 'Vidéo & Média', color: ACCENT_COLORS.violet },
  { value: 'plateau', label: 'Plateau, Décors & Machinerie', color: STATUS_COLORS.danger },
  { value: 'backline', label: 'Backline', color: ACCENT_COLORS.orange },
  { value: 'costumes', label: 'Costumes, Maquillage & Habillage', color: ACCENT_COLORS.pink },
  { value: 'electricite', label: 'Électricité & Réseaux', color: ACCENT_COLORS.cyan },
  { value: 'logistique', label: 'Logistique & Transport', color: STATUS_COLORS.success },
  { value: 'captation', label: 'Audiovisuel & Captation', color: ACCENT_COLORS.indigo },
  { value: 'production', label: 'Production & Coordination', color: '#78716c' },
  { value: 'autre', label: 'Autre', color: 'var(--theme-text-gray)' },
];

const getCategoryColor = (category) => {
  const cat = POSITION_CATEGORIES.find((c) => c.value === category);
  return cat?.color || 'var(--theme-text-gray)';
};

/* ═══════════════════════════════════════════════
   Contenu partagé : infos personnel
   ═══════════════════════════════════════════════ */

const LEAVE_TYPE_COLORS = {
  unavailable: 'var(--theme-text-muted)',
  absence: STATUS_COLORS.danger,
  conge_paye: '#60a5fa',
  rtt: '#a78bfa',
  maladie: '#f87171',
  sans_solde: '#fb923c',
  formation: '#34d399',
  repos: '#fbbf24',
  autre: 'var(--theme-text-muted)',
};
const LEAVE_TYPE_LABELS = {
  unavailable: 'Indisponible',
  conge_paye: 'CP',
  rtt: 'RTT',
  maladie: 'Maladie',
  sans_solde: 'Sans solde',
  formation: 'Formation',
  repos: 'Repos',
  autre: 'Autre',
  absence: 'Absence',
};
const STATUS_LABELS = { pending: 'En attente', approved: 'Approuvé', rejected: 'Refusé' };
const LEAVE_APPROVAL_COLORS = {
  pending: STATUS_COLORS.warning,
  approved: STATUS_COLORS.success,
  rejected: STATUS_COLORS.danger,
};

const PersonnelDetailContent = ({ person, positions = [], _skills = [], onRequestLeave }) => {
  if (!person) return null;

  // Parser les postes par défaut
  let defaultPositions = [];
  try {
    const raw = person.defaultPositions || person.default_positions;
    defaultPositions = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
  } catch {
    /* ignore */
  }

  const personSkills = person.skills || [];

  return (
    <>
      {/* Identité */}
      <section className="pdp-section">
        <div className="pdp-identity">
          <div className="pdp-avatar-large">
            <Avatar name={`${person.firstName} ${person.lastName}`} size="xl" />
          </div>
          <div className="pdp-identity-info">
            <div className="pdp-fullname">
              {person.firstName} {person.lastName}
            </div>
            <div className="pdp-type-row">
              <Tag color={person.type === 'permanent' ? 'primary' : 'amber'} size="sm">
                {person.type === 'permanent' ? 'Permanent' : 'Contractuel'}
              </Tag>
              {person.type === 'contractuel' && person.contractType && (
                <Tag color="info" size="sm">
                  {CONTRACT_TYPES.find((c) => c.value === person.contractType)?.label ||
                    person.contractType}
                </Tag>
              )}
              {person.status === STATUS.INACTIVE && (
                <Tag color="neutral" size="sm">
                  Inactif
                </Tag>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Coordonnées */}
      {(person.phone || person.email) && (
        <section className="pdp-section">
          <SectionHeader
            className="pdp-section-title"
            as="h4"
            icon={<Phone size={14} />}
            title="Coordonnées"
          />
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
          <SectionHeader
            className="pdp-section-title"
            as="h4"
            icon={<Briefcase size={14} />}
            title="Postes habituels"
          />
          <div className="pdp-chips">
            {defaultPositions.map((name, i) => {
              const posObj = positions.find((p) => p.name === name);
              const catColor =
                POSITION_CATEGORIES.find((c) => c.value === posObj?.category)?.color ||
                'var(--theme-text-gray)';
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
          <SectionHeader
            className="pdp-section-title"
            as="h4"
            icon={<Award size={14} />}
            title="Compétences"
          />
          <div className="pdp-chips">
            {personSkills.map((s, i) => (
              <span
                key={i}
                className="pdp-chip"
                style={{ '--chip-color': getCategoryColor(s.category) }}
              >
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
          <SectionHeader
            className="pdp-section-title"
            as="h4"
            icon={<Calendar size={14} />}
            title="Notes"
          />
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    api
      .getAvailabilities({ personId })
      .then((data) => setAbsences(data || []))
      .catch(() => setAbsences([]))
      .finally(() => setLoading(false));
  }, [personId]);

  // Trier par date de début desc, garder les 10 derniers
  const sorted = [...absences]
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))
    .slice(0, 10);

  return (
    <section className="pdp-section">
      <SectionHeader
        className="pdp-section-title"
        as="h4"
        icon={<Clock size={14} />}
        title="Absences"
        actions={
          onRequestLeave && (
            <Tooltip content="Ajouter une absence" position="bottom">
              <Button
                variant="ghost"
                className="pdp-absence-add-btn"
                onClick={() => onRequestLeave(personId)}
              >
                <Plus size={12} />
              </Button>
            </Tooltip>
          )
        }
      />
      {loading ? (
        <div className="pdp-absence-loading">Chargement...</div>
      ) : sorted.length === 0 ? (
        <div className="pdp-absence-empty">Aucune absence enregistrée</div>
      ) : (
        <div className="pdp-absence-list">
          {sorted.map((a) => {
            const leaveColor = LEAVE_TYPE_COLORS[a.type] || 'var(--theme-text-muted)';
            const leaveLabel = LEAVE_TYPE_LABELS[a.type] || a.type;
            const statusLabel = STATUS_LABELS[a.status] || a.status;
            const statusColor = LEAVE_APPROVAL_COLORS[a.status] || 'var(--theme-text-muted)';
            const start = new Date(a.start_date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
            });
            const end = new Date(a.end_date).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            });
            return (
              <div key={a.id} className="pdp-absence-item" style={{ borderLeftColor: leaveColor }}>
                <div className="pdp-absence-row">
                  <span className="pdp-absence-type" style={{ color: leaveColor }}>
                    {leaveLabel}
                  </span>
                  <span className="pdp-absence-status" style={{ color: statusColor }}>
                    {a.status === STATUS.PENDING && <Clock size={10} />}
                    {a.status === STATUS.APPROVED && <Check size={10} />}
                    {a.status === STATUS.REJECTED && <XCircle size={10} />}
                    {statusLabel}
                  </span>
                </div>
                <div className="pdp-absence-dates">
                  {start} → {end}
                </div>
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
const PersonnelSlidePanel = ({
  person,
  positions = [],
  skills = [],
  onClose,
  onEdit,
  onRequestLeave,
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (person) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(true);
      setIsClosing(false);
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsOpen(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      setIsOpen(false);
      setIsClosing(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsClosing(false);
      }, 350);
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
    <div
      className={`personnel-slide-panel ${isClosing ? 'closing' : isOpen ? 'open' : ''}`}
      ref={panelRef}
    >
      {/* Header */}
      <div className="pdp-slide-header">
        <div className="pdp-slide-title-row">
          <div className="pdp-slide-avatar">
            <Avatar name={`${currentPerson.firstName} ${currentPerson.lastName}`} size="xs" />
          </div>
          <div className="pdp-slide-title-info">
            <span className="pdp-slide-name">
              {currentPerson.firstName} {currentPerson.lastName}
            </span>
            <div className="pdp-slide-badges">
              <Tag color={currentPerson.type === 'permanent' ? 'primary' : 'amber'} size="sm">
                {currentPerson.type === 'permanent' ? 'Permanent' : 'Contractuel'}
              </Tag>
              {currentPerson.type === 'contractuel' && currentPerson.contractType && (
                <Tag color="info" size="sm">
                  {CONTRACT_TYPES.find((c) => c.value === currentPerson.contractType)?.label ||
                    currentPerson.contractType}
                </Tag>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          className="slide-panel-close"
          onClick={handleClose}
          aria-label="Fermer"
        >
          <X size={18} />
        </Button>
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
          <Button
            variant="ghost"
            className="pdp-slide-edit-btn"
            onClick={() => onEdit?.(currentPerson)}
          >
            <ExternalLink size={14} /> Modifier la fiche
          </Button>
        </div>
      )}
    </div>
  );
};

export { PersonnelSlidePanel };
export default PersonnelSlidePanel;
