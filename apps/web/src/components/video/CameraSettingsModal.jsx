// ═══════════════════════════════════════════════════════════════
// CameraSettingsModal.jsx — Modal de configuration d'une caméra
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, TestTube2 } from 'lucide-react';

const BRANDS = [
  'generic', 'Hikvision', 'Dahua', 'Ezviz', 'Amcrest', 'Axis', 'ONVIF'
];

const CameraSettingsModal = ({ camera, onSave, onDelete, onTest, onClose }) => {
  const [form, setForm] = useState({
    name: '', brand: 'generic', model: '', ip: '', rtspUrl: '',
    rtspPort: 554, httpPort: 80, username: 'admin', password: '',
    ptzSupported: false, location: '', affaireId: '', zone: '',
    enabled: true, streamProfile: 'main', snapshotPath: '', notes: '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (camera) {
      setForm({
        name: camera.name || '',
        brand: camera.brand || 'generic',
        model: camera.model || '',
        ip: camera.ip || '',
        rtspUrl: camera.rtspUrl || '',
        rtspPort: camera.rtspPort || 554,
        httpPort: camera.httpPort || 80,
        username: camera.username || 'admin',
        password: '', // Ne jamais pré-remplir le mot de passe
        ptzSupported: !!camera.ptzSupported,
        location: camera.location || '',
        affaireId: camera.affaireId || '',
        zone: camera.zone || '',
        enabled: camera.enabled !== false,
        streamProfile: camera.streamProfile || 'main',
        snapshotPath: camera.snapshotPath || '',
        notes: camera.notes || '',
      });
    }
  }, [camera]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
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
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal camera-settings-modal">
        <div className="modal-header">
          <h3>{camera?.id ? 'Modifier la caméra' : 'Ajouter une caméra'}</h3>
          <button className="modal-close-btn" onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body camera-settings-form">
          <div className="form-row">
            <div className="form-group">
              <label>Nom *</label>
              <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} required placeholder="Ex: Entrée dépôt" />
            </div>
            <div className="form-group">
              <label>Marque</label>
              <select value={form.brand} onChange={e => handleChange('brand', e.target.value)}>
                {BRANDS.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Adresse IP *</label>
              <input type="text" value={form.ip} onChange={e => handleChange('ip', e.target.value)} required placeholder="192.168.1.100" />
            </div>
            <div className="form-group">
              <label>Modèle</label>
              <input type="text" value={form.model} onChange={e => handleChange('model', e.target.value)} placeholder="DS-2CD2143G2-I" />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Port RTSP</label>
              <input type="number" value={form.rtspPort} onChange={e => handleChange('rtspPort', parseInt(e.target.value, 10) || 554)} />
            </div>
            <div className="form-group">
              <label>Port HTTP</label>
              <input type="number" value={form.httpPort} onChange={e => handleChange('httpPort', parseInt(e.target.value, 10) || 80)} />
            </div>
            <div className="form-group">
              <label>Profil flux</label>
              <select value={form.streamProfile} onChange={e => handleChange('streamProfile', e.target.value)}>
                <option value="main">Principal (HD)</option>
                <option value="sub">Secondaire (SD)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Identifiant</label>
              <input type="text" value={form.username} onChange={e => handleChange('username', e.target.value)} autoComplete="off" />
            </div>
            <div className="form-group">
              <label>Mot de passe {camera?.hasPassword && '(déjà défini)'}</label>
              <input type="password" value={form.password} onChange={e => handleChange('password', e.target.value)} autoComplete="new-password" placeholder={camera?.hasPassword ? '••••••• (laisser vide pour conserver)' : ''} />
            </div>
          </div>

          <div className="form-group">
            <label>URL RTSP personnalisée (optionnel)</label>
            <input type="text" value={form.rtspUrl} onChange={e => handleChange('rtspUrl', e.target.value)} placeholder="rtsp://... (laisser vide = auto selon marque)" />
          </div>

          <div className="form-group">
            <label>Chemin snapshot personnalisé (optionnel)</label>
            <input type="text" value={form.snapshotPath} onChange={e => handleChange('snapshotPath', e.target.value)} placeholder="/ISAPI/Streaming/channels/101/picture" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Emplacement</label>
              <input type="text" value={form.location} onChange={e => handleChange('location', e.target.value)} placeholder="Entrée dépôt, Parking..." />
            </div>
            <div className="form-group">
              <label>Zone</label>
              <input type="text" value={form.zone} onChange={e => handleChange('zone', e.target.value)} placeholder="Zone A, Bâtiment B..." />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Affaire ID (optionnel)</label>
              <input type="text" value={form.affaireId} onChange={e => handleChange('affaireId', e.target.value)} />
            </div>
            <div className="form-group form-group--inline">
              <label>
                <input type="checkbox" checked={form.ptzSupported} onChange={e => handleChange('ptzSupported', e.target.checked)} />
                PTZ supporté
              </label>
              <label>
                <input type="checkbox" checked={form.enabled} onChange={e => handleChange('enabled', e.target.checked)} />
                Activée
              </label>
            </div>
          </div>

          <div className="form-group">
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => handleChange('notes', e.target.value)} rows={2} />
          </div>

          {testResult && (
            <div className={`camera-test-result ${testResult.reachable ? 'camera-test-result--ok' : 'camera-test-result--fail'}`}>
              {testResult.reachable ? '✅ Caméra accessible' : '❌ Caméra injoignable'}
            </div>
          )}
        </form>
        <div className="modal-footer">
          {camera?.id && onDelete && (
            <button className="btn btn-danger" onClick={() => onDelete(camera.id)} type="button">
              <Trash2 size={16} /> Supprimer
            </button>
          )}
          {camera?.id && onTest && (
            <button className="btn btn-secondary" onClick={handleTest} disabled={testing} type="button">
              <TestTube2 size={16} /> {testing ? 'Test...' : 'Tester'}
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className="btn btn-secondary" onClick={onClose} type="button">Annuler</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={saving || !form.name || !form.ip}>
            <Save size={16} /> {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CameraSettingsModal;
