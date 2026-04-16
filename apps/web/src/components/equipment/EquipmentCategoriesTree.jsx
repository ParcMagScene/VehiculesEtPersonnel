import { Check, ChevronRight, Edit2, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

import { Button, Input, Tooltip } from '@/design-system';

import api from '../../utils/api';

const EquipmentCategoriesTree = ({
  families,
  subfamilies,
  leafCategories,
  categories,
  equipment,
  onRefresh,
}) => {
  const [expandedFamilies, setExpandedFamilies] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const toggleFamily = (id) => setExpandedFamilies((prev) => ({ ...prev, [id]: !prev[id] }));
  const toggleSub = (id) => setExpandedSubs((prev) => ({ ...prev, [id]: !prev[id] }));

  const pid = (c) => c.parentId || c.parent_id;

  const startEdit = (item, e) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditValue(item.name);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const saveEdit = async (item) => {
    const trimmed = editValue.trim();
    if (!trimmed || trimmed === item.name) {
      cancelEdit();
      return;
    }
    setSaving(true);
    try {
      await api.updateEquipmentCategory(item.id, {
        name: trimmed,
        icon: item.icon || null,
        color: item.color || null,
        description: item.description || null,
        parent_id: pid(item) || null,
        level: item.level,
      });
      cancelEdit();
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Erreur renommage catégorie:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e, item) => {
    if (e.key === 'Enter') saveEdit(item);
    if (e.key === 'Escape') cancelEdit();
  };

  const countEquipment = (familyId) => {
    return equipment.filter((e) => {
      const cat = categories.find((c) => c.id === (e.categoryId || e.category_id));
      if (!cat) return false;
      if (cat.id === familyId) return true;
      if (pid(cat) === familyId) return true;
      const sub = categories.find((s) => s.id === pid(cat));
      return sub && pid(sub) === familyId;
    }).length;
  };

  const countSubEquipment = (subId) => {
    return equipment.filter((e) => {
      const cat = categories.find((c) => c.id === (e.categoryId || e.category_id));
      if (!cat) return false;
      return cat.id === subId || pid(cat) === subId;
    }).length;
  };

  const countLeafEquipment = (catId) =>
    equipment.filter((e) => (e.categoryId || e.category_id) === catId).length;

  if (families.length === 0) {
    return (
      <p className="eq-cat-empty">
        Aucune catégorie définie. Importez un CSV pour créer la hiérarchie.
      </p>
    );
  }

  const renderEditableNameOrInput = (item, className) => {
    if (editingId === item.id) {
      return (
        <span className="eq-cat-edit-inline" onClick={(e) => e.stopPropagation()}>
          <Input
            ref={inputRef}
            className="eq-cat-edit-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, item)}
            disabled={saving}
          />
          <Button
            variant="ghost"
            className="eq-cat-edit-confirm"
            onClick={() => saveEdit(item)}
            disabled={saving}
          >
            <Check size={14} />
          </Button>
          <Button
            variant="ghost"
            className="eq-cat-edit-cancel"
            onClick={cancelEdit}
            aria-label="Annuler"
          >
            <X size={14} />
          </Button>
        </span>
      );
    }
    return (
      <>
        <span className={className}>{item.name}</span>
        <Tooltip content="Renommer">
          <Button variant="ghost" className="eq-cat-edit-btn" onClick={(e) => startEdit(item, e)}>
            <Edit2 size={12} />
          </Button>
        </Tooltip>
      </>
    );
  };

  return (
    <div className="eq-cat-tree">
      {families.map((fam) => {
        const isOpen = expandedFamilies[fam.id];
        const subs = subfamilies.filter((s) => pid(s) === fam.id);
        const famCount = countEquipment(fam.id);
        return (
          <div key={fam.id} className={`eq-cat-family ${isOpen ? 'open' : ''}`}>
            <Button
              variant="ghost"
              className="eq-cat-family-btn"
              onClick={() => editingId !== fam.id && toggleFamily(fam.id)}
            >
              <ChevronRight size={14} className={`eq-cat-chevron ${isOpen ? 'rotated' : ''}`} />
              <span
                className="eq-cat-family-icon"
                style={{ color: fam.color || 'var(--theme-text-gray)' }}
              >
                {fam.icon || '📦'}
              </span>
              {renderEditableNameOrInput(fam, 'eq-cat-family-name')}
              <span className="eq-cat-badge-sub">{subs.length} cat.</span>
              <span className="eq-cat-badge-count">{famCount} éq.</span>
            </Button>
            {isOpen && (
              <div className="eq-cat-children">
                {subs.length === 0 && <span className="eq-cat-empty-child">Aucune catégorie</span>}
                {subs.map((sub) => {
                  const isSubOpen = expandedSubs[sub.id];
                  const leaves = leafCategories.filter((c) => pid(c) === sub.id);
                  const subCount = countSubEquipment(sub.id);
                  return (
                    <div key={sub.id} className={`eq-cat-sub ${isSubOpen ? 'open' : ''}`}>
                      <Button
                        variant="ghost"
                        className="eq-cat-sub-btn"
                        onClick={() => editingId !== sub.id && toggleSub(sub.id)}
                      >
                        <ChevronRight
                          size={12}
                          className={`eq-cat-chevron ${isSubOpen ? 'rotated' : ''}`}
                        />
                        {renderEditableNameOrInput(sub, 'eq-cat-sub-name')}
                        <span className="eq-cat-badge-leaf">{leaves.length} types</span>
                        <span className="eq-cat-badge-count">{subCount} éq.</span>
                      </Button>
                      {isSubOpen && (
                        <div className="eq-cat-leaves">
                          {leaves.length === 0 && (
                            <span className="eq-cat-empty-child">Aucun type</span>
                          )}
                          {leaves.map((leaf) => {
                            const leafCount = countLeafEquipment(leaf.id);
                            return (
                              <div key={leaf.id} className="eq-cat-leaf">
                                <span className="eq-cat-leaf-dot" />
                                {renderEditableNameOrInput(leaf, 'eq-cat-leaf-name')}
                                <span className="eq-cat-badge-count">{leafCount} éq.</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default EquipmentCategoriesTree;
