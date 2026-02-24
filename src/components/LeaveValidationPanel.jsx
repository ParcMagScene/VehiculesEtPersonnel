// ═══════════════════════════════════════════════════════════════
// PANNEAU DE VALIDATION DES CONGÉS — Admin / Responsable
// Conforme Code du travail, IDCC 3252, Politique Mag Scène
// Workflow : consultation → décision → signature → notification
// ═══════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Calendar, Clock, CheckCircle, XCircle, AlertTriangle,
  FileText, Download, ChevronDown, User,
  Shield, Pen, MessageSquare, RefreshCw, BarChart3,
  Eye, Send, ArrowRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import api from '../utils/api';
import { STATUS_CONFIG, LEAVE_TYPE_LABELS } from './leaveConstants';
import './LeaveValidationPanel.css';

// ═══════════════════════════════════════
// COMPOSANT SIGNATURE CANVAS (admin)
// ═══════════════════════════════════════

const AdminSignaturePad = ({ onSign, value }) => {
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
  }, []);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches ? e.touches[0] : e;
    return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
  };

  const startDraw = (e) => { e.preventDefault(); isDrawing.current = true; lastPoint.current = getPos(e); };
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
    onSign(canvasRef.current.toDataURL('image/png'));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    onSign(null);
  };

  return (
    <div className="lvp-sig-pad">
      <div className="lvp-sig-label"><Pen size={12} /> Signature employeur</div>
      <canvas
        ref={canvasRef}
        className="lvp-sig-canvas"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
      />
      <button type="button" className="lvp-sig-clear" onClick={clear}>Effacer</button>
    </div>
  );
};

// ═══════════════════════════════════════
// PANNEAU PRINCIPAL
// ═══════════════════════════════════════

const LeaveValidationPanel = ({ onClose, onUpdated }) => {
  const [tab, setTab] = useState('pending');
  const [requests, setRequests] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [error, setError] = useState('');

  // State de décision
  const [decisionMode, setDecisionMode] = useState(null); // { id, action: 'accept'|'refuse'|'modify' }
  const [adminComment, setAdminComment] = useState('');
  const [modifiedStartDate, setModifiedStartDate] = useState('');
  const [modifiedEndDate, setModifiedEndDate] = useState('');
  const [adminSignature, setAdminSignature] = useState(null);
  const [processing, setProcessing] = useState(false);

  // Charger les données
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pending, allLeaves, conflictsData, statsData] = await Promise.all([
        api.getPendingLeaves(),
        api.getAllLeaves(),
        api.getLeaveConflicts().catch(() => []),
        api.getLeaveStats(new Date().getFullYear()).catch(() => null),
      ]);
      setRequests(tab === 'pending' ? pending : allLeaves);
      setConflicts(conflictsData || []);
      setStats(statsData);
    } catch (err) {
      console.error('Erreur chargement:', err);
      setError('Impossible de charger les données');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  // Formatter date
  const fmtDate = (d) => {
    if (!d) return '—';
    try { return format(parseISO(d), 'd MMM yyyy', { locale: fr }); }
    catch { return d; }
  };

  // Prendre une décision
  const handleDecision = async () => {
    if (!decisionMode) return;
    const { id, action } = decisionMode;

    // Validation
    if ((action === 'refuse' || action === 'modify') && !adminComment.trim()) {
      setError('Le motif est obligatoire pour un refus ou une modification');
      return;
    }
    if (action === 'modify' && (!modifiedStartDate || !modifiedEndDate)) {
      setError('Les nouvelles dates sont obligatoires pour une modification');
      return;
    }

    setProcessing(true);
    setError('');
    try {
      const status = action === 'accept' ? 'accepted' : action === 'refuse' ? 'refused' : 'modified';
      await api.makeLeaveDecision(id, {
        status,
        adminComment: adminComment || undefined,
        modifiedStartDate: action === 'modify' ? modifiedStartDate : undefined,
        modifiedEndDate: action === 'modify' ? modifiedEndDate : undefined,
        signatureAdmin: adminSignature || undefined,
      });

      // Signer si signature fournie
      if (adminSignature) {
        await api.signLeave(id, adminSignature, 'admin');
      }

      setDecisionMode(null);
      setAdminComment('');
      setModifiedStartDate('');
      setModifiedEndDate('');
      setAdminSignature(null);
      loadData();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.error || err.message || 'Erreur lors du traitement');
    } finally {
      setProcessing(false);
    }
  };

  // Télécharger PDF
  const handlePdf = async (id) => {
    try {
      const data = await api.getLeavePdf(id);
      if (data.html) {
        const win = window.open('', '_blank');
        win.document.write(data.html);
        win.document.close();
        setTimeout(() => win.print(), 500);
      }
    } catch (err) { setError('Erreur génération PDF'); }
  };

  return (
    <div className="lvp-overlay" onClick={onClose}>
      <div className="lvp-panel" onClick={e => e.stopPropagation()}>
        {/* En-tête */}
        <div className="lvp-header">
          <div className="lvp-header-title">
            <Shield size={20} />
            <h2>Validation des congés</h2>
          </div>
          <div className="lvp-header-actions">
            <button className="lvp-btn-refresh" onClick={loadData}><RefreshCw size={16} /></button>
            <button className="lvp-close-btn" onClick={onClose}><X size={20} /></button>
          </div>
        </div>

        {/* Statistiques */}
        {stats && (
          <div className="lvp-stats-bar">
            <div className="lvp-stat-item">
              <BarChart3 size={14} />
              <span>{stats.total} demandes en {new Date().getFullYear()}</span>
            </div>
            <div className="lvp-stat-item pending">
              <Clock size={14} />
              <span>{stats.pending} en attente</span>
            </div>
            <div className="lvp-stat-item accepted">
              <CheckCircle size={14} />
              <span>{stats.accepted} acceptées</span>
            </div>
            <div className="lvp-stat-item">
              <Calendar size={14} />
              <span>{stats.totalDays} jours posés</span>
            </div>
          </div>
        )}

        {/* Onglets */}
        <div className="lvp-tabs">
          <button
            className={`lvp-tab ${tab === 'pending' ? 'active' : ''}`}
            onClick={() => setTab('pending')}
          >
            <Clock size={14} /> En attente
            {stats?.pending > 0 && <span className="lvp-tab-badge">{stats.pending}</span>}
          </button>
          <button
            className={`lvp-tab ${tab === 'all' ? 'active' : ''}`}
            onClick={() => setTab('all')}
          >
            <FileText size={14} /> Toutes
          </button>
          <button
            className={`lvp-tab ${tab === 'conflicts' ? 'active' : ''}`}
            onClick={() => setTab('conflicts')}
          >
            <AlertTriangle size={14} /> Conflits
            {conflicts.length > 0 && <span className="lvp-tab-badge warn">{conflicts.length}</span>}
          </button>
        </div>

        {/* Erreur */}
        {error && (
          <div className="lvp-error">
            <AlertTriangle size={14} /> {error}
            <button onClick={() => setError('')}>×</button>
          </div>
        )}

        {/* Contenu */}
        <div className="lvp-content">
          {loading ? (
            <div className="lvp-loading"><Clock size={20} /> Chargement...</div>
          ) : tab === 'conflicts' ? (
            // Onglet Conflits
            conflicts.length === 0 ? (
              <div className="lvp-empty">
                <CheckCircle size={32} />
                <p>Aucun conflit détecté</p>
              </div>
            ) : (
              conflicts.map((c, idx) => (
                <div key={idx} className="lvp-conflict-card">
                  <div className="lvp-conflict-header">
                    <AlertTriangle size={14} />
                    <span>Chevauchement détecté</span>
                    <span className="lvp-conflict-overlap">
                      {fmtDate(c.overlapStart)} → {fmtDate(c.overlapEnd)}
                    </span>
                  </div>
                  <div className="lvp-conflict-requests">
                    <div className="lvp-conflict-req">
                      <User size={12} />
                      <strong>{c.request1.first_name} {c.request1.last_name}</strong>
                      <span>{fmtDate(c.request1.start_date)} → {fmtDate(c.request1.end_date)}</span>
                      <span className="lvp-conflict-score">Priorité: {c.request1.priority_score}</span>
                    </div>
                    <div className="lvp-conflict-vs">VS</div>
                    <div className="lvp-conflict-req">
                      <User size={12} />
                      <strong>{c.request2.first_name} {c.request2.last_name}</strong>
                      <span>{fmtDate(c.request2.start_date)} → {fmtDate(c.request2.end_date)}</span>
                      <span className="lvp-conflict-score">Priorité: {c.request2.priority_score}</span>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            // Onglet demandes
            requests.length === 0 ? (
              <div className="lvp-empty">
                <CheckCircle size={32} />
                <p>{tab === 'pending' ? 'Aucune demande en attente' : 'Aucune demande'}</p>
              </div>
            ) : (
              requests.map(req => {
                const statusCfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const typeCfg = LEAVE_TYPE_LABELS[req.leave_type || req.leaveType] || LEAVE_TYPE_LABELS.conge_paye;
                const isExpanded = expandedId === req.id;
                const isDeciding = decisionMode?.id === req.id;

                return (
                  <div key={req.id} className={`lvp-card ${req.status}`}>
                    <div
                      className="lvp-card-main"
                      onClick={() => setExpandedId(isExpanded ? null : req.id)}
                    >
                      {/* Info personne */}
                      <div className="lvp-card-person">
                        {req.person_photo ? (
                          <img src={req.person_photo} alt="" className="lvp-person-avatar" />
                        ) : (
                          <div className="lvp-person-avatar-placeholder">
                            <User size={14} />
                          </div>
                        )}
                        <div>
                          <div className="lvp-person-name">
                            {req.first_name || req.firstName} {req.last_name || req.lastName}
                          </div>
                          <div className="lvp-person-meta">
                            {req.person_type || req.personType} • {req.contract_type || req.contractType || '—'}
                          </div>
                        </div>
                      </div>

                      {/* Type & dates */}
                      <div className="lvp-card-info">
                        <div className="lvp-card-type" style={{ color: typeCfg.color }}>
                          {typeCfg.icon} {typeCfg.label}
                        </div>
                        <div className="lvp-card-dates">
                          {fmtDate(req.start_date || req.startDate)} → {fmtDate(req.end_date || req.endDate)}
                        </div>
                        <div className="lvp-card-days">
                          {req.working_days || req.workingDays} jour{(req.working_days || req.workingDays) > 1 ? 's' : ''}
                        </div>
                      </div>

                      {/* Status + priority */}
                      <div className="lvp-card-right">
                        <div className="lvp-card-status" style={{ background: statusCfg.bg, color: statusCfg.color }}>
                          <StatusIcon size={12} /> {statusCfg.label}
                        </div>
                        {req.priority_score > 0 && (
                          <div className="lvp-card-priority" title="Score de priorité">
                            ★ {req.priority_score || req.priorityScore}
                          </div>
                        )}
                        <ChevronDown
                          size={14}
                          className="lvp-card-chevron"
                          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}
                        />
                      </div>
                    </div>

                    {/* Détails expansés */}
                    {isExpanded && (
                      <div className="lvp-card-expanded">
                        {req.employee_comment && (
                          <div className="lvp-detail">
                            <MessageSquare size={12} />
                            <span className="lvp-detail-label">Commentaire salarié :</span>
                            <span>{req.employee_comment || req.employeeComment}</span>
                          </div>
                        )}
                        {req.request_date && (
                          <div className="lvp-detail">
                            <Calendar size={12} />
                            <span className="lvp-detail-label">Demandé le :</span>
                            <span>{fmtDate(req.request_date || req.requestDate)}</span>
                          </div>
                        )}
                        {req.reception_date && (
                          <div className="lvp-detail">
                            <Eye size={12} />
                            <span className="lvp-detail-label">Réceptionné :</span>
                            <span>{fmtDate(req.reception_date || req.receptionDate)}</span>
                          </div>
                        )}
                        {req.signature_employee && (
                          <div className="lvp-detail">
                            <Pen size={12} />
                            <span className="lvp-detail-label">Signature salarié :</span>
                            <span className="lvp-sig-ok"><CheckCircle size={12} /> Signé</span>
                          </div>
                        )}
                        {req.admin_comment && (
                          <div className="lvp-detail">
                            <Shield size={12} />
                            <span className="lvp-detail-label">Réponse admin :</span>
                            <span>{req.admin_comment || req.adminComment}</span>
                          </div>
                        )}
                        {req.decision_by_name && (
                          <div className="lvp-detail">
                            <User size={12} />
                            <span className="lvp-detail-label">Décision par :</span>
                            <span>{req.decision_by_name || req.decisionByName} le {fmtDate(req.decision_date || req.decisionDate)}</span>
                          </div>
                        )}
                        {req.justification_filename && (
                          <div className="lvp-detail">
                            <FileText size={12} />
                            <span className="lvp-detail-label">Justificatif :</span>
                            <a href={req.justification_path || req.justificationPath} target="_blank" rel="noopener noreferrer">
                              {req.justification_filename || req.justificationFilename}
                            </a>
                          </div>
                        )}

                        {/* Bouton PDF */}
                        <div className="lvp-detail-actions">
                          <button className="lvp-action-btn pdf" onClick={() => handlePdf(req.id)}>
                            <Download size={14} /> PDF
                          </button>
                        </div>

                        {/* ZONE DE DÉCISION (pending uniquement) */}
                        {req.status === 'pending' && !isDeciding && (
                          <div className="lvp-decision-btns">
                            <button
                              className="lvp-decision-btn accept"
                              onClick={() => { setDecisionMode({ id: req.id, action: 'accept' }); setAdminComment(''); }}
                            >
                              <CheckCircle size={14} /> Accepter
                            </button>
                            <button
                              className="lvp-decision-btn refuse"
                              onClick={() => { setDecisionMode({ id: req.id, action: 'refuse' }); setAdminComment(''); }}
                            >
                              <XCircle size={14} /> Refuser
                            </button>
                            <button
                              className="lvp-decision-btn modify"
                              onClick={() => {
                                setDecisionMode({ id: req.id, action: 'modify' });
                                setAdminComment('');
                                setModifiedStartDate(req.start_date || req.startDate || '');
                                setModifiedEndDate(req.end_date || req.endDate || '');
                              }}
                            >
                              <ArrowRight size={14} /> Modifier
                            </button>
                          </div>
                        )}

                        {/* FORMULAIRE DE DÉCISION */}
                        {isDeciding && (
                          <div className="lvp-decision-form">
                            <div className="lvp-decision-title">
                              {decisionMode.action === 'accept' && <><CheckCircle size={14} /> Accepter cette demande</>}
                              {decisionMode.action === 'refuse' && <><XCircle size={14} /> Refuser cette demande</>}
                              {decisionMode.action === 'modify' && <><ArrowRight size={14} /> Modifier cette demande</>}
                            </div>

                            {/* Motif (obligatoire pour refus/modification) */}
                            {(decisionMode.action === 'refuse' || decisionMode.action === 'modify') && (
                              <div className="lvp-decision-field">
                                <label>
                                  Motif {decisionMode.action === 'refuse' ? 'du refus' : 'de la modification'} *
                                </label>
                                <textarea
                                  value={adminComment}
                                  onChange={e => setAdminComment(e.target.value)}
                                  placeholder="Motif obligatoire..."
                                  rows={2}
                                  required
                                />
                              </div>
                            )}

                            {/* Commentaire (optionnel pour acceptation) */}
                            {decisionMode.action === 'accept' && (
                              <div className="lvp-decision-field">
                                <label>Commentaire (optionnel)</label>
                                <textarea
                                  value={adminComment}
                                  onChange={e => setAdminComment(e.target.value)}
                                  placeholder="Commentaire..."
                                  rows={2}
                                />
                              </div>
                            )}

                            {/* Dates modifiées */}
                            {decisionMode.action === 'modify' && (
                              <div className="lvp-decision-dates">
                                <div className="lvp-decision-field">
                                  <label>Nouvelle date de début</label>
                                  <input
                                    type="date"
                                    value={modifiedStartDate}
                                    onChange={e => setModifiedStartDate(e.target.value)}
                                    required
                                  />
                                </div>
                                <div className="lvp-decision-field">
                                  <label>Nouvelle date de fin</label>
                                  <input
                                    type="date"
                                    value={modifiedEndDate}
                                    onChange={e => setModifiedEndDate(e.target.value)}
                                    required
                                  />
                                </div>
                              </div>
                            )}

                            {/* Signature admin */}
                            <AdminSignaturePad
                              value={adminSignature}
                              onSign={setAdminSignature}
                            />

                            {/* Actions */}
                            <div className="lvp-decision-actions">
                              <button
                                className="lvp-action-btn cancel"
                                onClick={() => {
                                  setDecisionMode(null);
                                  setAdminComment('');
                                  setAdminSignature(null);
                                }}
                              >
                                Annuler
                              </button>
                              <button
                                className={`lvp-action-btn confirm ${decisionMode.action}`}
                                onClick={handleDecision}
                                disabled={processing}
                              >
                                {processing ? (
                                  <><Clock size={14} /> Traitement...</>
                                ) : (
                                  <>
                                    <Send size={14} />
                                    {decisionMode.action === 'accept' && 'Confirmer l\'acceptation'}
                                    {decisionMode.action === 'refuse' && 'Confirmer le refus'}
                                    {decisionMode.action === 'modify' && 'Confirmer la modification'}
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default LeaveValidationPanel;
