// TemplatesTab — Gestion des templates d'affichage
import React, { useState, useEffect, useCallback, memo } from 'react';
import { Layout, Trash2, Settings, ToggleLeft, ToggleRight, Eye } from 'lucide-react';
import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { Button, Dialog, EmptyState, Tooltip } from '@/design-system';

function TemplatesTab({ currentUser, refreshKey, onEdit, onRefresh }) {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState(null);

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

  const handleDelete = useCallback((tpl) => {
    setConfirmDialog({
      title: 'Supprimer',
      message: `Supprimer le template \xAB ${tpl.name} \xBB ?`,
      variant: 'danger',
      confirmLabel: 'Supprimer',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await api.deleteDisplayTemplate(tpl.id);
          toast.success('Template supprim\xE9');
          onRefresh();
        } catch {
          toast.error('Erreur suppression');
        }
      },
    });
  }, [toast, onRefresh]);

  const isAdmin = currentUser?.isAdmin;

  if (loading) return <div className="display-loading">Chargement des templates…</div>;

  if (templates.length === 0) {
    return (
      <EmptyState icon={<Layout size={48} strokeWidth={1} />} title="Aucun template" description="Les templates définissent la mise en page du contenu affiché sur les écrans." />
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
                <Tooltip content="Modifier">
                  <Button variant="ghost" size="sm" iconOnly onClick={() => onEdit(tpl)}>
                    <Settings size={14} />
                  </Button>
                </Tooltip>
                <Tooltip content="Supprimer">
                  <Button variant="danger" size="sm" iconOnly onClick={() => handleDelete(tpl)}>
                    <Trash2 size={14} />
                  </Button>
                </Tooltip>
              </div>
            )}
          </div>
        );
      })}
      <Dialog
        open={!!confirmDialog}
        onClose={() => setConfirmDialog(null)}
        title={confirmDialog?.title || 'Confirmation'}
        variant={confirmDialog?.variant || 'confirm'}
        onConfirm={confirmDialog?.onConfirm}
        confirmLabel={confirmDialog?.confirmLabel || 'Confirmer'}
        cancelLabel="Annuler"
      >
        {confirmDialog?.message}
      </Dialog>
    </div>
  );
}

export default memo(TemplatesTab);
