// ═══════════════════════════════════════════════════════════════
// FORMULAIRE DE DEMANDE DE CONGÉ
// Conforme Code du travail, IDCC 3252
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  X, Calendar, Clock, CheckCircle, FileText,
  Upload, Trash2, User, Info, Pen, Send,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../../utils/api';
import { Button, Select, Textarea, InlineAlert} from '@/design-system';
import './LeaveRequestForm.css';

// ═══════════════════════════════════════
// COMPOSANT SIGNATURE CANVAS
// ═══════════════════════════════════════

const SignaturePad = ({ onSign, onClear, value, label = 'Signature' }) => {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Si une signature existe déjà, la dessiner
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPoint.current = getPos(e);
  };

  const draw = (e) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPoint.current = pos;
  };

  const endDraw = () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSign(dataUrl);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onClear();
  };

  return (
    <div className="lrf-signature-pad">
      <div className="lrf-signature-label">
        <Pen size={14} />
        <span>{label}</span>
      </div>
      <canvas
        ref={canvasRef}
        className="lrf-signature-canvas"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="lrf-signature-actions">
        <Button variant="ghost" type="button" className="lrf-btn-clear" onClick={handleClear}>
          <Trash2 size={12} /> Effacer
        </Button>
        {value && (
          <span className="lrf-signature-ok">
            <CheckCircle size={12} /> Signé
          </span>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════
// FORMULAIRE PRINCIPAL
// ═══════════════════════════════════════

const LeaveRequestForm = ({
  person = null,
  persons = [],
  isAdmin = false,
  _currentUser = null,
  onClose,
  onCreated,
}) => {
  // State du formulaire
  const [selectedPersonId, setSelectedPersonId] = useState(person?.id || '');
  const [leaveType, setLeaveType] = useState('conge_paye');
  const [exceptionalType, setExceptionalType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startPeriod, setStartPeriod] = useState('AM');
  const [endPeriod, setEndPeriod] = useState('PM');
  const [comment, setComment] = useState('');
  const [signature, setSignature] = useState(null);

  // State des données
  const [leaveTypes, setLeaveTypes] = useState({});
  const [exceptionalTypes, setExceptionalTypes] = useState({});
  const [calculation, setCalculation] = useState(null);
  const [balance, setBalance] = useState(null);
  const [_holidays, setHolidays] = useState([]);

  // State du justificatif
  const [justificationFile, setJustificationFile] = useState(null);
  const [justificationName, setJustificationName] = useState('');
  const fileInputRef = useRef(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [showLegalInfo, setShowLegalInfo] = useState(false);

  // Charger les types de congés au montage
  useEffect(() => {
    const loadTypes = async () => {
      try {
        const data = await api.getLeaveTypes();
        setLeaveTypes(data.leaveTypes || {});
        setExceptionalTypes(data.exceptionalTypes || {});
      } catch (err) {
        console.error('Erreur chargement types:', err);
      }
    };
    loadTypes();
  }, []);

  // Charger le solde quand la personne change (admin uniquement)
  useEffect(() => {
    if (!selectedPersonId || !isAdmin) return;
    const loadBalance = async () => {
      try {
        const data = await api.getLeaveBalances({ personId: selectedPersonId, year: new Date().getFullYear() });
        setBalance(data);
      } catch (err) {
        console.error('Erreur chargement solde:', err);
      }
    };
    loadBalance();
  }, [selectedPersonId, isAdmin]);

  // Charger les jours fériés
  useEffect(() => {
    const loadHolidays = async () => {
      try {
        const data = await api.getPublicHolidays(new Date().getFullYear());
        setHolidays(data || []);
      } catch (err) {
        console.error('Erreur chargement fériés:', err);
      }
    };
    loadHolidays();
  }, []);

  // Calculer les jours ouvrables quand les dates changent
  useEffect(() => {
    if (!startDate || !endDate) {
      setCalculation(null);
      setWarnings([]);
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setWarnings([]);
      setCalculation(null);
      return;
    }

    let cancelled = false;
    const calculate = async () => {
      try {
        const result = await api.calculateLeaveWorkingDays({
          startDate, endDate, startPeriod, endPeriod,
          leaveType, exceptionalType: leaveType === 'exceptionnel' ? exceptionalType : undefined,
        });
        if (!cancelled) {
          setCalculation(result);
          setWarnings(result.warnings || []);
        }
      } catch (err) {
        console.error('Erreur calcul:', err);
      }
    };
    calculate();
    return () => { cancelled = true; };
  }, [startDate, endDate, startPeriod, endPeriod, leaveType, exceptionalType]);

  // Auto-calculer la date de fin pour les congés exceptionnels
  useEffect(() => {
    if (leaveType === 'exceptionnel' && exceptionalType && startDate) {
      const excType = exceptionalTypes[exceptionalType];
      if (excType?.days) {
        // Calculer la date de fin en jours ouvrables
        const start = new Date(startDate);
        let remaining = excType.days;
        const d = new Date(start);
        while (remaining > 0) {
          d.setDate(d.getDate() + 1);
          const dow = d.getDay();
          if (dow !== 0) remaining--; // Mon-Sat
        }
        const end = format(d, 'yyyy-MM-dd');
        setEndDate(end);
      }
    }
  }, [leaveType, exceptionalType, startDate, exceptionalTypes]);

  // Gérer l'upload de justificatif
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Le fichier ne doit pas dépasser 5 Mo');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setJustificationFile(reader.result.split(',')[1]); // base64
      setJustificationName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Vérifier si un justificatif est requis
  const needsJustification = useMemo(() => {
    if (leaveType === 'maladie') return true;
    if (leaveType === 'exceptionnel' && exceptionalType) {
      return exceptionalTypes[exceptionalType]?.requiresJustification || false;
    }
    return false;
  }, [leaveType, exceptionalType, exceptionalTypes]);

  // Soumettre la demande
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!selectedPersonId) {
      setError('Veuillez sélectionner un salarié');
      return;
    }
    if (!startDate || !endDate) {
      setError('Les dates de début et de fin sont obligatoires');
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError('La date de fin doit être postérieure à la date de début');
      return;
    }
    if (leaveType === 'exceptionnel' && !exceptionalType) {
      setError('Veuillez préciser le motif du congé exceptionnel');
      return;
    }

    setSaving(true);
    try {
      const data = {
        personId: parseInt(selectedPersonId),
        leaveType,
        exceptionalType: leaveType === 'exceptionnel' ? exceptionalType : undefined,
        startDate,
        endDate,
        startPeriod,
        endPeriod,
        employeeComment: comment || undefined,
        signatureEmployee: signature || undefined,
      };

      const result = await api.createLeaveRequest(data);

      // Upload du justificatif si présent
      if (justificationFile && result.id) {
        await api.uploadLeaveJustification(result.id, justificationName, justificationFile);
      }

      if (onCreated) onCreated(result);
      onClose();
    } catch (err) {
      const msg = err.error || err.message || 'Erreur lors de la création';
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  // Formatter une date FR
  const formatDateFR = (d) => {
    if (!d) return '';
    try {
      return format(parseISO(d), 'd MMMM yyyy', { locale: fr });
    } catch { return d; }
  };

  // Obtenir l'info du type sélectionné
  const _currentTypeInfo = leaveTypes[leaveType];

  return (
    <div className="lrf-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lrf-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Demande de congé">
        {/* En-tête */}
        <div className="lrf-header">
          <div className="lrf-header-title">
            <Calendar size={20} />
            <h2>Demande de congé</h2>
          </div>
          <div className="lrf-header-actions">
            <Button variant="ghost"               type="button"
              className="lrf-btn-info"
              onClick={() => setShowLegalInfo(!showLegalInfo)}
              title="Informations légales"
            >
              <Info size={16} />
            </Button>
            <Button variant="ghost" className="lrf-close-btn" onClick={onClose} aria-label="Fermer">
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Bandeau légal */}
        {showLegalInfo && (
          <div className="lrf-legal-info">
            <div className="lrf-legal-title">Références légales</div>
            <ul>
              <li>Code du travail — Art. L3141-1 à L3141-33 (Congés payés)</li>
              <li>Convention collective IDCC 3252 — Spectacle vivant</li>
              <li>Acquisition : 2,5 jours ouvrables / mois = 30 jours / an</li>
              <li>Période de référence : 1er juin → 31 mai</li>
              <li>Congé principal : min. 12 jours consécutifs entre mai et octobre</li>
              <li>Date limite de pose : 28 février</li>
              <li>Fermeture annuelle : 24 décembre → 1er janvier</li>
              <li>Modification impossible &lt; 1 mois avant le départ</li>
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="lrf-form">
          {/* Erreur globale */}
          {error && (
            <InlineAlert>{error}</InlineAlert>
          )}

          {/* Avertissements légaux */}
          {warnings.length > 0 && (
            <div className="lrf-warnings">
              {warnings.map((w, i) => (
                <InlineAlert key={i} variant="warning">{w}</InlineAlert>
              ))}
            </div>
          )}

          {/* Sélection du salarié */}
          <div className="lrf-field">
            <label className="lrf-label">
              <User size={14} />
              Salarié
            </label>
            {isAdmin ? (
              <Select
                value={selectedPersonId}
                onChange={e => setSelectedPersonId(e.target.value)}
                className="lrf-select"
                required
              >
                <option value="">— Sélectionner —</option>
                {persons.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.firstName || p.first_name} {p.lastName || p.last_name}
                  </option>
                ))}
              </Select>
            ) : (
              <div className="lrf-person-display">
                {person ? `${person.firstName || person.first_name} ${person.lastName || person.last_name}` : '—'}
              </div>
            )}
          </div>

          {/* Type de congé */}
          <div className="lrf-field">
            <label className="lrf-label">
              <FileText size={14} />
              Type de congé
            </label>
            <div className="lrf-type-grid">
              {Object.entries(leaveTypes).map(([key, info]) => (
                <Button variant="ghost"                   key={key}
                  type="button"
                  className={`lrf-type-btn ${leaveType === key ? 'active' : ''}`}
                  onClick={() => { setLeaveType(key); setExceptionalType(''); }}
                  style={{ '--type-color': info.color }}
                >
                  <span className="lrf-type-icon">{info.icon}</span>
                  <span className="lrf-type-label">{info.label}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Sous-type exceptionnel */}
          {leaveType === 'exceptionnel' && (
            <div className="lrf-field">
              <label className="lrf-label">
                <Info size={14} />
                Motif du congé exceptionnel
              </label>
              <Select
                value={exceptionalType}
                onChange={e => setExceptionalType(e.target.value)}
                className="lrf-select"
                required
              >
                <option value="">— Sélectionner le motif —</option>
                {Object.entries(exceptionalTypes).map(([key, info]) => (
                  <option key={key} value={key}>
                    {info.label} ({info.days} jour{info.days > 1 ? 's' : ''})
                  </option>
                ))}
              </Select>
              {exceptionalType && exceptionalTypes[exceptionalType] && (
                <div className="lrf-exceptional-info">
                  <CheckCircle size={12} />
                  <span>
                    Durée légale : <strong>{exceptionalTypes[exceptionalType].days} jour{exceptionalTypes[exceptionalType].days > 1 ? 's' : ''} ouvrable{exceptionalTypes[exceptionalType].days > 1 ? 's' : ''}</strong>
                    {exceptionalTypes[exceptionalType].requiresJustification && (
                      <> — <em>Justificatif obligatoire</em></>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="lrf-dates-row">
            <div className="lrf-field lrf-date-field">
              <label className="lrf-label">Date de début</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="lrf-input"
                required
              />
              <div className="lrf-period-btns">
                <Button variant="ghost"                   type="button"
                  className={`lrf-period-btn ${startPeriod === 'AM' ? 'active' : ''}`}
                  onClick={() => setStartPeriod('AM')}
                >
                  Matin
                </Button>
                <Button variant="ghost"                   type="button"
                  className={`lrf-period-btn ${startPeriod === 'PM' ? 'active' : ''}`}
                  onClick={() => setStartPeriod('PM')}
                >
                  Après-midi
                </Button>
              </div>
            </div>
            <div className="lrf-dates-arrow">→</div>
            <div className="lrf-field lrf-date-field">
              <label className="lrf-label">Date de fin</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="lrf-input"
                required
                min={startDate}
              />
              <div className="lrf-period-btns">
                <Button variant="ghost"                   type="button"
                  className={`lrf-period-btn ${endPeriod === 'AM' ? 'active' : ''}`}
                  onClick={() => setEndPeriod('AM')}
                >
                  Matin
                </Button>
                <Button variant="ghost"                   type="button"
                  className={`lrf-period-btn ${endPeriod === 'PM' ? 'active' : ''}`}
                  onClick={() => setEndPeriod('PM')}
                >
                  Après-midi
                </Button>
              </div>
            </div>
          </div>

          {/* Résumé du calcul */}
          {calculation && (
            <div className="lrf-calculation">
              <div className="lrf-calc-main">
                <Calendar size={16} />
                <span className="lrf-calc-days">{calculation.workingDays}</span>
                <span>jour{calculation.workingDays > 1 ? 's' : ''} ouvrable{calculation.workingDays > 1 ? 's' : ''}</span>
                {calculation.fixedDuration && (
                  <span className="lrf-calc-fixed">(durée légale fixe)</span>
                )}
              </div>

              {calculation.holidaysInPeriod?.length > 0 && (
                <div className="lrf-calc-holidays">
                  <span className="lrf-calc-holidays-label">Jours fériés exclus :</span>
                  {calculation.holidaysInPeriod.map((h, i) => (
                    <span key={i} className="lrf-holiday-chip">
                      {formatDateFR(h.date)} — {h.name}
                    </span>
                  ))}
                </div>
              )}

              {calculation.referencePeriod && (
                <div className="lrf-calc-ref">
                  Période de référence : {calculation.referencePeriod.label}
                </div>
              )}
            </div>
          )}

          {/* Solde de congés */}
          {balance && leaveType === 'conge_paye' && (
            <div className="lrf-balance">
              <div className="lrf-balance-title">Solde de congés payés</div>
              <div className="lrf-balance-grid">
                <div className="lrf-balance-item">
                  <span className="lrf-balance-value">{balance.daysEntitled ?? balance.days_entitled ?? 30}</span>
                  <span className="lrf-balance-label">Acquis</span>
                </div>
                <div className="lrf-balance-item">
                  <span className="lrf-balance-value">{balance.daysTaken ?? balance.days_taken ?? 0}</span>
                  <span className="lrf-balance-label">Pris</span>
                </div>
                <div className="lrf-balance-item highlight">
                  <span className="lrf-balance-value">{balance.remaining ?? (balance.daysEntitled || balance.days_entitled || 30) - (balance.daysTaken || balance.days_taken || 0)}</span>
                  <span className="lrf-balance-label">Restant</span>
                </div>
                {(balance.carryOver ?? balance.carry_over) > 0 && (
                  <div className="lrf-balance-item carry">
                    <span className="lrf-balance-value">+{balance.carryOver ?? balance.carry_over}</span>
                    <span className="lrf-balance-label">Report</span>
                  </div>
                )}
              </div>
              {calculation && balance.remaining != null && calculation.workingDays > balance.remaining + (balance.carryOver || 0) && (
                <InlineAlert variant="warning">
                  Solde insuffisant ({balance.remaining + (balance.carryOver || 0)} jours disponibles, {calculation.workingDays} demandés)
                </InlineAlert>
              )}
            </div>
          )}

          {/* Commentaire */}
          <div className="lrf-field">
            <label className="lrf-label">Remarques (optionnel)</label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="lrf-textarea"
              rows={3}
              placeholder="Précisions complémentaires..."
            />
          </div>

          {/* Upload justificatif */}
          {needsJustification && (
            <div className="lrf-field">
              <label className="lrf-label">
                <Upload size={14} />
                Justificatif {needsJustification ? '(obligatoire)' : '(optionnel)'}
              </label>
              <div className="lrf-upload-zone">
                {justificationName ? (
                  <div className="lrf-upload-file">
                    <FileText size={14} />
                    <span>{justificationName}</span>
                    <Button variant="ghost" type="button" onClick={() => { setJustificationFile(null); setJustificationName(''); }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                ) : (
                  <Button variant="ghost"                     type="button"
                    className="lrf-upload-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={16} />
                    <span>Choisir un fichier (PDF, image, max 5 Mo)</span>
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </div>
            </div>
          )}

          {/* Signature électronique */}
          <SignaturePad
            label="Signature du salarié"
            value={signature}
            onSign={setSignature}
            onClear={() => setSignature(null)}
          />

          {/* Actions */}
          <div className="lrf-actions">
            <Button variant="ghost" onClick={onClose}>
              Annuler
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={saving}
            >
              {saving ? (
                <>
                  <Clock size={14} /> Envoi en cours...
                </>
              ) : (
                <>
                  <Send size={14} /> Soumettre la demande
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LeaveRequestForm;
