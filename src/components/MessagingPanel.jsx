import { useState, useEffect, useRef, useCallback } from 'react';
import { X, MessageSquare, Send, Paperclip, ArrowLeft, Plus, File, Image, Download, Users } from 'lucide-react';
import api, { getApiUrl } from '../utils/api';
import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import './MessagingPanel.css';

const API_BASE_URL = getApiUrl();

const formatMsgTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier ' + format(d, 'HH:mm');
  return format(d, 'dd/MM HH:mm');
};

const formatConvTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Hier';
  return format(d, 'dd/MM', { locale: fr });
};

const formatDateSeparator = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  if (isToday(d)) return "Aujourd'hui";
  if (isYesterday(d)) return 'Hier';
  return format(d, 'EEEE d MMMM', { locale: fr });
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
};

const MessagingPanel = ({ isOpen, onClose, currentUser }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewConv, setShowNewConv] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const pollRef = useRef(null);

  // Charger les conversations
  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
    }
  }, []);

  // Charger les messages d'une conversation
  const loadMessages = useCallback(async (convId) => {
    try {
      const data = await api.getMessages(convId);
      setMessages(data);
      // Marquer comme lu
      await api.markConversationRead(convId);
      // Mettre à jour le compteur de la conversation
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, unread_count: 0 } : c
      ));
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  }, []);

  // Ouvrir quand isOpen change
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    } else {
      setActiveConversation(null);
      setMessages([]);
    }
  }, [isOpen, loadConversations]);

  // Polling pour nouveaux messages (toutes les 5s)
  useEffect(() => {
    if (!isOpen) return;
    pollRef.current = setInterval(() => {
      if (activeConversation) {
        loadMessages(activeConversation.id);
      }
      loadConversations();
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [isOpen, activeConversation, loadMessages, loadConversations]);

  // Scroll auto en bas quand nouveaux messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Obtenir le nom de la conversation
  const getConversationName = (conv) => {
    if (conv.title) return conv.title;
    if (conv.type === 'direct' && conv.participants) {
      const other = conv.participants.find(p => p.id !== currentUser?.id);
      return other?.name || 'Conversation';
    }
    return conv.participants?.map(p => p.name).join(', ') || 'Conversation';
  };

  // Envoyer un message
  const handleSend = async () => {
    if (!inputText.trim() || !activeConversation) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const msg = await api.sendMessage(activeConversation.id, text);
      setMessages(prev => [...prev, msg]);
      // Mettre à jour le last_message dans la liste
      setConversations(prev => prev.map(c =>
        c.id === activeConversation.id
          ? { ...c, last_message: text, last_message_at: msg.created_at, last_message_sender: currentUser?.name }
          : c
      ));
    } catch (err) {
      console.error('Erreur envoi message:', err);
    }
  };

  // Envoyer un fichier
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    e.target.value = '';

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const msg = await api.sendFileMessage(
          activeConversation.id,
          file.name,
          base64,
          file.type
        );
        setMessages(prev => [...prev, msg]);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erreur envoi fichier:', err);
    }
  };

  // Créer une nouvelle conversation
  const handleNewConversation = async () => {
    if (!selectedUserId) return;
    try {
      const result = await api.createConversation('direct', null, [selectedUserId]);
      setShowNewConv(false);
      setSelectedUserId(null);
      await loadConversations();
      // Ouvrir la conversation créée
      const conv = (await api.getConversations()).find(c => c.id === result.id);
      if (conv) {
        setActiveConversation(conv);
        await loadMessages(conv.id);
      }
    } catch (err) {
      console.error('Erreur création conversation:', err);
    }
  };

  // Charger les utilisateurs pour le modal de nouvelle conversation
  const openNewConvModal = async () => {
    try {
      const users = await api.request('/users');
      setAllUsers(users.filter(u => u.id !== currentUser?.id));
      setShowNewConv(true);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

  // Touche Entrée pour envoyer
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Insérer des séparateurs de date
  const messagesWithDates = () => {
    const result = [];
    let lastDate = null;
    for (const msg of messages) {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== lastDate) {
        result.push({ type: 'date', date: msg.created_at });
        lastDate = msgDate;
      }
      result.push({ type: 'message', ...msg });
    }
    return result;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="messaging-backdrop" onClick={onClose} />
      <div className={`messaging-panel ${isOpen ? 'open' : ''}`}>
        <div className="msg-header">
          <h3><MessageSquare size={18} /> Messages</h3>
          <div className="msg-header-actions">
            <button className="msg-header-btn" onClick={openNewConvModal} title="Nouveau message">
              <Plus size={16} />
            </button>
            <button className="msg-header-btn" onClick={onClose} title="Fermer">
              <X size={16} />
            </button>
          </div>
        </div>

        {!activeConversation ? (
          /* ═══ Liste des conversations ═══ */
          <div className="msg-conversation-list">
            {conversations.length === 0 ? (
              <div className="msg-empty">
                <MessageSquare size={40} className="msg-empty-icon" />
                <p>Aucune conversation</p>
                <p>Cliquez sur + pour démarrer</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.id}
                  className="msg-conv-item"
                  onClick={() => {
                    setActiveConversation(conv);
                    loadMessages(conv.id);
                  }}
                >
                  <div className="msg-conv-avatar">
                    {conv.type === 'group' ? <Users size={16} /> : getInitials(getConversationName(conv))}
                  </div>
                  <div className="msg-conv-info">
                    <div className="msg-conv-name">{getConversationName(conv)}</div>
                    <div className="msg-conv-last">
                      {conv.last_message_sender && conv.last_message_sender !== getConversationName(conv)
                        ? `${conv.last_message_sender.split(' ')[0]}: `
                        : ''}
                      {conv.last_message || 'Nouvelle conversation'}
                    </div>
                  </div>
                  <div className="msg-conv-meta">
                    <span className="msg-conv-time">{formatConvTime(conv.last_message_at)}</span>
                    {conv.unread_count > 0 && (
                      <span className="msg-unread-badge">{conv.unread_count > 9 ? '9+' : conv.unread_count}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* ═══ Vue chat ═══ */
          <div className="msg-chat-view">
            <div className="msg-chat-header">
              <button className="msg-back-btn" onClick={() => { setActiveConversation(null); setMessages([]); }}>
                <ArrowLeft size={18} />
              </button>
              <span className="msg-chat-title">{getConversationName(activeConversation)}</span>
            </div>

            <div className="msg-messages">
              {messagesWithDates().map((item, i) => {
                if (item.type === 'date') {
                  return (
                    <div key={`date-${i}`} className="msg-date-separator">
                      <span>{formatDateSeparator(item.date)}</span>
                    </div>
                  );
                }

                const isSent = item.sender_id === currentUser?.id;

                return (
                  <div key={item.id} className={`msg-bubble-wrapper ${isSent ? 'sent' : 'received'}`}>
                    {!isSent && <span className="msg-sender-name">{item.sender_name}</span>}
                    <div className="msg-bubble">
                      {item.type === 'text' && item.content}
                      {item.type === 'image' && item.attachments?.[0] && (
                        <>
                          <img
                            src={`${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`}
                            alt={item.attachments[0].original_name}
                            className="msg-image-preview"
                            onClick={() => window.open(`${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`, '_blank')}
                          />
                        </>
                      )}
                      {(item.type === 'file' || item.type === 'video') && item.attachments?.[0] && (
                        <a
                          href={`${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="msg-attachment"
                        >
                          {item.type === 'video' ? <Image size={14} /> : <File size={14} />}
                          <span className="msg-attachment-name">{item.attachments[0].original_name}</span>
                          <span className="msg-attachment-size">{formatFileSize(item.attachments[0].size)}</span>
                          <Download size={12} />
                        </a>
                      )}
                    </div>
                    <span className="msg-bubble-time">{formatMsgTime(item.created_at)}</span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            <div className="msg-input-area">
              <button className="msg-attach-btn" onClick={() => fileInputRef.current?.click()} title="Joindre un fichier">
                <Paperclip size={18} />
              </button>
              <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="*/*" />
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Écrire un message…"
                rows={1}
              />
              <button className="msg-send-btn" onClick={handleSend} disabled={!inputText.trim()} title="Envoyer">
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal nouvelle conversation */}
      {showNewConv && (
        <div className="msg-new-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowNewConv(false); }}>
          <div className="msg-new-modal">
            <h4>Nouveau message</h4>
            <div className="msg-user-list">
              {allUsers.map(user => (
                <div
                  key={user.id}
                  className={`msg-user-option ${selectedUserId === user.id ? 'selected' : ''}`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <div className="msg-user-option-avatar">{getInitials(user.name)}</div>
                  <span className="msg-user-option-name">{user.name}</span>
                </div>
              ))}
              {allUsers.length === 0 && <p className="msg-empty">Aucun autre utilisateur</p>}
            </div>
            <div className="msg-new-actions">
              <button className="msg-btn-cancel" onClick={() => { setShowNewConv(false); setSelectedUserId(null); }}>Annuler</button>
              <button className="msg-btn-start" onClick={handleNewConversation} disabled={!selectedUserId}>Démarrer</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MessagingPanel;
