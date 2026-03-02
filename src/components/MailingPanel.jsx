import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Mail, FileText, Clock, Send, Plus, Trash2, Edit3, Eye,
  Search, ChevronDown, ChevronUp, Users, AlertTriangle, Check,
  Copy, Settings, RefreshCw
} from 'lucide-react';
import api from '../utils/api';
import './MailingPanel.css';

// Variables disponibles pour les templates
const AVAILABLE_VARS = [
  { key: 'nom', label: 'Nom du destinataire', example: 'Jean Dupont' },
  { key: 'email', label: 'Email du destinataire', example: 'jean@example.com' },
  { key: 'date', label: "Date du jour", example: new Date().toLocaleDateString('fr-FR') },
  { key: 'entreprise', label: "Nom de l'entreprise", example: 'eM@g' },
  { key: 'objet', label: 'Objet personnalisé', example: 'Votre commande' },
];

const TEMPLATE_CATEGORIES = [
  { value: 'general', label: 'Général' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'technique', label: 'Technique' },
  { value: 'rh', label: 'Ressources Humaines' },
  { value: 'relance', label: 'Relance' },
];

const DEFAULT_HTML = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 20px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 1.4rem;">eM@g</h1>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <p>Bonjour {{nom}},</p>
    <p>Votre contenu ici...</p>
    <p style="color: #64748b; font-size: 0.85rem; margin-top: 24px;">— L'équipe {{entreprise}}</p>
  </div>
</div>`;

export default function MailingPanel({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('compose'); // compose, templates, history, config
  const [templates, setTemplates] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [emailConfig, setEmailConfig] = useState(null);

  // Composer state
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [composeSubject, setComposeSubject] = useState('');
  const [composeHtml, setComposeHtml] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [manualEmail, setManualEmail] = useState('');
  const [composeVars, setComposeVars] = useState({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewHtml, setPreviewHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [contactSearch, setContactSearch] = useState('');

  // Template editor state
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const [tplHtml, setTplHtml] = useState('');
  const [tplCategory, setTplCategory] = useState('general');
  const [tplVars, setTplVars] = useState([]);
  const [savingTpl, setSavingTpl] = useState(false);

  // Config state
  const [configForm, setConfigForm] = useState({});
  const [savingConfig, setSavingConfig] = useState(false);
  const [configTestResult, setConfigTestResult] = useState(null);

  // Charger les données
  const loadData = useCallback(async () => {
    if (!isOpen) return;
    setLoading(true);
    try {
      const [tpls, ctcts, hist, cfg] = await Promise.all([
        api.getMailTemplates().catch(() => []),
        api.getMailingContacts().catch(() => []),
        api.getMailingHistory().catch(() => ({ history: [], total: 0 })),
        api.getEmailConfig().catch(() => null),
      ]);
      setTemplates(tpls);
      setContacts(ctcts);
      setHistory(hist.history || []);
      setHistoryTotal(hist.total || 0);
      setEmailConfig(cfg);
      if (cfg) setConfigForm(cfg);
    } catch { /* silent */ }
    setLoading(false);
  }, [isOpen]);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtrer contacts
  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
    );
  }, [contacts, contactSearch]);

  // ═══ Composer ═══
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setComposeSubject(tpl.subject);
    setComposeHtml(tpl.html_body);
    // Extraire les variables du template
    const vars = {};
    (tpl.variables || []).forEach(v => { vars[v] = ''; });
    setComposeVars(vars);
  };

  const addRecipient = (email) => {
    if (email && !selectedRecipients.includes(email)) {
      setSelectedRecipients(prev => [...prev, email]);
    }
  };

  const removeRecipient = (email) => {
    setSelectedRecipients(prev => prev.filter(e => e !== email));
  };

  const handlePreview = async () => {
    try {
      const result = await api.previewMailing({
        template_id: selectedTemplate?.id,
        subject: composeSubject,
        html_body: composeHtml,
        variables: composeVars,
      });
      setPreviewHtml(result.html);
      setShowPreview(true);
    } catch { /* silent */ }
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) return;
    if (!composeSubject.trim()) return;

    setSending(true);
    setSendResult(null);
    try {
      const result = await api.sendMailing({
        template_id: selectedTemplate?.id,
        recipients: selectedRecipients,
        subject: composeSubject,
        html_body: composeHtml,
        variables: composeVars,
      });
      setSendResult(result);
      // Rafraîchir l'historique
      const hist = await api.getMailingHistory();
      setHistory(hist.history || []);
      setHistoryTotal(hist.total || 0);
    } catch (err) {
      setSendResult({ message: 'Erreur: ' + (err.message || 'Échec envoi') });
    }
    setSending(false);
  };

  const resetCompose = () => {
    setSelectedTemplate(null);
    setComposeSubject('');
    setComposeHtml('');
    setSelectedRecipients([]);
    setComposeVars({});
    setShowPreview(false);
    setSendResult(null);
  };

  // ═══ Templates ═══
  const openTemplateEditor = (tpl = null) => {
    if (tpl) {
      setEditingTemplate(tpl);
      setTplName(tpl.name);
      setTplSubject(tpl.subject);
      setTplHtml(tpl.html_body);
      setTplCategory(tpl.category || 'general');
      setTplVars(tpl.variables || []);
    } else {
      setEditingTemplate({ id: null });
      setTplName('');
      setTplSubject('');
      setTplHtml(DEFAULT_HTML);
      setTplCategory('general');
      setTplVars([]);
    }
  };

  const saveTemplate = async () => {
    if (!tplName.trim()) return;
    setSavingTpl(true);
    try {
      const data = {
        name: tplName,
        subject: tplSubject,
        html_body: tplHtml,
        variables: tplVars,
        category: tplCategory,
      };

      if (editingTemplate.id) {
        await api.updateMailTemplate(editingTemplate.id, data);
      } else {
        await api.createMailTemplate(data);
      }

      setEditingTemplate(null);
      const tpls = await api.getMailTemplates();
      setTemplates(tpls);
    } catch { /* silent */ }
    setSavingTpl(false);
  };

  const deleteTemplate = async (id) => {
    if (!confirm('Supprimer ce template ?')) return;
    try {
      await api.deleteMailTemplate(id);
      setTemplates(prev => prev.filter(t => t.id !== id));
    } catch { /* silent */ }
  };

  const insertVariable = (varKey) => {
    setTplHtml(prev => prev + `{{${varKey}}}`);
    if (!tplVars.includes(varKey)) {
      setTplVars(prev => [...prev, varKey]);
    }
  };

  // ═══ Config ═══
  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      await api.updateEmailConfig(configForm);
      setEmailConfig(configForm);
    } catch { /* silent */ }
    setSavingConfig(false);
  };

  const testConfig = async () => {
    setConfigTestResult(null);
    try {
      const result = await api.testEmail();
      setConfigTestResult({ success: true, message: result.message });
    } catch (err) {
      setConfigTestResult({ success: false, message: err.message || 'Échec du test' });
    }
  };

  if (!isOpen) return null;

  const smtpConfigured = emailConfig?.smtp_host && emailConfig?.enabled;

  return (
    <div className="mailing-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mailing-panel">
        {/* Header */}
        <div className="mailing-header">
          <div className="mailing-header-left">
            <Mail size={20} />
            <h2>Mailing</h2>
          </div>
          <button className="mailing-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="mailing-tabs">
          {[
            { id: 'compose', icon: Send, label: 'Composer' },
            { id: 'templates', icon: FileText, label: 'Templates' },
            { id: 'history', icon: Clock, label: 'Historique' },
            { id: 'config', icon: Settings, label: 'Config SMTP' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`mailing-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="mailing-content">
          {loading && <div className="mailing-loading">Chargement...</div>}

          {/* ═══ COMPOSER ═══ */}
          {activeTab === 'compose' && !loading && (
            <div className="mailing-compose">
              {!smtpConfigured && (
                <div className="mailing-alert">
                  <AlertTriangle size={16} />
                  <span>SMTP non configuré. Allez dans Config SMTP.</span>
                </div>
              )}

              {/* Template selector */}
              <div className="mailing-form-group">
                <label>Template (optionnel) :</label>
                <select
                  value={selectedTemplate?.id || ''}
                  onChange={(e) => {
                    const tpl = templates.find(t => t.id === Number(e.target.value));
                    if (tpl) handleSelectTemplate(tpl);
                    else resetCompose();
                  }}
                >
                  <option value="">— Sans template —</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* Destinataires */}
              <div className="mailing-form-group">
                <label>Destinataires :</label>
                <div className="mailing-recipients">
                  {selectedRecipients.map(email => (
                    <span key={email} className="mailing-recipient-tag">
                      {email}
                      <button onClick={() => removeRecipient(email)}>×</button>
                    </span>
                  ))}
                </div>
                <div className="mailing-add-recipient">
                  <input
                    type="email"
                    placeholder="Ajouter un email..."
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && manualEmail) {
                        addRecipient(manualEmail);
                        setManualEmail('');
                      }
                    }}
                  />
                  <button
                    onClick={() => { addRecipient(manualEmail); setManualEmail(''); }}
                    disabled={!manualEmail}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Contacts rapides */}
                {contacts.length > 0 && (
                  <div className="mailing-contacts-dropdown">
                    <div className="mailing-contacts-search">
                      <Search size={13} />
                      <input
                        placeholder="Rechercher un contact..."
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                    </div>
                    <div className="mailing-contacts-list">
                      {filteredContacts.slice(0, 10).map(c => (
                        <button
                          key={`${c.type}-${c.id}`}
                          className="mailing-contact-item"
                          onClick={() => addRecipient(c.email)}
                          disabled={selectedRecipients.includes(c.email)}
                        >
                          <span className="mailing-contact-name">{c.name}</span>
                          <span className="mailing-contact-email">{c.email}</span>
                          <span className={`mailing-contact-type type-${c.type}`}>{c.type}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sujet */}
              <div className="mailing-form-group">
                <label>Sujet :</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  placeholder="Sujet de l'email..."
                />
              </div>

              {/* Variables */}
              {Object.keys(composeVars).length > 0 && (
                <div className="mailing-form-group">
                  <label>Variables :</label>
                  <div className="mailing-vars-grid">
                    {Object.entries(composeVars).map(([key, val]) => (
                      <div key={key} className="mailing-var-field">
                        <span className="mailing-var-key">{`{{${key}}}`}</span>
                        <input
                          type="text"
                          value={val}
                          onChange={(e) => setComposeVars(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={AVAILABLE_VARS.find(v => v.key === key)?.example || ''}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* HTML Body */}
              <div className="mailing-form-group">
                <label>Contenu HTML :</label>
                <textarea
                  value={composeHtml}
                  onChange={(e) => setComposeHtml(e.target.value)}
                  rows={10}
                  placeholder="<p>Votre contenu HTML...</p>"
                  className="mailing-html-editor"
                />
              </div>

              {/* Actions */}
              <div className="mailing-compose-actions">
                <button className="mailing-btn secondary" onClick={handlePreview}>
                  <Eye size={14} /> Prévisualiser
                </button>
                <button className="mailing-btn secondary" onClick={resetCompose}>
                  <RefreshCw size={14} /> Réinitialiser
                </button>
                <button
                  className="mailing-btn primary"
                  onClick={handleSend}
                  disabled={sending || selectedRecipients.length === 0 || !composeSubject.trim() || !smtpConfigured}
                >
                  <Send size={14} /> {sending ? 'Envoi...' : 'Envoyer'}
                </button>
              </div>

              {/* Résultat envoi */}
              {sendResult && (
                <div className={`mailing-send-result ${sendResult.results?.some(r => r.status === 'error') ? 'has-errors' : 'all-sent'}`}>
                  <p>{sendResult.message}</p>
                </div>
              )}

              {/* Preview modal */}
              {showPreview && (
                <div className="mailing-preview-overlay" onMouseDown={(e) => e.target === e.currentTarget && setShowPreview(false)}>
                  <div className="mailing-preview-modal" onClick={e => e.stopPropagation()}>
                    <div className="mailing-preview-header">
                      <h3>Prévisualisation</h3>
                      <button onClick={() => setShowPreview(false)}><X size={18} /></button>
                    </div>
                    <div className="mailing-preview-body" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ TEMPLATES ═══ */}
          {activeTab === 'templates' && !loading && (
            <div className="mailing-templates">
              <div className="mailing-templates-header">
                <h3>{templates.length} template{templates.length > 1 ? 's' : ''}</h3>
                <button className="mailing-btn primary" onClick={() => openTemplateEditor()}>
                  <Plus size={14} /> Nouveau
                </button>
              </div>

              {templates.length === 0 && !editingTemplate && (
                <div className="mailing-empty">
                  <FileText size={32} />
                  <p>Aucun template. Créez-en un !</p>
                </div>
              )}

              {!editingTemplate && templates.map(tpl => (
                <div key={tpl.id} className="mailing-template-card">
                  <div className="mailing-tpl-info">
                    <span className="mailing-tpl-name">{tpl.name}</span>
                    <span className="mailing-tpl-subject">{tpl.subject || '(sans sujet)'}</span>
                    <span className={`mailing-tpl-cat cat-${tpl.category}`}>
                      {TEMPLATE_CATEGORIES.find(c => c.value === tpl.category)?.label || tpl.category}
                    </span>
                  </div>
                  <div className="mailing-tpl-actions">
                    <button onClick={() => openTemplateEditor(tpl)} title="Modifier"><Edit3 size={14} /></button>
                    <button onClick={() => {
                      handleSelectTemplate(tpl);
                      setActiveTab('compose');
                    }} title="Utiliser"><Send size={14} /></button>
                    <button onClick={() => deleteTemplate(tpl.id)} title="Supprimer" className="danger"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}

              {/* Template editor */}
              {editingTemplate && (
                <div className="mailing-tpl-editor">
                  <h3>{editingTemplate.id ? 'Modifier' : 'Nouveau'} template</h3>

                  <div className="mailing-form-group">
                    <label>Nom :</label>
                    <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="Nom du template" />
                  </div>

                  <div className="mailing-form-group">
                    <label>Catégorie :</label>
                    <select value={tplCategory} onChange={e => setTplCategory(e.target.value)}>
                      {TEMPLATE_CATEGORIES.map(c => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="mailing-form-group">
                    <label>Sujet :</label>
                    <input value={tplSubject} onChange={e => setTplSubject(e.target.value)} placeholder="Sujet de l'email" />
                  </div>

                  <div className="mailing-form-group">
                    <label>Variables disponibles :</label>
                    <div className="mailing-vars-insert">
                      {AVAILABLE_VARS.map(v => (
                        <button
                          key={v.key}
                          className="mailing-var-btn"
                          onClick={() => insertVariable(v.key)}
                          title={v.label}
                        >
                          {`{{${v.key}}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="mailing-form-group">
                    <label>Contenu HTML :</label>
                    <textarea
                      value={tplHtml}
                      onChange={e => setTplHtml(e.target.value)}
                      rows={14}
                      className="mailing-html-editor"
                    />
                  </div>

                  <div className="mailing-tpl-editor-actions">
                    <button className="mailing-btn secondary" onClick={() => setEditingTemplate(null)}>Annuler</button>
                    <button className="mailing-btn primary" onClick={saveTemplate} disabled={savingTpl || !tplName.trim()}>
                      <Check size={14} /> {savingTpl ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ HISTORIQUE ═══ */}
          {activeTab === 'history' && !loading && (
            <div className="mailing-history">
              <div className="mailing-history-header">
                <h3>{historyTotal} envoi{historyTotal > 1 ? 's' : ''}</h3>
                <button className="mailing-btn secondary" onClick={loadData}>
                  <RefreshCw size={14} /> Actualiser
                </button>
              </div>

              {history.length === 0 && (
                <div className="mailing-empty">
                  <Clock size={32} />
                  <p>Aucun email envoyé.</p>
                </div>
              )}

              {history.map(h => (
                <div key={h.id} className={`mailing-history-item ${h.status}`}>
                  <div className="mailing-hist-main">
                    <span className={`mailing-hist-status status-${h.status}`}>
                      {h.status === 'sent' ? '✅' : '❌'}
                    </span>
                    <div className="mailing-hist-info">
                      <span className="mailing-hist-subject">{h.subject}</span>
                      <span className="mailing-hist-to">→ {h.recipients}</span>
                    </div>
                  </div>
                  <div className="mailing-hist-meta">
                    <span>{h.sent_by_name || '—'}</span>
                    <span>{new Date(h.sent_at).toLocaleString('fr-FR')}</span>
                    {h.template_name && <span className="mailing-hist-tpl">📄 {h.template_name}</span>}
                  </div>
                  {h.error_message && (
                    <div className="mailing-hist-error">{h.error_message}</div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ═══ CONFIG SMTP ═══ */}
          {activeTab === 'config' && !loading && (
            <div className="mailing-config">
              <h3>Configuration SMTP</h3>

              <div className="mailing-form-group">
                <label className="mailing-toggle-label">
                  <input
                    type="checkbox"
                    checked={configForm.enabled || false}
                    onChange={e => setConfigForm(prev => ({ ...prev, enabled: e.target.checked }))}
                  />
                  Envoi d'emails activé
                </label>
              </div>

              <div className="mailing-config-grid">
                <div className="mailing-form-group">
                  <label>Hôte SMTP :</label>
                  <input value={configForm.smtp_host || ''} onChange={e => setConfigForm(prev => ({ ...prev, smtp_host: e.target.value }))} placeholder="smtp.example.com" />
                </div>
                <div className="mailing-form-group">
                  <label>Port :</label>
                  <input type="number" value={configForm.smtp_port || 587} onChange={e => setConfigForm(prev => ({ ...prev, smtp_port: Number(e.target.value) }))} />
                </div>
                <div className="mailing-form-group">
                  <label>Utilisateur SMTP :</label>
                  <input value={configForm.smtp_user || ''} onChange={e => setConfigForm(prev => ({ ...prev, smtp_user: e.target.value }))} placeholder="user@example.com" />
                </div>
                <div className="mailing-form-group">
                  <label>Mot de passe :</label>
                  <input type="password" value={configForm.smtp_pass || ''} onChange={e => setConfigForm(prev => ({ ...prev, smtp_pass: e.target.value }))} placeholder="••••••••" />
                </div>
                <div className="mailing-form-group">
                  <label>Nom expéditeur :</label>
                  <input value={configForm.from_name || ''} onChange={e => setConfigForm(prev => ({ ...prev, from_name: e.target.value }))} placeholder="eM@g" />
                </div>
              </div>

              <div className="mailing-form-group">
                <label className="mailing-toggle-label">
                  <input
                    type="checkbox"
                    checked={configForm.smtp_secure || false}
                    onChange={e => setConfigForm(prev => ({ ...prev, smtp_secure: e.target.checked }))}
                  />
                  Connexion sécurisée (SSL/TLS)
                </label>
              </div>

              <h4>Alertes automatiques</h4>
              {[
                { key: 'alert_access_request', label: "Nouvelle demande d'accès" },
                { key: 'alert_reservation', label: 'Nouvelle réservation véhicule' },
                { key: 'alert_assignment', label: 'Nouvelle affectation personnel' },
                { key: 'alert_overdue', label: 'Intervention en retard' },
                { key: 'alert_leave', label: 'Demande de congé (création + décision)' },
                { key: 'alert_sav', label: 'Nouveau ticket SAV' },
                { key: 'alert_maintenance', label: 'Maintenance / Contrôle technique' },
              ].map(alert => (
                <div key={alert.key} className="mailing-form-group">
                  <label className="mailing-toggle-label">
                    <input
                      type="checkbox"
                      checked={configForm[alert.key] || false}
                      onChange={e => setConfigForm(prev => ({ ...prev, [alert.key]: e.target.checked }))}
                    />
                    {alert.label}
                  </label>
                </div>
              ))}

              <div className="mailing-config-actions">
                <button className="mailing-btn secondary" onClick={testConfig}>
                  <Send size={14} /> Test SMTP
                </button>
                <button className="mailing-btn primary" onClick={saveConfig} disabled={savingConfig}>
                  <Check size={14} /> {savingConfig ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>

              {configTestResult && (
                <div className={`mailing-config-result ${configTestResult.success ? 'success' : 'error'}`}>
                  {configTestResult.success ? <Check size={14} /> : <AlertTriangle size={14} />}
                  {configTestResult.message}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
