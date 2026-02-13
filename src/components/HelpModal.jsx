import { X, HelpCircle, Download, ExternalLink, Truck, Users, Briefcase, Calendar, MessageSquare, Settings, Search, Mouse, Keyboard } from 'lucide-react';
import { SHORTCUTS, SHORTCUT_CATEGORIES, MOD_KEY } from '../hooks/useKeyboardShortcuts';
import './HelpModal.css';

const HelpModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    // Ouvrir le guide HTML dans un nouvel onglet (imprimable en PDF)
    window.open('/guide-utilisation.html', '_blank');
  };

  return (
    <div className="help-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="help-modal">
        <div className="help-header">
          <h3><HelpCircle size={20} /> Aide — eM@g</h3>
          <div className="help-header-actions">
            <button onClick={handleDownloadPDF} title="Ouvrir le guide complet (PDF)">
              <Download size={14} /> Guide PDF
            </button>
            <button className="help-close-btn" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="help-body">
          {/* Module Parc */}
          <div className="help-section">
            <div className="help-section-title"><Truck size={16} /> Module Parc</div>
            <div className="help-card">
              <h4>Créer une réservation</h4>
              <p>Cliquez sur une case vide du calendrier ou utilisez le bouton <strong>+</strong> en haut. Remplissez le formulaire avec le véhicule, les dates et le chauffeur.</p>
            </div>
            <div className="help-card">
              <h4>Déplacer une réservation</h4>
              <p>Glissez horizontalement pour changer les dates, ou verticalement pour changer de véhicule. Un indicateur rouge signale un conflit.</p>
            </div>
            <div className="help-card">
              <h4>Raccourcis calendrier</h4>
              <p>
                <span className="help-kbd">←</span> <span className="help-kbd">→</span> Naviguer entre semaines &nbsp;|&nbsp;
                <span className="help-kbd">Aujourd'hui</span> Revenir à la date du jour
              </p>
            </div>
          </div>

          {/* Module Personnel */}
          <div className="help-section">
            <div className="help-section-title"><Users size={16} /> Module Personnel</div>
            <div className="help-card">
              <h4>Planning du personnel</h4>
              <p>Visualisez les affectations de chaque personne. Cliquez sur un nom pour voir le détail (compétences, missions, documents).</p>
            </div>
            <div className="help-card">
              <h4>Filtrage par compétence</h4>
              <p>Lors de la sélection d'un chauffeur, seuls les conducteurs qualifiés (VL, PL, SPL) sont proposés selon le type de véhicule.</p>
            </div>
          </div>

          {/* Module Affaires */}
          <div className="help-section">
            <div className="help-section-title"><Briefcase size={16} /> Module Affaires</div>
            <div className="help-card">
              <h4>Vue des affaires</h4>
              <p>Consultez les affaires en cours avec leurs réservations et personnel associé. Utilisez les filtres par date ou par type.</p>
            </div>
            <div className="help-card">
              <h4>Navigation croisée</h4>
              <p>Cliquez sur un nom de véhicule ou de personne dans une affaire pour naviguer directement vers sa fiche détaillée.</p>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="help-section">
            <div className="help-section-title"><Calendar size={16} /> Google Calendar</div>
            <div className="help-card">
              <h4>Synchronisation</h4>
              <p>Les événements Google Calendar apparaissent en bandeau au-dessus du planning. Cliquez sur un événement pour créer une réservation associée.</p>
            </div>
          </div>

          {/* Messagerie */}
          <div className="help-section">
            <div className="help-section-title"><MessageSquare size={16} /> Messagerie</div>
            <div className="help-card">
              <h4>Messages internes</h4>
              <p>Cliquez sur l'icône 💬 dans le header pour ouvrir la messagerie. Créez des conversations avec les autres utilisateurs et partagez des fichiers.</p>
            </div>
          </div>

          {/* Raccourcis clavier */}
          <div className="help-section">
            <div className="help-section-title"><Keyboard size={16} /> Raccourcis clavier</div>
            {Object.entries(SHORTCUT_CATEGORIES).map(([catId, catLabel]) => {
              const catShortcuts = SHORTCUTS.filter(s => s.category === catId);
              if (catShortcuts.length === 0) return null;
              return (
                <div className="help-card" key={catId}>
                  <h4>{catLabel}</h4>
                  <div className="help-shortcuts-list">
                    {catShortcuts.map(s => (
                      <div className="help-shortcut-row" key={s.id}>
                        <span className="help-shortcut-keys">
                          {s.keys.map((k, i) => (
                            <span key={i}>
                              {i > 0 && <span className="help-kbd-sep">+</span>}
                              <span className="help-kbd">{k}</span>
                            </span>
                          ))}
                        </span>
                        <span className="help-shortcut-label">{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Raccourcis & astuces */}
          <div className="help-section">
            <div className="help-section-title"><Mouse size={16} /> Astuces</div>
            <div className="help-card">
              <h4>Bouton + (Création rapide)</h4>
              <p>Le bouton <strong>+</strong> dans le header permet de créer rapidement un événement Google Calendar ou une réservation de véhicule.</p>
            </div>
            <div className="help-card">
              <h4>Préférences</h4>
              <p>Accédez à vos préférences via le menu utilisateur (avatar en haut à droite) → <strong>Préférences</strong>. Choisissez votre module et vue par défaut.</p>
            </div>
          </div>

          <div className="help-version">
            eM@g v2.0 — MagScene © {new Date().getFullYear()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpModal;
