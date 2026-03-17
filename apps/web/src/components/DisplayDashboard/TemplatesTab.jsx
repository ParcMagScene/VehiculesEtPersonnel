// TemplatesTab — Gestion des templates d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Layout, Trash2, Settings, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

function TemplatesTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getDisplayTemplates();
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Erreur chargement templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates, refreshKey]);

  const handleDelete = useCallback(async (tpl) => {
    if (!confirm(`Supprimer le template « ${tpl.name} » ?`)) return;
    try {
      await api.deleteDisplayTemplate(tpl.id);
      toast.success('Template supprimé');
      onRefresh();
    } catch {
      toast.error('Erreur suppression');
    }
  }, [toast, onRefresh]);

  const isAdmin = currentUser?.isAdmin;

  if (loading) return <div className="display-loading">Chargement des templates…</div>;

  if (templates.length === 0) {
    return (
      <div className="display-empty">
        <Layout size={48} strokeWidth={1} />
        <h3>Aucun template</h3>
        <p>Les templates définissent la mise en page du contenu affiché sur les écrans.</p>
      </div>
    );
  }

  return (
    <div className="display-templates-grid">
      {templates.map(tpl => {
        let layoutInfo = {};
        try { layoutInfo = JSON.parse(tpl.layout || '{}'); } catch { /* ignore */ }

        return (
          <div key={tpl.id} className={`template-card ${!tpl.is_active ? 'inactive' : ''}`}>
            <div className="template-preview">
              <Layout size={32} />
              {tpl.category && <span className="template-category">{tpl.category}</span>}
            </div>
            <div className="template-info">
              <h4>{tpl.name}</h4>
              {tpl.description && <p>{tpl.description}</p>}
              {layoutInfo.zones && (
                <span className="template-zones">{layoutInfo.zones.length} zone(s)</span>
              )}
            </div>
            {isAdmin && (
              <div className="template-actions">
                <button className="btn-icon-sm" onClick={() => onEdit(tpl)} title="Modifier">
                  <Settings size={14} />
                </button>
                <button className="btn-icon-sm danger" onClick={() => handleDelete(tpl)} title="Supprimer">
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default memo(TemplatesTab);
