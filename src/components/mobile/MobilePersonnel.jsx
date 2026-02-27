import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, User, Phone, Mail, MapPin, ChevronRight, Star, Shield, Truck } from 'lucide-react';
import api from '../../utils/api';
import { formatPhoneDisplay } from '../PhoneInput';
import './MobilePersonnel.css';

const getInitials = (firstName, lastName) => {
  const f = firstName?.[0] || '';
  const l = lastName?.[0] || '';
  return (f + l).toUpperCase() || '?';
};

const getAvatarColor = (name) => {
  if (!name) return 'var(--theme-text-muted)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
  return colors[Math.abs(hash) % colors.length];
};

const skillIcon = (skillName) => {
  if (!skillName) return <Star size={12} />;
  const n = skillName.toLowerCase();
  if (n.includes('conduite')) return <Truck size={12} />;
  if (n.includes('sécurité') || n.includes('securite') || n.includes('habilitation')) return <Shield size={12} />;
  return <Star size={12} />;
};

function MobilePersonnel({ onBack }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'active', 'inactive'

  const loadPersons = useCallback(async () => {
    try {
      const data = await api.getPersons();
      setPersons(data);
    } catch (err) {
      console.error('Erreur chargement personnel:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  const filtered = persons.filter(p => {
    // Filtre statut
    if (filter === 'active' && p.status !== 'active') return false;
    if (filter === 'inactive' && p.status === 'active') return false;
    // Filtre recherche
    if (search) {
      const s = search.toLowerCase();
      const fullName = `${p.firstName || ''} ${p.lastName || ''}`.toLowerCase();
      const email = (p.email || '').toLowerCase();
      const phone = (p.phone || '').toLowerCase();
      return fullName.includes(s) || email.includes(s) || phone.includes(s);
    }
    return true;
  });

  const activeCount = persons.filter(p => p.status === 'active').length;
  const totalSkills = new Set(persons.flatMap(p => (p.skills || []).map(s => s.name))).size;

  // Vue détail personne
  if (selectedPerson) {
    const p = selectedPerson;
    const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
    return (
      <div className="mobile-personnel">
        <div className="mpers-header">
          <button className="mpers-back" onClick={() => setSelectedPerson(null)}>
            <ArrowLeft size={20} />
          </button>
          <h2>{fullName || `Personnel #${p.id}`}</h2>
        </div>

        <div className="mpers-detail">
          <div className="mpers-detail-top">
            {p.photo ? (
              <img src={`/avatars/${p.photo}`} alt="" className="mpers-detail-photo" />
            ) : (
              <div className="mpers-detail-avatar" style={{ background: getAvatarColor(fullName) }}>
                {getInitials(p.firstName, p.lastName)}
              </div>
            )}
            <h3>{fullName}</h3>
            <span className={`mpers-status-tag ${p.status === 'active' ? 'active' : 'inactive'}`}>
              {p.status === 'active' ? 'Actif' : 'Inactif'}
            </span>
            {p.contractType && (
              <span className="mpers-contract">{p.contractType}</span>
            )}
          </div>

          {/* Coordonnées */}
          <div className="mpers-section">
            <h4>Coordonnées</h4>
            {p.email && (
              <a href={`mailto:${p.email}`} className="mpers-info-row">
                <Mail size={16} />
                <span>{p.email}</span>
              </a>
            )}
            {p.phone && (
              <a href={`tel:${p.phone.replace(/[^\d+]/g, '')}`} className="mpers-info-row">
                <Phone size={16} />
                <span>{formatPhoneDisplay(p.phone)}</span>
              </a>
            )}
            {!p.email && !p.phone && (
              <p className="mpers-empty-info">Aucune coordonnée renseignée</p>
            )}
          </div>

          {/* Compétences */}
          <div className="mpers-section">
            <h4>Compétences</h4>
            {p.skills?.length > 0 ? (
              <div className="mpers-skills">
                {p.skills.map((skill, i) => (
                  <div key={i} className="mpers-skill-chip">
                    {skillIcon(skill.name)}
                    <span>{skill.name}</span>
                    {skill.level && <span className="mpers-skill-level">{skill.level}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mpers-empty-info">Aucune compétence enregistrée</p>
            )}
          </div>

          {/* Postes par défaut */}
          {p.defaultPositions?.length > 0 && (
            <div className="mpers-section">
              <h4>Postes par défaut</h4>
              <div className="mpers-positions">
                {p.defaultPositions.map((pos, i) => (
                  <span key={i} className="mpers-position-tag">{pos}</span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {p.notes && (
            <div className="mpers-section">
              <h4>Notes</h4>
              <p className="mpers-notes">{p.notes}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Vue liste
  return (
    <div className="mobile-personnel">
      <div className="mpers-header">
        <button className="mpers-back" onClick={onBack}>
          <ArrowLeft size={20} />
        </button>
        <h2>Personnel</h2>
      </div>

      {/* Stats rapides */}
      <div className="mpers-stats">
        <div className="mpers-stat">
          <span className="mpers-stat-value">{activeCount}</span>
          <span className="mpers-stat-label">Actifs</span>
        </div>
        <div className="mpers-stat">
          <span className="mpers-stat-value">{persons.length}</span>
          <span className="mpers-stat-label">Total</span>
        </div>
        <div className="mpers-stat">
          <span className="mpers-stat-value">{totalSkills}</span>
          <span className="mpers-stat-label">Compétences</span>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="mpers-search-bar">
        <Search size={18} />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtres */}
      <div className="mpers-filters">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
          Tous ({persons.length})
        </button>
        <button className={filter === 'active' ? 'active' : ''} onClick={() => setFilter('active')}>
          Actifs ({activeCount})
        </button>
        <button className={filter === 'inactive' ? 'active' : ''} onClick={() => setFilter('inactive')}>
          Inactifs ({persons.length - activeCount})
        </button>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="mpers-loading">
          <div className="spinner"></div>
          <p>Chargement...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="mpers-empty-list">
          <User size={40} />
          <p>{search ? 'Aucun résultat' : 'Aucun personnel'}</p>
        </div>
      ) : (
        <div className="mpers-list">
          {filtered.map(p => {
            const fullName = `${p.firstName || ''} ${p.lastName || ''}`.trim();
            const drivingSkills = p.skills?.filter(s => s.category === 'conduite') || [];
            return (
              <div key={p.id} className="mpers-card" onClick={() => setSelectedPerson(p)}>
                {p.photo ? (
                  <img src={`/avatars/${p.photo}`} alt="" className="mpers-avatar-img" />
                ) : (
                  <div className="mpers-avatar" style={{ background: getAvatarColor(fullName) }}>
                    {getInitials(p.firstName, p.lastName)}
                  </div>
                )}
                <div className="mpers-card-info">
                  <div className="mpers-card-name">{fullName || `Personnel #${p.id}`}</div>
                  <div className="mpers-card-meta">
                    {drivingSkills.length > 0 && (
                      <span className="mpers-card-skill">
                        <Truck size={12} /> {drivingSkills.map(s => s.name.replace('Conduite ', '')).join(', ')}
                      </span>
                    )}
                    {p.contractType && <span className="mpers-card-contract">{p.contractType}</span>}
                  </div>
                </div>
                <span className={`mpers-status-dot ${p.status === 'active' ? 'active' : ''}`} />
                <ChevronRight size={18} className="mpers-chevron" />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default MobilePersonnel;
