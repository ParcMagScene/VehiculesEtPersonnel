import './ForfaitJoursPanel.css';

import {
  Briefcase,
  Calculator,
  Calendar,
  Download,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  Button,
  FormField,
  Input,
  InlineAlert,
  SectionHeader,
  Select,
  Tabs,
} from '@/design-system';

import { useToast } from '../../hooks/useToast';
import api from '../../utils/api';
import { AlertesTab, EntretiensTab, PosesTab } from './ForfaitComplianceTabs';

// Constantes d'affichage.
const DEFAULT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 7 }, (_, i) => DEFAULT_YEAR - 2 + i);

const fmtNb = (v) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toLocaleString('fr-FR');
const fmtEur = (v) =>
  v === null || v === undefined || Number.isNaN(v)
    ? '—'
    : Number(v).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });

/**
 * ForfaitJoursPanel — panneau unique regroupant :
 *   1. Toggle activation (admin) + paramètres contrat
 *   2. Les 5 calculateurs (entrée, sortie, rachat, réduit, repos annuels)
 *   3. Bilan annuel + export CSV
 *
 * @param {object} props
 * @param {{ id: number, first_name: string, last_name: string, type: string, isForfaitJours?: boolean }} props.person
 * @param {boolean} props.isAdmin
 */
export default function ForfaitJoursPanel({ person, isAdmin = false }) {
  const toast = useToast();
  const [config, setConfig] = useState(null);
  const [defaults, setDefaults] = useState({
    FULL_FORFAIT_DAYS: 218,
    RACHAT_MIN_MAJORATION_PCT: 10,
    CP_LEGAL_DAYS_OUVRES: 25,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [year, setYear] = useState(DEFAULT_YEAR);
  const [holidayInfo, setHolidayInfo] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [tab, setTab] = useState('config');

  // Chargement config
  const loadConfig = useCallback(async () => {
    if (!person?.id) return;
    setLoading(true);
    try {
      const data = await api.getForfaitConfig(person.id);
      setConfig(data.config);
      setDefaults(data.defaults);
    } catch (e) {
      toast.error(`Chargement config forfait impossible : ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [person?.id, toast]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  // Chargement fériés année sélectionnée
  useEffect(() => {
    api
      .getForfaitHolidays(year)
      .then(setHolidayInfo)
      .catch(() => setHolidayInfo(null));
  }, [year]);

  // Bilan annuel (uniquement si forfait activé)
  useEffect(() => {
    if (!person?.id || !config?.isForfaitJours) {
      setBilan(null);
      return;
    }
    api
      .getForfaitBilan(person.id, year)
      .then(setBilan)
      .catch(() => setBilan(null));
  }, [person?.id, year, config?.isForfaitJours]);

  const isPermanent = person?.type === 'permanent';

  const handleSaveConfig = async (patch) => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.updateForfaitConfig(person.id, patch);
      toast.success('Configuration forfait mise à jour');
      await loadConfig();
    } catch (e) {
      toast.error(`Sauvegarde impossible : ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = () => {
    if (!isAdmin) return;
    handleSaveConfig({ is_forfait_jours: config?.isForfaitJours ? 0 : 1 });
  };

  const exportBilanCsv = () => {
    if (!bilan) return;
    const rows = [
      ['Salarié', `${person.first_name} ${person.last_name}`],
      ['Année', bilan.year],
      ['Année bissextile', bilan.isLeap ? 'Oui' : 'Non'],
      ['Forfait plein (j)', bilan.forfaitPlein],
      [],
      ['Repos annuels calculés', ''],
      ['  Jours calendaires', bilan.reposAnnuels.joursCalendaires],
      ['  Repos hebdomadaires', bilan.reposAnnuels.joursWeekend],
      ['  Fériés hors WE', bilan.reposAnnuels.feriesHorsWeekend],
      ['  Jours de repos forfait', bilan.reposAnnuels.joursRepos],
      [],
      ['Soldes', 'Acquis', 'Pris'],
      ['CP légaux', bilan.soldes.cp?.days_entitled ?? '—', bilan.soldes.cp?.days_taken ?? '—'],
      [
        'CP ancienneté',
        bilan.soldes.cpAnciennete?.days_entitled ?? '—',
        bilan.soldes.cpAnciennete?.days_taken ?? '—',
      ],
      [
        'Repos forfait',
        bilan.soldes.reposForfait?.days_entitled ?? '—',
        bilan.soldes.reposForfait?.days_taken ?? '—',
      ],
      ['Rachat', bilan.soldes.rachat?.days_entitled ?? '—', bilan.soldes.rachat?.days_taken ?? '—'],
      [],
      ['Trimestres (jours travaillés)', ''],
      ['  T1', bilan.trimestres.T1],
      ['  T2', bilan.trimestres.T2],
      ['  T3', bilan.trimestres.T3],
      ['  T4', bilan.trimestres.T4],
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'))
      .join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bilan-forfait-${person.first_name}-${person.last_name}-${bilan.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="forfait-panel forfait-loading">Chargement…</div>;

  return (
    <div className="forfait-panel">
      <div className="forfait-header">
        <Briefcase size={18} />
        <span className="forfait-title">Forfait-jours</span>
        <span className={`forfait-status ${config?.isForfaitJours ? 'on' : 'off'}`}>
          {config?.isForfaitJours ? 'Activé' : 'Désactivé'}
        </span>
        {isAdmin && (
          <Button
            variant="ghost"
            className="forfait-toggle-btn"
            onClick={handleToggle}
            disabled={saving || !isPermanent}
            title={isPermanent ? '' : 'Uniquement pour les cadres permanents'}
          >
            {config?.isForfaitJours ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
            {config?.isForfaitJours ? 'Désactiver' : 'Activer'}
          </Button>
        )}
      </div>

      {!isPermanent && (
        <InlineAlert variant="warning">
          Le forfait-jours ne s'applique qu'aux salariés <strong>permanents</strong> ayant signé un
          avenant de forfait annuel en jours (Art. L.3121-58 du Code du travail).
        </InlineAlert>
      )}

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: 'config', label: 'Contrat' },
          { value: 'calc', label: 'Calculateurs' },
          { value: 'poses', label: 'Poses', disabled: !config?.isForfaitJours },
          { value: 'entretiens', label: 'Entretiens', disabled: !config?.isForfaitJours },
          { value: 'alertes', label: 'Alertes', disabled: !config?.isForfaitJours },
          { value: 'bilan', label: 'Bilan', disabled: !config?.isForfaitJours },
        ]}
      />

      {tab === 'config' && (
        <ConfigTab
          config={config}
          defaults={defaults}
          disabled={!isAdmin || !isPermanent}
          onSave={handleSaveConfig}
          saving={saving}
        />
      )}
      {tab === 'calc' && (
        <CalculatorsTab
          defaults={defaults}
          holidayInfo={holidayInfo}
          year={year}
          onYearChange={setYear}
          config={config}
        />
      )}
      {tab === 'poses' && <PosesTab personId={person.id} year={year} />}
      {tab === 'entretiens' && <EntretiensTab personId={person.id} year={year} isAdmin={isAdmin} />}
      {tab === 'alertes' && <AlertesTab personId={person.id} year={year} isAdmin={isAdmin} />}
      {tab === 'bilan' && bilan && (
        <BilanTab bilan={bilan} year={year} onYearChange={setYear} onExport={exportBilanCsv} />
      )}
      {tab === 'bilan' && !bilan && (
        <div className="forfait-empty">Aucun bilan disponible pour cette année.</div>
      )}
    </div>
  );
}

// ═══ Tab CONFIG ═══
function ConfigTab({ config, defaults, disabled, onSave, saving }) {
  const [local, setLocal] = useState(config || {});
  useEffect(() => setLocal(config || {}), [config]);
  const set = (patch) => setLocal((c) => ({ ...c, ...patch }));

  const submit = () => onSave(toPayload(local));

  return (
    <div className="forfait-config">
      <SectionHeader title="Paramètres contrat" />
      <div className="forfait-config-grid">
        <FormField label="Forfait plein (jours/an)" htmlFor="forfait_jours_annual">
          <Input
            type="number"
            id="forfait_jours_annual"
            value={local.forfaitJoursAnnual ?? ''}
            onChange={(e) =>
              set({ forfaitJoursAnnual: e.target.value ? Number(e.target.value) : null })
            }
            placeholder={String(defaults.FULL_FORFAIT_DAYS)}
            disabled={disabled}
            min={1}
            max={365}
          />
        </FormField>
        <FormField label="Taux forfait réduit (%)" htmlFor="reduced_pct">
          <Input
            type="number"
            id="reduced_pct"
            value={local.forfaitJoursReducedPct ?? ''}
            onChange={(e) =>
              set({ forfaitJoursReducedPct: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Ex : 80 (temps partiel)"
            disabled={disabled}
            min={1}
            max={100}
            step="0.1"
          />
        </FormField>
        <FormField label="Salaire annuel brut (€)" htmlFor="salary">
          <Input
            type="number"
            id="salary"
            value={local.forfaitAnnualSalary ?? ''}
            onChange={(e) =>
              set({ forfaitAnnualSalary: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="30 000"
            disabled={disabled}
            min={0}
            step="100"
          />
        </FormField>
        <FormField label="Majoration rachat (%)" htmlFor="majoration">
          <Input
            type="number"
            id="majoration"
            value={local.forfaitRachatMajorationPct ?? ''}
            onChange={(e) =>
              set({ forfaitRachatMajorationPct: e.target.value ? Number(e.target.value) : null })
            }
            placeholder={String(defaults.RACHAT_MIN_MAJORATION_PCT)}
            disabled={disabled}
            min={0}
            max={200}
            step="0.1"
          />
        </FormField>
        <FormField label="Date début forfait" htmlFor="start_date">
          <Input
            type="date"
            id="start_date"
            value={local.forfaitStartDate ?? ''}
            onChange={(e) => set({ forfaitStartDate: e.target.value || null })}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Date fin forfait" htmlFor="end_date">
          <Input
            type="date"
            id="end_date"
            value={local.forfaitEndDate ?? ''}
            onChange={(e) => set({ forfaitEndDate: e.target.value || null })}
            disabled={disabled}
          />
        </FormField>
        <FormField label="Niveau classification (≥ 4 requis)" htmlFor="classification_level">
          <Input
            type="number"
            id="classification_level"
            value={local.classificationLevel ?? ''}
            onChange={(e) =>
              set({ classificationLevel: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Ex : 4"
            disabled={disabled}
            min={1}
            max={15}
          />
        </FormField>
        <FormField label="Salaire min. catégorie (€ / an)" htmlFor="min_salary">
          <Input
            type="number"
            id="min_salary"
            value={local.forfaitMinAnnualSalary ?? ''}
            onChange={(e) =>
              set({ forfaitMinAnnualSalary: e.target.value ? Number(e.target.value) : null })
            }
            placeholder="Base catégorie — salaire réel doit être ≥ base + 20 %"
            disabled={disabled}
            min={0}
            step="100"
          />
        </FormField>
      </div>
      {!disabled && (
        <Button variant="primary" onClick={submit} disabled={saving}>
          <Save size={14} /> Enregistrer
        </Button>
      )}
    </div>
  );
}

function toPayload(local) {
  return {
    forfait_jours_annual: local.forfaitJoursAnnual ?? null,
    forfait_jours_reduced_pct: local.forfaitJoursReducedPct ?? null,
    forfait_annual_salary: local.forfaitAnnualSalary ?? null,
    forfait_rachat_majoration_pct: local.forfaitRachatMajorationPct ?? null,
    forfait_start_date: local.forfaitStartDate ?? null,
    forfait_end_date: local.forfaitEndDate ?? null,
    classification_level: local.classificationLevel ?? null,
    forfait_min_annual_salary: local.forfaitMinAnnualSalary ?? null,
  };
}

// ═══ Tab CALCULATEURS ═══
function CalculatorsTab({ defaults, holidayInfo, year, onYearChange, config }) {
  const [calc, setCalc] = useState('entree');
  const forfaitPlein = config?.forfaitJoursAnnual || defaults.FULL_FORFAIT_DAYS;
  const salaire = config?.forfaitAnnualSalary || 30000;
  const majoration = config?.forfaitRachatMajorationPct || defaults.RACHAT_MIN_MAJORATION_PCT;

  return (
    <div className="forfait-calc">
      <div className="forfait-calc-picker">
        <FormField label="Année" htmlFor="calc-year">
          <Select
            id="calc-year"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Calculateur" htmlFor="calc-type">
          <Select id="calc-type" value={calc} onChange={(e) => setCalc(e.target.value)}>
            <option value="entree">Entrée en cours d'année</option>
            <option value="sortie">Sortie en cours d'année</option>
            <option value="repos">Repos annuels (JRTT forfait)</option>
            <option value="rachat">Rachat de jours de repos</option>
            <option value="reduit">Forfait réduit (temps partiel)</option>
          </Select>
        </FormField>
        {holidayInfo && (
          <span className="forfait-year-info">
            <Calendar size={12} /> {holidayInfo.daysInYear} jours calendaires ·{' '}
            {holidayInfo.holidaysHorsWeekend} fériés hors WE
            {holidayInfo.isLeap && ' · bissextile'}
          </span>
        )}
      </div>
      {calc === 'entree' && <CalcEntree year={year} defaults={defaults} />}
      {calc === 'sortie' && (
        <CalcSortie year={year} defaults={defaults} salaire={salaire} forfaitPlein={forfaitPlein} />
      )}
      {calc === 'repos' && (
        <CalcRepos year={year} defaults={defaults} forfaitPlein={forfaitPlein} />
      )}
      {calc === 'rachat' && (
        <CalcRachat
          year={year}
          defaults={defaults}
          salaire={salaire}
          forfaitPlein={forfaitPlein}
          majoration={majoration}
        />
      )}
      {calc === 'reduit' && <CalcReduit forfaitPlein={forfaitPlein} defaults={defaults} />}
    </div>
  );
}

// ═══ Calculateurs individuels ═══
function CalcEntree({ year }) {
  const [dateEntree, setDateEntree] = useState(`${year}-01-01`);
  const [reposClassiques, setReposClassiques] = useState(9);
  const [cpAcquis, setCpAcquis] = useState(0);
  const [jdl, setJdl] = useState(0);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.calcForfaitEntree({
        year,
        dateEntree,
        reposClassiquesFullYear: Number(reposClassiques),
        cpAcquisAPrendre: Number(cpAcquis),
        journeeSolidarite: Number(jdl),
      });
      setRes(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forfait-calc-form">
      <FormField label="Date d'entrée">
        <Input type="date" value={dateEntree} onChange={(e) => setDateEntree(e.target.value)} />
      </FormField>
      <FormField label="Repos classiques année pleine">
        <Input
          type="number"
          value={reposClassiques}
          onChange={(e) => setReposClassiques(e.target.value)}
          min={0}
        />
      </FormField>
      <FormField label="CP ouvrés à consommer sur la période">
        <Input
          type="number"
          value={cpAcquis}
          onChange={(e) => setCpAcquis(e.target.value)}
          min={0}
        />
      </FormField>
      <FormField label="Journée de solidarité (0 ou 1)">
        <Input type="number" value={jdl} onChange={(e) => setJdl(e.target.value)} min={0} max={1} />
      </FormField>
      <Button variant="primary" onClick={run} disabled={busy}>
        <Calculator size={14} /> Calculer
      </Button>
      {res && (
        <ResultTable
          title="Prorata d'entrée"
          rows={[
            ['Jours calendaires restants', fmtNb(res.joursCalendairesRestants)],
            ['Samedis + dimanches', fmtNb(res.joursWeekend)],
            ['Jours fériés hors WE', fmtNb(res.joursFeriesHorsWeekend)],
            ['Prorata jours de repos', fmtNb(res.prorataJoursRepos)],
            ['Total à travailler', <strong key="tt">{fmtNb(res.totalATravailler)}</strong>],
          ]}
        />
      )}
    </div>
  );
}

function CalcSortie({ year, defaults, salaire, forfaitPlein }) {
  const [dateSortie, setDateSortie] = useState(`${year}-12-31`);
  const [cpFull, setCpFull] = useState(defaults.CP_LEGAL_DAYS_OUVRES);
  const [repos, setRepos] = useState(9);
  const [feries, setFeries] = useState(9);
  const [salaireY, setSalaireY] = useState(salaire);
  const [cpPris, setCpPris] = useState(0);
  const [salaireVerse, setSalaireVerse] = useState(0);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.calcForfaitSortie({
        year,
        forfaitPlein,
        cpOuvresFullYear: Number(cpFull),
        reposClassiquesFullYear: Number(repos),
        feriesHorsWeekendFullYear: Number(feries),
        dateSortie,
        salaireAnnuel: Number(salaireY),
        cpOuvresPrisPeriode: Number(cpPris),
        salaireVerse: Number(salaireVerse),
      });
      setRes(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forfait-calc-form">
      <FormField label="Date de sortie">
        <Input type="date" value={dateSortie} onChange={(e) => setDateSortie(e.target.value)} />
      </FormField>
      <FormField label="Salaire annuel brut (€)">
        <Input type="number" value={salaireY} onChange={(e) => setSalaireY(e.target.value)} />
      </FormField>
      <FormField label="CP ouvrés année pleine">
        <Input type="number" value={cpFull} onChange={(e) => setCpFull(e.target.value)} />
      </FormField>
      <FormField label="Fériés hors WE année pleine">
        <Input type="number" value={feries} onChange={(e) => setFeries(e.target.value)} />
      </FormField>
      <FormField label="Repos classiques année pleine">
        <Input type="number" value={repos} onChange={(e) => setRepos(e.target.value)} />
      </FormField>
      <FormField label="CP ouvrés pris sur la période">
        <Input type="number" value={cpPris} onChange={(e) => setCpPris(e.target.value)} />
      </FormField>
      <FormField label="Salaire déjà versé sur la période (€)">
        <Input
          type="number"
          value={salaireVerse}
          onChange={(e) => setSalaireVerse(e.target.value)}
        />
      </FormField>
      <Button variant="primary" onClick={run} disabled={busy}>
        <Calculator size={14} /> Calculer
      </Button>
      {res && (
        <ResultTable
          title="Solde de tout compte"
          rows={[
            ['Salaire journalier de référence', fmtEur(res.salaireJournalierRef)],
            ['Jours travaillés sur la période', fmtNb(res.joursTravaillesPeriode)],
            ['Fériés hors WE sur la période', fmtNb(res.feriesHorsWeekendPeriode)],
            ['Jours à rémunérer', fmtNb(res.joursARemunerer)],
            ['Rémunération due', fmtEur(res.remunerationDue)],
            ['Solde à régulariser', <strong key="s">{fmtEur(res.solde)}</strong>],
          ]}
        />
      )}
    </div>
  );
}

function CalcRepos({ year, defaults, forfaitPlein }) {
  const [cp, setCp] = useState(defaults.CP_LEGAL_DAYS_OUVRES);
  const [forfait, setForfait] = useState(forfaitPlein);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.calcForfaitReposAnnuels({
        year,
        cpOuvresFullYear: Number(cp),
        forfaitPlein: Number(forfait),
      });
      setRes(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forfait-calc-form">
      <FormField label="Forfait plein (jours)">
        <Input type="number" value={forfait} onChange={(e) => setForfait(e.target.value)} />
      </FormField>
      <FormField label="CP ouvrés année pleine">
        <Input type="number" value={cp} onChange={(e) => setCp(e.target.value)} />
      </FormField>
      <Button variant="primary" onClick={run} disabled={busy}>
        <Calculator size={14} /> Calculer
      </Button>
      {res && (
        <ResultTable
          title="Repos annuels forfait-jours"
          rows={[
            ['Jours calendaires', fmtNb(res.joursCalendaires)],
            ['Repos hebdomadaires', fmtNb(res.joursWeekend)],
            ['Fériés hors WE', fmtNb(res.feriesHorsWeekend)],
            ['Jours de repos à prendre', <strong key="r">{fmtNb(res.joursRepos)}</strong>],
          ]}
        />
      )}
    </div>
  );
}

function CalcRachat({ year, defaults, salaire, forfaitPlein, majoration }) {
  const [cp, setCp] = useState(defaults.CP_LEGAL_DAYS_OUVRES);
  const [feries, setFeries] = useState(10);
  const [salaireY, setSalaireY] = useState(salaire);
  const [maj, setMaj] = useState(majoration);
  const [nb, setNb] = useState(5);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const maxRachat = (defaults.RACHAT_MAX_TOTAL_DAYS ?? 235) - Number(forfaitPlein);
  const isMinMaj = Number(maj) >= (defaults.RACHAT_MIN_MAJORATION_PCT ?? 10);
  const isMaxOK = Number(nb) <= maxRachat;

  const run = async () => {
    setBusy(true);
    setErr(null);
    setRes(null);
    try {
      const r = await api.calcForfaitRachat({
        year,
        forfaitPlein: Number(forfaitPlein),
        cpOuvresFullYear: Number(cp),
        feriesHorsWeekendFullYear: Number(feries),
        salaireAnnuel: Number(salaireY),
        majorationPct: Number(maj),
        nbJoursARacheter: Number(nb),
      });
      setRes(r);
    } catch (e) {
      setErr(e?.error || e?.message || 'Erreur inconnue');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forfait-calc-form">
      <div className="forfait-calc-legal" style={{ gridColumn: '1 / -1' }}>
        <strong>Art. 5.7.3 4° :</strong> majoration ≥ <strong>10 %</strong> · &nbsp;plafond annuel{' '}
        <strong>235 jours</strong> travaillés (soit <strong>{maxRachat}</strong> jours rachetables
        maximum pour un forfait plein de {forfaitPlein} j) · &nbsp;versement avant le 31 décembre ·
        accord écrit du salarié requis.
      </div>
      <FormField label="Salaire annuel brut (€)">
        <Input type="number" value={salaireY} onChange={(e) => setSalaireY(e.target.value)} />
      </FormField>
      <FormField label="CP ouvrés année pleine">
        <Input type="number" value={cp} onChange={(e) => setCp(e.target.value)} />
      </FormField>
      <FormField label="Fériés hors WE année pleine">
        <Input type="number" value={feries} onChange={(e) => setFeries(e.target.value)} />
      </FormField>
      <FormField label="Majoration rachat (%)">
        <Input
          type="number"
          value={maj}
          onChange={(e) => setMaj(e.target.value)}
          step="0.1"
          min={10}
        />
      </FormField>
      <FormField label={`Nombre de jours à racheter (max ${maxRachat})`}>
        <Input
          type="number"
          value={nb}
          onChange={(e) => setNb(e.target.value)}
          min={1}
          max={maxRachat}
        />
      </FormField>
      <Button variant="primary" onClick={run} disabled={busy || !isMinMaj || !isMaxOK}>
        <Calculator size={14} /> Calculer
      </Button>
      {!isMinMaj && (
        <InlineAlert variant="warning" style={{ gridColumn: '1 / -1' }}>
          Majoration inférieure au minimum conventionnel (10 %).
        </InlineAlert>
      )}
      {!isMaxOK && (
        <InlineAlert variant="warning" style={{ gridColumn: '1 / -1' }}>
          Nombre de jours supérieur au plafond annuel (235 - {forfaitPlein} = {maxRachat} j).
        </InlineAlert>
      )}
      {err && (
        <InlineAlert variant="error" style={{ gridColumn: '1 / -1' }}>
          {err}
        </InlineAlert>
      )}
      {res && (
        <ResultTable
          title="Rachat de jours de repos"
          rows={[
            ['Salaire journalier de référence', fmtEur(res.salaireJournalierRef)],
            ['Total à payer', <strong key="t">{fmtEur(res.totalRachat)}</strong>],
            ...(res.warnings || []).map((w, i) => [`⚠️ Avertissement ${i + 1}`, w]),
          ]}
        />
      )}
    </div>
  );
}

function CalcReduit({ forfaitPlein, defaults }) {
  const [forfait, setForfait] = useState(forfaitPlein);
  const [taux, setTaux] = useState(80);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const r = await api.calcForfaitReduit({
        forfaitPlein: Number(forfait),
        tauxPct: Number(taux),
      });
      setRes(r);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="forfait-calc-form">
      <FormField label="Forfait plein (jours)">
        <Input type="number" value={forfait} onChange={(e) => setForfait(e.target.value)} />
      </FormField>
      <FormField label="Taux forfait réduit (%)">
        <Input
          type="number"
          value={taux}
          onChange={(e) => setTaux(e.target.value)}
          min={1}
          max={100}
          step="0.5"
        />
      </FormField>
      <Button variant="primary" onClick={run} disabled={busy}>
        <Calculator size={14} /> Calculer
      </Button>
      {res && (
        <ResultTable
          title="Forfait réduit"
          rows={[
            ['Jours à travailler prorata', <strong key="p">{fmtNb(res.prorataForfait)}</strong>],
          ]}
        />
      )}
    </div>
  );
}

// ═══ Tab BILAN ═══
function BilanTab({ bilan, year, onYearChange, onExport }) {
  const trimTotal = useMemo(
    () => bilan.trimestres.T1 + bilan.trimestres.T2 + bilan.trimestres.T3 + bilan.trimestres.T4,
    [bilan],
  );

  return (
    <div className="forfait-bilan">
      <div className="forfait-bilan-header">
        <FormField label="Année" htmlFor="bilan-year">
          <Select
            id="bilan-year"
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </FormField>
        <Button variant="secondary" onClick={onExport}>
          <Download size={14} /> Exporter en CSV
        </Button>
      </div>
      <SectionHeader title={`Bilan ${bilan.year}${bilan.isLeap ? ' (bissextile)' : ''}`} />
      <div className="forfait-bilan-grid">
        <div className="forfait-bilan-card">
          <h4>Repos annuels forfait</h4>
          <ul>
            <li>
              Calendaires : <strong>{fmtNb(bilan.reposAnnuels.joursCalendaires)}</strong>
            </li>
            <li>
              Repos hebdo : <strong>{fmtNb(bilan.reposAnnuels.joursWeekend)}</strong>
            </li>
            <li>
              Fériés hors WE : <strong>{fmtNb(bilan.reposAnnuels.feriesHorsWeekend)}</strong>
            </li>
            <li>
              Repos à prendre : <strong>{fmtNb(bilan.reposAnnuels.joursRepos)}</strong>
            </li>
          </ul>
        </div>
        <div className="forfait-bilan-card">
          <h4>Soldes congés</h4>
          <ul>
            <li>
              CP légaux : {fmtNb(bilan.soldes.cp?.days_taken)} /{' '}
              {fmtNb(bilan.soldes.cp?.days_entitled)}
            </li>
            <li>
              CP ancienneté : {fmtNb(bilan.soldes.cpAnciennete?.days_taken)} /{' '}
              {fmtNb(bilan.soldes.cpAnciennete?.days_entitled)}
            </li>
            <li>
              Repos forfait : {fmtNb(bilan.soldes.reposForfait?.days_taken)} /{' '}
              {fmtNb(bilan.soldes.reposForfait?.days_entitled)}
            </li>
            <li>
              Rachat : {fmtNb(bilan.soldes.rachat?.days_taken)} /{' '}
              {fmtNb(bilan.soldes.rachat?.days_entitled)}
            </li>
          </ul>
        </div>
        <div className="forfait-bilan-card">
          <h4>Jours travaillés (trimestres)</h4>
          <ul>
            <li>
              T1 : <strong>{fmtNb(bilan.trimestres.T1)}</strong>
            </li>
            <li>
              T2 : <strong>{fmtNb(bilan.trimestres.T2)}</strong>
            </li>
            <li>
              T3 : <strong>{fmtNb(bilan.trimestres.T3)}</strong>
            </li>
            <li>
              T4 : <strong>{fmtNb(bilan.trimestres.T4)}</strong>
            </li>
            <li>
              Total : <strong>{fmtNb(trimTotal)}</strong> / {fmtNb(bilan.forfaitPlein)}
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function ResultTable({ title, rows }) {
  return (
    <div className="forfait-result">
      <SectionHeader title={title} />
      <table>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}>
              <th>{k}</th>
              <td>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
