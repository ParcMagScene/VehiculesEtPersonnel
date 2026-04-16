import React, { useState, useEffect, useRef } from 'react';
import { Filter, ChevronRight } from 'lucide-react';
import { Button } from '@/design-system';

const CategoryCascadeFilter = ({
  families,
  subfamilies,
  leafCategories,
  value,
  onChange,
  isMobile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredFamily, setHoveredFamily] = useState(null);
  const [hoveredSub, setHoveredSub] = useState(null);
  // Mobile: expanded state (accordion)
  const [expandedFamily, setExpandedFamily] = useState(null);
  const [expandedSub, setExpandedSub] = useState(null);
  const containerRef = useRef(null);
  const closeTimer = useRef(null);

  const startClose = () => {
    if (isMobile) return;
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
        setExpandedFamily(null);
        setExpandedSub(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getLabel = () => {
    if (!value) return '🏷️ Toutes familles';
    const [type, idStr] = value.split(':');
    const id = parseInt(idStr);
    if (type === 'family') {
      const f = families.find((x) => x.id === id);
      return f ? `${f.icon || '📦'} ${f.name}` : value;
    }
    if (type === 'subfamily') {
      const sf = subfamilies.find((x) => x.id === id);
      return sf ? `${sf.icon || '📂'} ${sf.name}` : value;
    }
    if (type === 'category') {
      const c = leafCategories.find((x) => x.id === id);
      return c ? `${c.icon || '📄'} ${c.name}` : value;
    }
    return value;
  };

  const handleSelect = (val) => {
    onChange(val);
    setIsOpen(false);
    setHoveredFamily(null);
    setHoveredSub(null);
    setExpandedFamily(null);
    setExpandedSub(null);
  };

  return (
    <div
      className="eq-cascade-filter"
      ref={containerRef}
      onMouseLeave={startClose}
      onMouseEnter={cancelClose}
    >
      <Button
        variant="ghost"
        className={`eq-cascade-btn ${value ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setExpandedFamily(null);
          setExpandedSub(null);
        }}
      >
        <Filter size={13} />
        <span>{getLabel()}</span>
        <ChevronRight size={12} className={`eq-cascade-arrow ${isOpen ? 'open' : ''}`} />
      </Button>
      {isOpen && (
        <div className="eq-cascade-menu eq-cascade-l1">
          <div
            className="eq-cascade-item eq-cascade-all"
            role="button"
            tabIndex={0}
            onClick={() => handleSelect('')}
          >
            Toutes familles
          </div>
          {families.map((fam) => {
            const subs = subfamilies.filter((s) => (s.parentId || s.parent_id) === fam.id);
            const isHovered = !isMobile && hoveredFamily === fam.id;
            const isExpanded = isMobile && expandedFamily === fam.id;
            const showSubs = isHovered || isExpanded;
            return (
              <div key={fam.id} className="eq-cascade-family-wrap">
                <div
                  className={`eq-cascade-item ${showSubs ? 'hovered' : ''} ${value === `family:${fam.id}` ? 'selected' : ''}`}
                  onMouseEnter={
                    !isMobile
                      ? () => {
                          setHoveredFamily(fam.id);
                          setHoveredSub(null);
                          cancelClose();
                        }
                      : undefined
                  }
                  onClick={() => {
                    if (isMobile && subs.length > 0) {
                      setExpandedFamily(expandedFamily === fam.id ? null : fam.id);
                      setExpandedSub(null);
                    } else {
                      handleSelect(`family:${fam.id}`);
                    }
                  }}
                >
                  <span
                    className="eq-cascade-icon"
                    style={{ color: fam.color || 'var(--theme-text-gray)' }}
                  >
                    {fam.icon || '📦'}
                  </span>
                  <span className="eq-cascade-label">{fam.name}</span>
                  {subs.length > 0 && (
                    <ChevronRight
                      size={12}
                      className={`eq-cascade-sub-arrow${isExpanded ? ' eq-cascade-expanded' : ''}`}
                    />
                  )}
                </div>
                {isMobile && isExpanded && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2">
                    <div
                      className="eq-cascade-item eq-cascade-all"
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelect(`family:${fam.id}`);
                      }}
                    >
                      Toute la famille
                    </div>
                    {subs.map((sf) => {
                      const cats = leafCategories.filter(
                        (c) => (c.parentId || c.parent_id) === sf.id,
                      );
                      const isSubExpanded = expandedSub === sf.id;
                      return (
                        <div key={sf.id}>
                          <div
                            className={`eq-cascade-item ${isSubExpanded ? 'hovered' : ''} ${value === `subfamily:${sf.id}` ? 'selected' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (cats.length > 0) {
                                setExpandedSub(expandedSub === sf.id ? null : sf.id);
                              } else {
                                handleSelect(`subfamily:${sf.id}`);
                              }
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
                              <ChevronRight
                                size={12}
                                className={`eq-cascade-sub-arrow${isSubExpanded ? ' eq-cascade-expanded' : ''}`}
                              />
                            )}
                          </div>
                          {isSubExpanded && cats.length > 0 && (
                            <div className="eq-cascade-menu eq-cascade-l3">
                              <div
                                className="eq-cascade-item eq-cascade-all"
                                role="button"
                                tabIndex={0}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(`subfamily:${sf.id}`);
                                }}
                              >
                                Toute la sous-famille
                              </div>
                              {cats.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`eq-cascade-item ${value === `category:${cat.id}` ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(`category:${cat.id}`);
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
                {!isMobile && isHovered && subs.length > 0 && (
                  <div className="eq-cascade-menu eq-cascade-l2" onMouseEnter={cancelClose}>
                    {subs.map((sf) => {
                      const cats = leafCategories.filter(
                        (c) => (c.parentId || c.parent_id) === sf.id,
                      );
                      const isSubHovered = hoveredSub === sf.id;
                      return (
                        <div key={sf.id} className="eq-cascade-sub-wrap">
                          <div
                            className={`eq-cascade-item ${isSubHovered ? 'hovered' : ''} ${value === `subfamily:${sf.id}` ? 'selected' : ''}`}
                            onMouseEnter={() => {
                              setHoveredSub(sf.id);
                              cancelClose();
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelect(`subfamily:${sf.id}`);
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
                                  className={`eq-cascade-item ${value === `category:${cat.id}` ? 'selected' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelect(`category:${cat.id}`);
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

export default CategoryCascadeFilter;
