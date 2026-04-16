import './PersonnelContextMenu.css';

import { Building2, Calendar, Clock, FileCheck, GraduationCap, Wrench } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button, Divider, Tag } from '@/design-system';

import { ACCENT_COLORS, STATUS_COLORS } from '../../constants/colors';

// Types de périodes disponibles dans le menu contextuel
export const PERIOD_MENU_ITEMS = [
  {
    type: 'conge_paye',
    label: 'Congés',
    icon: Calendar,
    color: STATUS_COLORS.danger,
    emoji: '🏖️',
    requiresApproval: true,
  },
  {
    type: 'formation',
    label: 'Formation',
    icon: GraduationCap,
    color: ACCENT_COLORS.violet,
    emoji: '🎓',
    requiresApproval: false,
  },
  {
    type: 'entreprise',
    label: 'Entreprise',
    icon: Building2,
    color: STATUS_COLORS.info,
    emoji: '🏢',
    requiresApproval: false,
  },
  {
    type: 'workshop',
    label: 'Workshop',
    icon: Wrench,
    color: STATUS_COLORS.warning,
    emoji: '🔧',
    requiresApproval: false,
  },
  {
    type: 'examen',
    label: 'Examen',
    icon: FileCheck,
    color: STATUS_COLORS.success,
    emoji: '📝',
    requiresApproval: false,
  },
  {
    type: 'rdv',
    label: 'RDV',
    icon: Clock,
    color: ACCENT_COLORS.cyan,
    emoji: '📅',
    requiresApproval: false,
  },
];

const PersonnelContextMenu = ({ x, y, person, onSelect, onClose }) => {
  const menuRef = useRef(null);

  // Filtrer les items : congés uniquement pour les permanents
  const isPermanent = person?.type === 'permanent';
  const menuItems = isPermanent
    ? PERIOD_MENU_ITEMS
    : PERIOD_MENU_ITEMS.filter((item) => !item.requiresApproval);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  // Ajuster la position pour ne pas sortir de l'écran
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div className="pp-context-menu" ref={menuRef} style={{ left: x, top: y }}>
      <div className="pp-context-menu-header">
        <span className="pp-context-menu-person">
          {person.firstName} {person.lastName || ''}
        </span>
        <span className="pp-context-menu-subtitle">Ajouter une période</span>
      </div>
      <Divider className="pp-context-menu-divider" />
      {menuItems.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            variant="ghost"
            key={item.type}
            className="pp-context-menu-item"
            onClick={() => onSelect(item.type, person)}
          >
            <span className="pp-context-menu-icon" style={{ color: item.color }}>
              <Icon size={16} />
            </span>
            <span className="pp-context-menu-label">{item.label}</span>
            {item.requiresApproval && (
              <Tag color="warning" size="sm">
                Validation requise
              </Tag>
            )}
          </Button>
        );
      })}
    </div>
  );
};

export default PersonnelContextMenu;
