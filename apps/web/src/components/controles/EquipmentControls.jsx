// ═══════════════════════════════════════════════════════════════
// EquipmentControls.jsx — Liste des contrôles d'une entité
// (Embed dans EquipmentDetail / VehicleDetail)
// ═══════════════════════════════════════════════════════════════
import { CheckCircle2, History, Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Button, EmptyState, SectionHeader, Spinner, StatusBadge } from '@/design-system';

import { useListResource } from '../../hooks/useListResource';
import api from '../../utils/api';
import { refreshBus } from '../../utils/refresh-bus';
import ControlEditorModal from './ControlEditorModal';
import ControlHistoryModal from './ControlHistoryModal';
import ControlPerformModal from './ControlPerformModal';
import { formatDueLabel, STATUS_COLORS, STATUS_LABELS } from './utils';

export default function EquipmentControls({ entityType, entityId, entityName, isAdmin = false }) {
  const [perform, setPerform] = useState(null);
  const [history, setHistory] = useState(null);
  const [editor, setEditor] = useState(null);

  const fetchControls = useCallback(async () => {
    const r = await api.getControlsForEntity(entityType, entityId);
    if (!r?.success) throw new Error(r?.error || 'Erreur');
    return r.data || [];
  }, [entityType, entityId]);

  // useListResource : state + load + bus 'controls' (dashboard, autre entité).
  const enabled = !!(entityType && entityId);
  const {
    data: items,
    error,
    reload: load,
  } = useListResource('controls', fetchControls, {
    enabled,
  });

  return (
    <div>
      <SectionHeader
        title="Contrôles périodiques"
        actions={
          isAdmin && (
            <Button
              size="sm"
              variant="primary"
              icon={<Plus size={14} />}
              onClick={() => setEditor({ control: null })}
            >
              Nouveau
            </Button>
          )
        }
      />

      {error && <div style={{ color: '#991b1b' }}>{error.message}</div>}
      {!items && !error && <Spinner />}

      {items && items.length === 0 && (
        <EmptyState
          title="Aucun contrôle planifié"
          description="Cliquez sur « Nouveau » pour planifier un contrôle."
        />
      )}

      {items && items.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((c) => {
            const colors = STATUS_COLORS[c.status] || STATUS_COLORS.A_FAIRE;
            return (
              <div
                key={c.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: 10,
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  background: '#fff',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {c.type_code} · {c.type_name}
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Échéance : {formatDueLabel(c.next_due_date)}
                    {c.last_done_date && ` · Dernière : ${c.last_done_date}`}
                  </div>
                </div>
                <StatusBadge
                  style={{
                    background: colors.bg,
                    color: colors.fg,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  {STATUS_LABELS[c.status] || c.status}
                </StatusBadge>
                <Button
                  size="sm"
                  variant="primary"
                  icon={<CheckCircle2 size={14} />}
                  onClick={() => setPerform({ ...c, entity_name: entityName })}
                >
                  Effectuer
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<History size={14} />}
                  onClick={() => setHistory(c)}
                  aria-label="Historique"
                />
                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Pencil size={14} />}
                      onClick={() => setEditor({ control: c })}
                      aria-label="Modifier"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={14} />}
                      onClick={async () => {
                        if (!window.confirm(`Désactiver « ${c.type_name} » ?`)) return;
                        const r = await api.deleteControl(c.id);
                        if (r?.success) {
                          refreshBus.publish('controls');
                          load();
                        }
                      }}
                      aria-label="Supprimer"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {perform && (
        <ControlPerformModal control={perform} onClose={() => setPerform(null)} onDone={load} />
      )}
      {history && <ControlHistoryModal control={history} onClose={() => setHistory(null)} />}
      {editor && (
        <ControlEditorModal
          control={editor.control}
          entityType={entityType}
          entityId={entityId}
          onClose={() => setEditor(null)}
          onSaved={load}
        />
      )}
    </div>
  );
}
