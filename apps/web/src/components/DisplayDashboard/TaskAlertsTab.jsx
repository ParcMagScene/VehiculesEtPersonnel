// ═══════════════════════════════════════════════════════════════
// TaskAlertsTab — Config des alertes sonores par section de tache
// (rdv, courses, chargement, depart, ...). Chaque section peut avoir
// un son, un offset (minutes avant l'heure) et une duree de clignotement.
// ═══════════════════════════════════════════════════════════════

import { Bell, Play, Repeat, Trash2, Upload } from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button, SectionHeader, Select, Spinner } from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';

// Aligne sur SECTION_LABELS backend (displayRoutes.js ligne ~2170)
const SECTION_LABELS = {
  rdv: 'RDV',
  evenements: 'Événement',
  taches_prioritaires: 'Prioritaire',
  courses: 'Courses',
  prep_locations: 'Prépa Location',
  prep_prestations: 'Prépa Prestation',
  prep_ventes: 'Prépa Vente',
  prep_installations: 'Prépa Installation',
  prep_tournees: 'Prépa Tournée',
  chargement: 'Chargement',
  depart: 'Départ',
  enlevement: 'Enlèvement',
  retour: 'Retour',
  recuperation: 'Récupération',
  installation: 'Installation',
  montage: 'Montage',
  demontage: 'Démontage',
  intervention: 'Intervention',
  taches_secondaires: 'Secondaire',
  manual: 'Divers',
};

const OFFSET_OPTIONS = [
  { value: 0, label: "Pile à l'heure" },
  { value: 1, label: '1 min avant' },
  { value: 2, label: '2 min avant' },
  { value: 5, label: '5 min avant' },
  { value: 10, label: '10 min avant' },
  { value: 15, label: '15 min avant' },
  { value: 30, label: '30 min avant' },
  { value: 60, label: '1 h avant' },
];

const DURATION_OPTIONS = [
  { value: 15, label: '15 secondes' },
  { value: 30, label: '30 secondes' },
  { value: 60, label: '1 minute' },
  { value: 300, label: '5 minutes' },
  { value: 900, label: '15 minutes' },
  { value: -1, label: "Jusqu'à acquittement" },
];

function TaskAlertsTab({ refreshKey }) {
  const toast = useToast();
  const uploadInputRef = useRef(null);
  const audioRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [rules, setRules] = useState({});
  const [sounds, setSounds] = useState({ builtin: [], custom: [] });
  const [savingSection, setSavingSection] = useState(null);
  const [recurring, setRecurring] = useState([]);
  const [savingRecurringId, setSavingRecurringId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rulesRes, soundsRes, recurringRes] = await Promise.all([
        api.getDisplayAlertRules(),
        api.getDisplayAlertSounds(),
        api.getDisplayAlertRulesRecurring().catch(() => ({ recurringTasks: [] })),
      ]);
      const byId = {};
      (rulesRes.sections || []).forEach((r) => {
        byId[r.section] = r;
      });
      setRules(byId);
      setSounds(soundsRes || { builtin: [], custom: [] });
      setRecurring(Array.isArray(recurringRes?.recurringTasks) ? recurringRes.recurringTasks : []);
    } catch (e) {
      console.error('load alerts:', e);
      toast.error('Impossible de charger les alertes');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  const allSounds = useMemo(() => [...(sounds.builtin || []), ...(sounds.custom || [])], [sounds]);

  const handleSave = useCallback(
    async (section, patch) => {
      const current = rules[section] || {};
      const next = { ...current, ...patch };
      setRules((prev) => ({ ...prev, [section]: next }));
      setSavingSection(section);
      try {
        await api.saveDisplayAlertRule(section, {
          enabled: !!next.enabled,
          soundPath: next.soundPath,
          offsetMinutes: Number(next.offsetMinutes) || 0,
          blinkDurationSec: Number(next.blinkDurationSec) || 30,
        });
      } catch (e) {
        toast.error(`Échec sauvegarde ${SECTION_LABELS[section] || section}: ${e?.message || ''}`);
        // Rollback en cas d'echec
        setRules((prev) => ({ ...prev, [section]: current }));
      } finally {
        setSavingSection(null);
      }
    },
    [rules, toast],
  );

  const handleSaveRecurring = useCallback(
    async (id, patch) => {
      const idx = recurring.findIndex((r) => r.id === id);
      if (idx === -1) return;
      const current = recurring[idx];
      const next = { ...current, ...patch };
      setRecurring((prev) => prev.map((r) => (r.id === id ? next : r)));
      setSavingRecurringId(id);
      try {
        await api.saveDisplayAlertRuleRecurring(id, {
          enabled: !!next.alertEnabled,
          soundPath: next.alertSoundPath,
          offsetMinutes: Number(next.alertOffsetMinutes) || 0,
          blinkDurationSec: Number(next.alertBlinkDurationSec) || 30,
        });
      } catch (e) {
        toast.error(`Échec sauvegarde ${current.title || 'tâche'}: ${e?.message || ''}`);
        setRecurring((prev) => prev.map((r) => (r.id === id ? current : r)));
      } finally {
        setSavingRecurringId(null);
      }
    },
    [recurring, toast],
  );

  const handlePlayTest = useCallback(
    (soundPath) => {
      try {
        if (!audioRef.current) audioRef.current = new Audio();
        audioRef.current.src = soundPath;
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch((err) => {
          toast.error(`Lecture bloquée : ${err?.message || 'autoplay'}`);
        });
      } catch (e) {
        toast.error(`Erreur lecture : ${e?.message || ''}`);
      }
    },
    [toast],
  );

  const handleUpload = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!file.type.startsWith('audio/')) {
        toast.error('Sélectionnez un fichier audio');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error(`Fichier trop grand (${(file.size / 1024 / 1024).toFixed(1)} Mo, max 2 Mo)`);
        return;
      }
      setUploading(true);
      try {
        const fd = new FormData();
        fd.append('sound', file);
        await api.uploadDisplayAlertSound(fd);
        toast.success('Son ajouté à la bibliothèque');
        const soundsRes = await api.getDisplayAlertSounds();
        setSounds(soundsRes || { builtin: [], custom: [] });
      } catch (err) {
        toast.error(`Upload impossible : ${err?.message || ''}`);
      } finally {
        setUploading(false);
      }
    },
    [toast],
  );

  const handleDeleteCustom = useCallback(
    async (filename) => {
      try {
        await api.deleteDisplayAlertSound(filename);
        toast.success('Son supprimé');
        await load();
      } catch (e) {
        toast.error(`Suppression impossible : ${e?.message || ''}`);
      }
    },
    [load, toast],
  );

  if (loading) return <div className="display-loading">Chargement…</div>;

  return (
    <div className="dtv-alerts">
      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Bell size={16} />}
          title="Alertes sonores"
        />
        <p className="dtv-hint">
          Choisissez un son + une durée de clignotement pour chaque type de tâche. L'alerte se
          déclenche uniquement pour les tâches ayant une heure de début. Le clignotement s'arrête
          lorsque la tâche est cochée « effectuée » ou acquittée.
        </p>

        <div className="dtv-alerts-table">
          <div className="dtv-alerts-thead">
            <div>Type</div>
            <div>Activé</div>
            <div>Son</div>
            <div>Déclenchement</div>
            <div>Clignotement</div>
            <div>Test</div>
          </div>

          {Object.keys(SECTION_LABELS).map((section) => {
            const rule = rules[section] || {
              enabled: false,
              soundPath: '/alert-sounds/bell.wav',
              offsetMinutes: 0,
              blinkDurationSec: 30,
            };
            const isSaving = savingSection === section;
            return (
              <div
                key={section}
                className={`dtv-alerts-row ${rule.enabled ? 'active' : ''} ${isSaving ? 'saving' : ''}`}
              >
                <div className="dtv-alerts-cell dtv-alerts-name">{SECTION_LABELS[section]}</div>

                <div className="dtv-alerts-cell">
                  <label className="dtv-switch">
                    <input
                      type="checkbox"
                      checked={!!rule.enabled}
                      onChange={(e) => handleSave(section, { enabled: e.target.checked })}
                    />
                    <span className="dtv-switch-slider" />
                  </label>
                </div>

                <div className="dtv-alerts-cell">
                  <Select
                    value={rule.soundPath}
                    onChange={(e) => handleSave(section, { soundPath: e.target.value })}
                    disabled={!rule.enabled}
                  >
                    <optgroup label="Bibliothèque">
                      {(sounds.builtin || []).map((s) => (
                        <option key={s.path} value={s.path}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                    {sounds.custom && sounds.custom.length > 0 && (
                      <optgroup label="Sons custom">
                        {sounds.custom.map((s) => (
                          <option key={s.path} value={s.path}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </Select>
                </div>

                <div className="dtv-alerts-cell">
                  <Select
                    value={rule.offsetMinutes}
                    onChange={(e) => handleSave(section, { offsetMinutes: Number(e.target.value) })}
                    disabled={!rule.enabled}
                  >
                    {OFFSET_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="dtv-alerts-cell">
                  <Select
                    value={rule.blinkDurationSec}
                    onChange={(e) =>
                      handleSave(section, { blinkDurationSec: Number(e.target.value) })
                    }
                    disabled={!rule.enabled}
                  >
                    {DURATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </div>

                <div className="dtv-alerts-cell">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handlePlayTest(rule.soundPath)}
                    aria-label={`Écouter ${SECTION_LABELS[section]}`}
                  >
                    <Play size={14} />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Repeat size={16} />}
          title="Tâches récurrentes"
        />
        <p className="dtv-hint">
          Override par tâche : chaque tâche récurrente peut avoir son propre son, offset et
          clignotement. Quand activé, la règle de section (ci-dessus) est ignorée pour cette tâche
          uniquement.
        </p>

        {recurring.length === 0 ? (
          <p className="dtv-hint" style={{ fontStyle: 'italic' }}>
            Aucune tâche récurrente active. Créez-en depuis Planning → Récurrentes.
          </p>
        ) : (
          <div className="dtv-alerts-table">
            <div className="dtv-alerts-thead">
              <div>Tâche</div>
              <div>Activé</div>
              <div>Son</div>
              <div>Déclenchement</div>
              <div>Clignotement</div>
              <div>Test</div>
            </div>

            {recurring.map((rt) => {
              const isSaving = savingRecurringId === rt.id;
              return (
                <div
                  key={rt.id}
                  className={`dtv-alerts-row ${rt.alertEnabled ? 'active' : ''} ${isSaving ? 'saving' : ''}`}
                >
                  <div className="dtv-alerts-cell dtv-alerts-name">
                    {rt.title || 'Sans titre'}
                    {rt.time ? (
                      <span
                        className="dtv-hint"
                        style={{ fontWeight: 400, marginLeft: 8, fontSize: '0.75rem' }}
                      >
                        {rt.time.substring(0, 5)}
                        {rt.recurrence === 'weekly' && rt.dayOfWeek != null
                          ? ` · ${['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'][rt.dayOfWeek]}`
                          : ''}
                        {rt.recurrence === 'monthly' && rt.dayOfMonth != null
                          ? ` · le ${rt.dayOfMonth}`
                          : ''}
                      </span>
                    ) : null}
                  </div>

                  <div className="dtv-alerts-cell">
                    <label className="dtv-switch">
                      <input
                        type="checkbox"
                        checked={!!rt.alertEnabled}
                        onChange={(e) =>
                          handleSaveRecurring(rt.id, { alertEnabled: e.target.checked })
                        }
                      />
                      <span className="dtv-switch-slider" />
                    </label>
                  </div>

                  <div className="dtv-alerts-cell">
                    <Select
                      value={rt.alertSoundPath}
                      onChange={(e) =>
                        handleSaveRecurring(rt.id, { alertSoundPath: e.target.value })
                      }
                      disabled={!rt.alertEnabled}
                    >
                      <optgroup label="Bibliothèque">
                        {(sounds.builtin || []).map((s) => (
                          <option key={s.path} value={s.path}>
                            {s.label}
                          </option>
                        ))}
                      </optgroup>
                      {sounds.custom && sounds.custom.length > 0 && (
                        <optgroup label="Sons custom">
                          {sounds.custom.map((s) => (
                            <option key={s.path} value={s.path}>
                              {s.label}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </Select>
                  </div>

                  <div className="dtv-alerts-cell">
                    <Select
                      value={rt.alertOffsetMinutes}
                      onChange={(e) =>
                        handleSaveRecurring(rt.id, { alertOffsetMinutes: Number(e.target.value) })
                      }
                      disabled={!rt.alertEnabled}
                    >
                      {OFFSET_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="dtv-alerts-cell">
                    <Select
                      value={rt.alertBlinkDurationSec}
                      onChange={(e) =>
                        handleSaveRecurring(rt.id, {
                          alertBlinkDurationSec: Number(e.target.value),
                        })
                      }
                      disabled={!rt.alertEnabled}
                    >
                      {DURATION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="dtv-alerts-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayTest(rt.alertSoundPath)}
                      aria-label={`Écouter ${rt.title}`}
                    >
                      <Play size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dtv-section">
        <SectionHeader
          className="dtv-section-title"
          icon={<Upload size={16} />}
          title="Bibliothèque de sons"
        />
        <p className="dtv-hint">
          6 sons prédéfinis + vos propres uploads (mp3, wav, ogg — max 2 Mo).
        </p>

        <div className="dtv-alerts-sounds">
          {allSounds.map((s) => (
            <div key={s.path} className={`dtv-alerts-sound ${s.custom ? 'custom' : ''}`}>
              <span className="dtv-alerts-sound-name">{s.label}</span>
              <div className="dtv-alerts-sound-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handlePlayTest(s.path)}
                  aria-label="Écouter"
                >
                  <Play size={14} />
                </Button>
                {s.custom && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteCustom(s.label)}
                    aria-label="Supprimer"
                  >
                    <Trash2 size={14} />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        <input
          ref={uploadInputRef}
          type="file"
          accept="audio/*"
          onChange={handleUpload}
          style={{ display: 'none' }}
        />
        <Button
          variant="primary"
          size="sm"
          disabled={uploading}
          onClick={() => uploadInputRef.current?.click()}
        >
          {uploading ? <Spinner size={14} /> : <Upload size={14} />} Uploader un son
        </Button>
      </div>
    </div>
  );
}

export default memo(TaskAlertsTab);
