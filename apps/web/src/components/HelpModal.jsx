import { useState } from 'react';
import {
  X,
  HelpCircle,
  Download,
  Truck,
  Users,
  Briefcase,
  MessageSquare,
  Keyboard,
  Package,
  ShoppingCart,
  Wrench,
  Shield,
} from 'lucide-react';
import { SHORTCUTS, SHORTCUT_CATEGORIES } from '../hooks/useKeyboardShortcuts';
import './HelpModal.css';
import {
  Accordion,
  Button,
  Card,
  EmptyState,
  SearchBar,
  Tab,
  TabList,
  TabPanel,
  Tabs,
  Tooltip,
} from '@/design-system';
import { STATUS_COLORS, ACCENT_COLORS } from '../constants/colors';

// ═══ FAQ Data ═══
const FAQ_ITEMS = [
  {
    q: 'Comment créer une réservation de véhicule ?',
    a: 'Cliquez sur une case vide du calendrier dans le module Parc, ou utilisez le bouton + en haut à droite, ou le raccourci ⌘/Ctrl+N. Remplissez le formulaire avec le véhicule, les dates et le chauffeur.',
  },
  {
    q: 'Comment modifier une réservation existante ?',
    a: 'Cliquez sur la réservation dans le calendrier pour ouvrir le détail. Utilisez le bouton Modifier pour changer les informations. Vous pouvez aussi glisser-déposer la réservation pour changer les dates ou le véhicule.',
  },
  {
    q: 'Comment gérer les congés du personnel ?',
    a: "Dans le module Personnel, cliquez sur une personne pour ouvrir sa fiche. Utilisez l'onglet Disponibilités pour déclarer des congés, absences ou indisponibilités. Le calendrier sera mis à jour automatiquement.",
  },
  {
    q: 'Comment signaler une panne sur un véhicule ?',
    a: 'Ouvrez la fiche du véhicule et cliquez sur le bouton Signaler une intervention. Choisissez le type (panne, entretien, contrôle technique) et décrivez le problème.',
  },
  {
    q: 'Comment créer un bon de commande ?',
    a: 'Allez dans le module Commandes, onglet Commandes, et cliquez sur Nouvelle commande. Sélectionnez un fournisseur, ajoutez les lignes de commande et enregistrez. La référence est générée automatiquement (BC-YYYY-NNN).',
  },
  {
    q: 'Comment convertir un devis en commande ?',
    a: 'Dans le module Commandes, cliquez sur le devis accepté, puis sur le bouton Convertir en commande. Un bon de commande sera créé automatiquement avec les mêmes lignes.',
  },
  {
    q: 'Comment ajouter un équipement au parc matériel ?',
    a: 'Dans le module Équipements, cliquez sur Ajouter un équipement. Remplissez les informations (nom, référence, catégorie, etc.) et enregistrez.',
  },
  {
    q: 'Comment créer un ticket SAV ?',
    a: "Dans le module Équipements, onglet SAV, cliquez sur Nouveau ticket. Sélectionnez l'équipement concerné, décrivez le problème et assignez un technicien si nécessaire.",
  },
  {
    q: 'Comment accéder à la messagerie interne ?',
    a: "Cliquez sur l'icône messagerie (💬) dans le header ou utilisez le raccourci ⌘/Ctrl+M. Créez des conversations avec les autres utilisateurs et partagez des fichiers.",
  },
  {
    q: 'Comment personnaliser mes préférences ?',
    a: 'Cliquez sur votre avatar en haut à droite, puis Préférences (ou ⌘/Ctrl+,). Vous pouvez changer le thème, le module par défaut et la vue calendrier initiale.',
  },
];

// ═══ Guides par module ═══
const MODULE_GUIDES = [
  {
    id: 'parc',
    icon: Truck,
    title: 'Module Parc',
    color: STATUS_COLORS.info,
    tips: [
      {
        title: 'Créer une réservation',
        text: 'Cliquez sur une case vide du calendrier ou utilisez le bouton + en haut. Remplissez le formulaire avec le véhicule, les dates et le chauffeur.',
      },
      {
        title: 'Déplacer une réservation',
        text: 'Glissez horizontalement pour changer les dates, ou verticalement pour changer de véhicule. Un indicateur rouge signale un conflit.',
      },
      {
        title: 'Raccourcis calendrier',
        text: "← → pour naviguer entre les périodes, ⌘/Ctrl+T pour revenir à aujourd'hui.",
      },
    ],
  },
  {
    id: 'personnel',
    icon: Users,
    title: 'Module Personnel',
    color: STATUS_COLORS.success,
    tips: [
      {
        title: 'Planning du personnel',
        text: 'Visualisez les affectations de chaque personne. Cliquez sur un nom pour voir le détail (compétences, missions, documents).',
      },
      {
        title: 'Gestion des congés',
        text: "Depuis la fiche d'une personne, accédez à l'onglet Disponibilités pour gérer les congés et absences.",
      },
      {
        title: 'Filtrage par compétence',
        text: "Lors de la sélection d'un chauffeur, seuls les conducteurs qualifiés (VL, PL, SPL) sont proposés selon le type de véhicule.",
      },
    ],
  },
  {
    id: 'affaires',
    icon: Briefcase,
    title: 'Module Affaires',
    color: STATUS_COLORS.warning,
    tips: [
      {
        title: 'Vue des affaires',
        text: 'Consultez les affaires en cours avec leurs réservations et personnel associé. Utilisez les filtres par date ou par type.',
      },
      {
        title: 'Navigation croisée',
        text: 'Cliquez sur un nom de véhicule ou de personne dans une affaire pour naviguer directement vers sa fiche détaillée.',
      },
    ],
  },
  {
    id: 'materiel',
    icon: Package,
    title: 'Module Équipements',
    color: ACCENT_COLORS.violet,
    tips: [
      {
        title: 'Équipements',
        text: 'Gérez votre parc de matériel avec catégories, statuts et emplacements. Assignez du matériel à des personnes ou des affaires.',
      },
      {
        title: 'Tickets SAV',
        text: 'Créez des tickets pour les pannes, entretiens et calibrages. Suivez leur résolution et les coûts associés.',
      },
    ],
  },
  {
    id: 'commandes',
    icon: ShoppingCart,
    title: 'Module Commandes',
    color: ACCENT_COLORS.pink,
    tips: [
      {
        title: 'Bons de commande',
        text: "Créez des bons de commande avec référencement automatique (BC-YYYY-NNN). Suivez le statut de chaque commande jusqu'à la réception.",
      },
      {
        title: 'Devis',
        text: 'Établissez des devis clients avec calcul automatique HT/TTC. Les devis acceptés peuvent être convertis en commandes en un clic.',
      },
      {
        title: 'Fournisseurs',
        text: 'Gérez votre carnet de fournisseurs avec coordonnées et historique des commandes.',
      },
    ],
  },
  {
    id: 'maintenance',
    icon: Wrench,
    title: 'Maintenance & Interventions',
    color: STATUS_COLORS.danger,
    tips: [
      {
        title: 'Planifier un entretien',
        text: 'Depuis la fiche véhicule ou le panneau de gestion, planifiez des maintenances préventives avec rappels automatiques.',
      },
      {
        title: 'Signaler une panne',
        text: "Même les utilisateurs sans droits admin peuvent signaler des pannes. L'accès à la gestion complète des maintenances peut être accordé par l'administrateur.",
      },
    ],
  },
  {
    id: 'general',
    icon: Shield,
    title: 'Général',
    color: 'var(--theme-text-secondary)',
    tips: [
      {
        title: 'Google Calendar',
        text: 'Les événements Google Calendar apparaissent en bandeau au-dessus du planning. Cliquez sur un événement pour créer une réservation associée.',
      },
      {
        title: 'Messagerie interne',
        text: "Cliquez sur l'icône 💬 dans le header pour échanger avec les autres utilisateurs et partager des fichiers.",
      },
      {
        title: 'Préférences',
        text: 'Accédez à vos préférences via le menu utilisateur → Préférences. Choisissez votre module et vue par défaut, le thème, etc.',
      },
    ],
  },
];

// ═══ Composant FAQ Accordion ═══
const FaqItem = ({ item }) => {
  return (
    <Accordion title={item.q} className="faq-item">
      <div className="faq-answer">{item.a}</div>
    </Accordion>
  );
};

// ═══ Composant Principal ═══
const HelpModal = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState('guides');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const handleDownloadPDF = () => {
    window.open('/guide-utilisation.html', '_blank');
  };

  // Filtrage par recherche
  const filteredGuides = searchTerm
    ? MODULE_GUIDES.map((g) => ({
        ...g,
        tips: g.tips.filter(
          (t) =>
            t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.text.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      })).filter((g) => g.tips.length > 0)
    : MODULE_GUIDES;

  const filteredFaq = searchTerm
    ? FAQ_ITEMS.filter(
        (f) =>
          f.q.toLowerCase().includes(searchTerm.toLowerCase()) ||
          f.a.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : FAQ_ITEMS;

  return (
    <div
      className="help-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="help-modal">
        <div className="help-header">
          <h3>
            <HelpCircle size={20} /> Aide — eM@g
          </h3>
          <div className="help-header-actions">
            <Tooltip content="Ouvrir le guide complet" position="bottom">
              <Button variant="ghost" onClick={handleDownloadPDF}>
                <Download size={14} /> Guide PDF
              </Button>
            </Tooltip>
            <Button
              variant="ghost"
              className="help-close-btn"
              onClick={onClose}
              aria-label="Fermer l'aide"
            >
              <X size={18} />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onChange={setActiveTab}>
          <TabList className="help-tabs">
            <Tab value="guides" icon={<HelpCircle size={14} />}>
              Guides
            </Tab>
            <Tab value="shortcuts" icon={<Keyboard size={14} />}>
              Raccourcis
            </Tab>
            <Tab value="faq" icon={<MessageSquare size={14} />}>
              FAQ
            </Tab>
          </TabList>

          {/* Search */}
          {activeTab !== 'shortcuts' && (
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder={
                activeTab === 'guides'
                  ? 'Rechercher dans les guides...'
                  : 'Rechercher dans la FAQ...'
              }
              size="sm"
            />
          )}

          <div className="help-body">
            <TabPanel value="guides">
              <div className="help-guides">
                {filteredGuides.length === 0 && (
                  <EmptyState size="sm" title={`Aucun résultat pour « ${searchTerm} »`} />
                )}
                {filteredGuides.map((guide) => (
                  <div className="help-section" key={guide.id}>
                    <div className="help-section-title" style={{ color: guide.color }}>
                      <guide.icon size={16} /> {guide.title}
                    </div>
                    {guide.tips.map((tip, idx) => (
                      <Card
                        className="help-card"
                        key={idx}
                        style={{ '--card-accent': guide.color }}
                      >
                        <h4>{tip.title}</h4>
                        <p>{tip.text}</p>
                      </Card>
                    ))}
                  </div>
                ))}
              </div>
            </TabPanel>

            <TabPanel value="shortcuts">
              <div className="help-shortcuts">
                {Object.entries(SHORTCUT_CATEGORIES).map(([catId, catLabel]) => {
                  const catShortcuts = SHORTCUTS.filter((s) => s.category === catId);
                  if (catShortcuts.length === 0) return null;
                  return (
                    <div className="help-section" key={catId}>
                      <div className="help-section-title">
                        <Keyboard size={16} /> {catLabel}
                      </div>
                      <div className="help-shortcuts-grid">
                        {catShortcuts.map((s) => (
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
            </TabPanel>

            <TabPanel value="faq">
              <div className="help-faq">
                {filteredFaq.length === 0 && (
                  <EmptyState size="sm" title={`Aucun résultat pour « ${searchTerm} »`} />
                )}
                {filteredFaq.map((item, idx) => (
                  <FaqItem key={idx} item={item} />
                ))}
              </div>
            </TabPanel>

            <div className="help-version">eM@g v2.1 — eM@g © {new Date().getFullYear()}</div>
          </div>
        </Tabs>
      </div>
    </div>
  );
};

export default HelpModal;
