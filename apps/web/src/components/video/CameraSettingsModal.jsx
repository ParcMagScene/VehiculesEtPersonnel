// ═══════════════════════════════════════════════════════════════
// CameraSettingsModal.jsx — Modal de configuration d'une caméra
// ═══════════════════════════════════════════════════════════════

import { Save, TestTube2, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button, Checkbox, FormField, Input, ModalLayout, Select, Textarea } from '@/design-system';

import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useDirtyForm } from '../../hooks/useDirtyForm';

const BRANDS = ['generic', 'Hikvision', 'Dahua', 'Ezviz', 'Amcrest', 'Axis', 'ONVIF'];

const CameraSettingsModal = ({ camera, onSave, onDelete, onTest, onClose }) => {
  const [form, setForm] = useState({
    name: camera?.name || '',
    brand: camera?.brand || 'generic',
    model: camera?.model || '',
    ip: camera?.ip || '',
    rtspUrl: camera?.rtspUrl || '',
    rtspPort: camera?.rtspPort || 554,
    httpPort: camera?.httpPort || 80,
    channel: camera?.channel || 1,
    username: camera?.username || 'admin',
    password: '',
    ptzSupported: !!camera?.ptzSupported,
    location: camera?.location || '',
    affaireId: camera?.affaireId || '',
    zone: camera?.zone || '',
    enabled: camera?.enabled !== false,
    streamProfile: camera?.streamProfile || 'main',
    snapshotPath: camera?.snapshotPath || '',
    notes: camera?.notes || '',
  });
  const { confirm, ConfirmDialogRenderer } = useConfirmDialog();
  const { guardClose } = useDirtyForm(form, { confirmer: confirm });
  const safeClose = guardClose(onClose);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.ip.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!camera?.id) return;
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest(camera.id);
      setTestResult(result);
    } catch {
      setTestResult({ reachable: false, status: 'error' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <ModalLayout
        open
        onClose={safeClose}
        title={camera?.id ? 'Modifier la caméra' : 'Ajouter une caméra'}
        size="lg"
        bodyClassName="camera-settings-form"
        footer={
          <>
            {camera?.id && onDelete && (
              <Button variant="danger" onClick={() => onDelete(camera.id)} type="button">
                <Trash2 size={16} /> Supprimer
              </Button>
            )}
            {camera?.id && onTest && (
              <Button variant="secondary" onClick={handleTest} disabled={testing} type="button">
                <TestTube2 size={16} /> {testing ? 'Test...' : 'Tester'}
              </Button>
            )}
            <div style={{ flex: 1 }} />
            <Button variant="ghost" onClick={safeClose} type="button">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={saving || !form.name || !form.ip}
            >
              <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <FormField className="form-group" label="Nom" required>
              <Input
                type="text"
                value={form.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="Ex: Entrée dépôt"
              />
            </FormField>
            <FormField className="form-group" label="Marque">
              <Select value={form.brand} onChange={(e) => handleChange('brand', e.target.value)}>
                {BRANDS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>

          <div className="form-row">
            <FormField className="form-group" label="Adresse IP" required>
              <Input
                type="text"
                value={form.ip}
                onChange={(e) => handleChange('ip', e.target.value)}
                required
                placeholder="192.168.1.100"
              />
            </FormField>
            <FormField className="form-group" label="Modèle">
              <Input
                type="text"
                value={form.model}
                onChange={(e) => handleChange('model', e.target.value)}
                placeholder="DS-2CD2143G2-I"
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField className="form-group" label="Port RTSP">
              <Input
                type="number"
                value={form.rtspPort}
                onChange={(e) => handleChange('rtspPort', parseInt(e.target.value, 10) || 554)}
              />
            </FormField>
            <FormField className="form-group" label="Port HTTP">
              <Input
                type="number"
                value={form.httpPort}
                onChange={(e) => handleChange('httpPort', parseInt(e.target.value, 10) || 80)}
              />
            </FormField>
            <FormField className="form-group" label="Channel">
              <Input
                type="number"
                min={1}
                max={64}
                value={form.channel}
                onChange={(e) => handleChange('channel', parseInt(e.target.value, 10) || 1)}
              />
            </FormField>
            <FormField className="form-group" label="Profil flux">
              <Select
                value={form.streamProfile}
                onChange={(e) => handleChange('streamProfile', e.target.value)}
              >
                <option value="main">Principal (HD)</option>
                <option value="sub">Secondaire (SD)</option>
              </Select>
            </FormField>
          </div>

          <div className="form-row">
            <FormField className="form-group" label="Identifiant">
              <Input
                type="text"
                value={form.username}
                onChange={(e) => handleChange('username', e.target.value)}
                autoComplete="off"
              />
            </FormField>
            <div className="form-group">
              <label>Mot de passe {camera?.hasPassword && '(déjà défini)'}</label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => handleChange('password', e.target.value)}
                autoComplete="new-password"
                placeholder={camera?.hasPassword ? '••••••• (laisser vide pour conserver)' : ''}
              />
            </div>
          </div>

          <FormField className="form-group" label="URL RTSP personnalisée (optionnel)">
            <Input
              type="text"
              value={form.rtspUrl}
              onChange={(e) => handleChange('rtspUrl', e.target.value)}
              placeholder="rtsp://... (laisser vide = auto selon marque)"
            />
          </FormField>

          <FormField className="form-group" label="Chemin snapshot personnalisé (optionnel)">
            <Input
              type="text"
              value={form.snapshotPath}
              onChange={(e) => handleChange('snapshotPath', e.target.value)}
              placeholder="/ISAPI/Streaming/channels/101/picture"
            />
          </FormField>

          <div className="form-row">
            <FormField className="form-group" label="Emplacement">
              <Input
                type="text"
                value={form.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Entrée dépôt, Parking..."
              />
            </FormField>
            <FormField className="form-group" label="Zone">
              <Input
                type="text"
                value={form.zone}
                onChange={(e) => handleChange('zone', e.target.value)}
                placeholder="Zone A, Bâtiment B..."
              />
            </FormField>
          </div>

          <div className="form-row">
            <FormField className="form-group" label="Affaire ID (optionnel)">
              <Input
                type="text"
                value={form.affaireId}
                onChange={(e) => handleChange('affaireId', e.target.value)}
              />
            </FormField>
            <div className="form-group form-group--inline">
              <label>
                <Checkbox
                  checked={form.ptzSupported}
                  onChange={(e) => handleChange('ptzSupported', e.target.checked)}
                />
                PTZ supporté
              </label>
              <label>
                <Checkbox
                  checked={form.enabled}
                  onChange={(e) => handleChange('enabled', e.target.checked)}
                />
                Activée
              </label>
            </div>
          </div>

          <FormField className="form-group" label="Notes">
            <Textarea
              value={form.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
            />
          </FormField>

          {testResult && (
            <div
              className={`camera-test-result ${testResult.reachable ? 'camera-test-result--ok' : 'camera-test-result--fail'}`}
            >
              {testResult.reachable ? '✅ Caméra accessible' : '❌ Caméra injoignable'}
            </div>
          )}
        </form>
      </ModalLayout>
      {ConfirmDialogRenderer}
    </>
  );
};

export default CameraSettingsModal;
