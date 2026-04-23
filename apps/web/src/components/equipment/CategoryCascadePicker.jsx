import { ChevronRight, Tag } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/design-system';

const CategoryCascadePicker = ({ families, subfamilies, leafCategories, value, onChange }) => {
  // value = { family_id, subfamily_id, category_id }
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFamily, setHoveredFamily] = useState(null);
  const [hoveredSub, setHoveredSub] = useState(null);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const startClose = () => {
    closeTimer.current = setTimeout(() => {
      setIsOpen(false);
      setHoveredFamily(null);
      setHoveredSub(null);
    }, 200);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setHoveredFamily(null);
        setHoveredSub(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    const parts = [];
    if (value.family_id) {
      const f = families.find((x) => x.id === parseInt(value.family_id));
      if (f) parts.push(`${f.icon || '📦'} ${f.name}`);
    }
    if (value.subfamily_id) {
      const sf = subfamilies.find((x) => x.id === parseInt(value.subfamily_id));
      if (sf) parts.push(`${sf.icon || '📂'} ${sf.name}`);
    }
    if (value.category_id) {
      const c = leafCategories.find((x) => x.id === parseInt(value.category_id));
      if (c) parts.push(`${c.icon || '📄'} ${c.name}`);
    }
    return parts.length > 0 ? parts.join(' › ') : '— Sélectionner une catégorie —';
  };

  const handleSelect = (familyId, subfamilyId, categoryId) => {
    onChange({
      family_id: familyId ? String(familyId) : '',
      subfamily_id: subfamilyId ? String(subfamilyId) : '',
      category_id: categoryId ? String(categoryId) : '',
    });
    setIsOpen(false);
    setHoveredFamily(null);
    setHoveredSub(null);
  };

  return (
    <div
      className="eq-cascade-filter eq-cascade-picker"
      ref={containerRef}
      onMouseLeave={startClose}
      onMouseEnter={cancelClose}
    >
      <Button
        variant="ghost"
        type="button"
        className={`eq-cascade-btn eq-cascade-picker-btn ${value.family_id ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Tag size={13} />
        <span>{getLabel()}</span>
        <ChevronRight size={12} className={`eq-cascade-arrow ${isOpen ? 'open' : ''}`} />
      </Button>
      {isOpen && (
        <div className="eq-cascade-menu eq-cascade-l1 eq-cascade-picker-menu">
          <div
            className="eq-cascade-item eq-cascade-all"
            role="button"
            tabIndex={0}
            onClick={() => handleSelect('', '', '')}
          >
            Aucune catégorie
          </div>
          {families.map((fam) => {
            const subs = subfamilies.filter((s) => (s.parentId || s.parent_id) === fam.id);
            const isHovered = hoveredFamily === fam.id;
            return (
              <div key={fam.id} className="eq-cascade-family-wrap">
                <div
                  className={`eq-cascade-item ${isHovered ? 'hovered' : ''} ${value.family_id === String(fam.id) && !value.subfamily_id ? 'selected' : ''}`}
                  onMouseEnter={() => {
                    setHoveredFamily(fam.id);
                    setHoveredSub(null);
                    cancelClose();
                  }}
                  onClick={() => handleSelect(fam.id, '', '')}
                >
                  <span
                    className="eq-cascade-icon"
                    style={{ color: fam.color || 'var(--theme-text-gray)' }}
                  >
                    {fam.icon || '📦'}
                  </span>
                  <span className="eq-cascade-label">{fam.name}</span>
                  {subs.length > 0 && <ChevronRight size={12} className="eq-cascade-sub-arrow" />}
                </div>
                {isHovered && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2" onMouseEnter={cancelClose}>
                    {subs.map((sf) => {
                      const cats = leafCategories.filter(
                        (c) => (c.parentId || c.parent_id) === sf.id,
                      );
                      const isSubHovered = hoveredSub === sf.id;
                      return (
                        <div key={sf.id} className="eq-cascade-sub-wrap">
                          <div
                            className={`eq-cascade-item ${isSubHovered ? 'hovered' : ''} ${value.subfamily_id === String(sf.id) && !value.category_id ? 'selected' : ''}`}
                            onMouseEnter={() => {
                              setHoveredSub(sf.id);
                              cancelClose();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(fam.id, sf.id, '');
                            }}
                          >
                            <span
                              className="eq-cascade-icon"
                              style={{ color: sf.color || 'var(--theme-text-gray)' }}
                            >
                              {sf.icon || '📂'}
                            </span>
                            <span className="eq-cascade-label">{sf.name}</span>
                            {cats.length > 0 && (
                              <ChevronRight size={12} className="eq-cascade-sub-arrow" />
                            )}
                          </div>
                          {isSubHovered && cats.length > 0 && (
                            <div
                              className="eq-cascade-menu eq-cascade-l3"
                              onMouseEnter={cancelClose}
                            >
                              {cats.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`eq-cascade-item ${value.category_id === String(cat.id) ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(fam.id, sf.id, cat.id);
                                  }}
                                >
                                  <span
                                    className="eq-cascade-icon"
                                    style={{ color: cat.color || 'var(--theme-text-gray)' }}
                                  >
                                    {cat.icon || '📄'}
                                  </span>
                                  <span className="eq-cascade-label">{cat.name}</span>
                                </div>
                              ))}
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
      )}
    </div>
  );
};

export default CategoryCascadePicker;
