import './MobileMessaging.css';

import { format, isToday, isYesterday } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  ArrowLeft,
  Download,
  File,
  Image,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button, Input, ModalLayout, Spinner } from '@/design-system';

import { AVATAR_COLORS } from '../../constants/colors';
import usePullToRefresh from '../../hooks/usePullToRefresh';
import api, { getApiUrl } from '../../utils/api';
import PullToRefreshIndicator from './PullToRefreshIndicator';

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
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

const getAvatarColor = (name) => {
  if (!name) return 'var(--theme-text-muted)';
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const formatFileSize = (bytes) => {
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' Ko';
  return (bytes / 1048576).toFixed(1) + ' Mo';
};

function MobileMessaging({ currentUser, onBack }) {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewConv, setShowNewConv] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [sseReady, setSseReady] = useState(false);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollRef = useRef(null);
  const sseRef = useRef(null);
  const activeConversationRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.getConversations({ limit: 30, includeParticipants: false });
      setConversations(data);
    } catch (err) {
      console.error('Erreur chargement conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (convId) => {
    try {
      const data = await api.getMessages(convId);
      setMessages(data);
      await api.markConversationRead(convId);
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, unread_count: 0 } : c)),
      );
    } catch (err) {
      console.error('Erreur chargement messages:', err);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const { containerProps: ptrProps, indicatorNode: ptrIndicator } = usePullToRefresh(
    loadConversations,
    { disabled: !!activeConversation },
  );

  // SSE temps réel (rafraîchit la conversation active et la liste)
  useEffect(() => {
    let reconnectTimer = null;
    let retries = 0;
    let closed = false;

    const closeSource = () => {
      if (sseRef.current) {
        sseRef.current.close();
        sseRef.current = null;
      }
    };

    const connect = () => {
      if (closed) return;
      closeSource();

      const es = new EventSource('/api/messaging/sse', { withCredentials: true });
      sseRef.current = es;

      es.onopen = () => {
        retries = 0;
        setSseReady(true);
      };

      es.addEventListener('new_message', async (e) => {
        try {
          const data = JSON.parse(e.data);
          await loadConversations();
          const currentConv = activeConversationRef.current;
          if (currentConv && Number(data?.conversation_id) === Number(currentConv.id)) {
            await loadMessages(currentConv.id);
          }
        } catch {
          // silencieux
        }
      });

      es.addEventListener('unread_update', () => {
        loadConversations().catch(() => {
          // silencieux
        });
      });

      es.onerror = () => {
        setSseReady(false);
        closeSource();
        if (closed) return;
        retries += 1;
        const delay = Math.min(retries * 2000, 30000);
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      setSseReady(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      closeSource();
    };
  }, [loadConversations, loadMessages]);

  // Fallback polling lent si SSE indisponible
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (sseReady) {
      return undefined;
    }

    pollRef.current = setInterval(() => {
      loadConversations().catch(() => {
        // silencieux
      });
      if (activeConversation) {
        loadMessages(activeConversation.id).catch(() => {
          // silencieux
        });
      }
    }, 30000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [activeConversation, loadConversations, loadMessages, sseReady]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getConversationName = (conv) => {
    if (conv.display_name) return conv.display_name;
    if (conv.title) return conv.title;
    if (conv.type === 'direct' && conv.participants) {
      const other = conv.participants.find((p) => p.id !== currentUser?.id);
      return other?.name || 'Conversation';
    }
    return conv.participants?.map((p) => p.name).join(', ') || 'Conversation';
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeConversation) return;
    const text = inputText.trim();
    setInputText('');

    try {
      const msg = await api.sendMessage(activeConversation.id, text);
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConversation.id
            ? {
                ...c,
                last_message: text,
                last_message_at: msg.created_at,
                last_message_sender: currentUser?.name,
              }
            : c,
        ),
      );
    } catch (err) {
      console.error('Erreur envoi message:', err);
    }
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversation) return;
    e.target.value = '';

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_FILE_SIZE) {
      window.alert('Le fichier dépasse la taille maximale autorisée (10 Mo)');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result.split(',')[1];
        const msg = await api.sendFileMessage(activeConversation.id, file.name, base64, file.type);
        setMessages((prev) => [...prev, msg]);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erreur envoi fichier:', err);
    }
  };

  const handleNewConversation = async () => {
    if (!selectedUserId) return;
    try {
      const result = await api.createConversation('direct', null, [selectedUserId]);
      setShowNewConv(false);
      setSelectedUserId(null);
      await loadConversations();
      const conv = (await api.getConversations()).find((c) => c.id === result.id);
      if (conv) {
        setActiveConversation(conv);
        await loadMessages(conv.id);
      }
    } catch (err) {
      console.error('Erreur création conversation:', err);
    }
  };

  const openNewConvModal = async () => {
    try {
      const users = await api.request('/users/names');
      setAllUsers(users.filter((u) => u.id !== currentUser?.id));
      setShowNewConv(true);
    } catch (err) {
      console.error('Erreur chargement utilisateurs:', err);
    }
  };

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

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  // Vue Chat
  if (activeConversation) {
    return (
      <div className="mobile-messaging-chat">
        <div className="mmsg-chat-header">
          <Button
            variant="ghost"
            className="mmsg-back"
            onClick={() => {
              setActiveConversation(null);
              setMessages([]);
            }}
            aria-label="Retour aux conversations"
          >
            <ArrowLeft size={20} />
          </Button>
          <div
            className="mmsg-chat-avatar"
            style={{ background: getAvatarColor(getConversationName(activeConversation)) }}
          >
            {activeConversation.type === 'group' ? (
              <Users size={14} />
            ) : (
              getInitials(getConversationName(activeConversation))
            )}
          </div>
          <span className="mmsg-chat-name">{getConversationName(activeConversation)}</span>
        </div>

        <div className="mmsg-messages">
          {messagesWithDates().map((item, i) => {
            if (item.type === 'date') {
              return (
                <div key={`date-${i}`} className="mmsg-date-sep">
                  <span>{formatDateSeparator(item.date)}</span>
                </div>
              );
            }

            const isSent = item.sender_id === currentUser?.id;

            return (
              <div key={item.id} className={`mmsg-bubble-wrap ${isSent ? 'sent' : 'received'}`}>
                {!isSent && <span className="mmsg-sender">{item.sender_name}</span>}
                <div className="mmsg-bubble">
                  {item.type === 'text' && item.content}
                  {item.type === 'image' && item.attachments?.[0] && (
                    <img
                      src={`${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`}
                      alt={item.attachments[0].original_name}
                      loading="lazy"
                      className="mmsg-img"
                      onClick={() =>
                        window.open(
                          `${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`,
                          '_blank',
                        )
                      }
                    />
                  )}
                  {(item.type === 'file' || item.type === 'video') && item.attachments?.[0] && (
                    <a
                      href={`${API_BASE_URL.replace('/api', '')}/messaging-uploads/${item.attachments[0].filename}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mmsg-file-link"
                    >
                      {item.type === 'video' ? <Image size={14} /> : <File size={14} />}
                      <span>{item.attachments[0].original_name}</span>
                      <span className="mmsg-file-size">
                        {formatFileSize(item.attachments[0].size)}
                      </span>
                      <Download size={12} />
                    </a>
                  )}
                </div>
                <span className="mmsg-time">{formatMsgTime(item.created_at)}</span>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="mmsg-input-area">
          <Button
            variant="ghost"
            className="mmsg-attach"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Joindre un fichier"
          >
            <Paperclip size={20} />
          </Button>
          <input ref={fileInputRef} type="file" hidden onChange={handleFileSelect} accept="*/*" />
          <Input
            className="mmsg-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Écrire un message…"
          />
          <Button
            variant="ghost"
            className="mmsg-send"
            onClick={handleSend}
            disabled={!inputText.trim()}
            aria-label="Envoyer"
          >
            <Send size={18} />
          </Button>
        </div>
      </div>
    );
  }

  // Vue Liste des conversations
  return (
    <div className="mobile-messaging" {...ptrProps}>
      <PullToRefreshIndicator indicator={ptrIndicator} />
      <div className="mmsg-header">
        <Button variant="ghost" className="mmsg-back" onClick={onBack} aria-label="Retour">
          <ArrowLeft size={20} />
        </Button>
        <h2>
          Messages {totalUnread > 0 && <span className="mmsg-total-badge">{totalUnread}</span>}
        </h2>
        <Button
          variant="ghost"
          className="mmsg-new-btn"
          onClick={openNewConvModal}
          aria-label="Nouvelle conversation"
        >
          <Plus size={20} />
        </Button>
      </div>

      {loading ? (
        <div className="mmsg-loading">
          <Spinner size="lg" />
          <p>Chargement...</p>
        </div>
      ) : conversations.length === 0 ? (
        <div className="mmsg-empty">
          <MessageSquare size={48} />
          <p>Aucune conversation</p>
          <Button variant="ghost" className="mmsg-start-btn" onClick={openNewConvModal}>
            Nouveau message
          </Button>
        </div>
      ) : (
        <div className="mmsg-conv-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`mmsg-conv-item ${conv.unread_count > 0 ? 'unread' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                setActiveConversation(conv);
                loadMessages(conv.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveConversation(conv);
                  loadMessages(conv.id);
                }
              }}
            >
              <div
                className="mmsg-conv-avatar"
                style={{ background: getAvatarColor(getConversationName(conv)) }}
              >
                {conv.type === 'group' ? (
                  <Users size={16} />
                ) : (
                  getInitials(getConversationName(conv))
                )}
              </div>
              <div className="mmsg-conv-info">
                <div className="mmsg-conv-top">
                  <span className="mmsg-conv-name">{getConversationName(conv)}</span>
                  <span className="mmsg-conv-time">{formatConvTime(conv.last_message_at)}</span>
                </div>
                <div className="mmsg-conv-bottom">
                  <span className="mmsg-conv-last">
                    {conv.last_message_sender &&
                    conv.last_message_sender !== getConversationName(conv)
                      ? `${conv.last_message_sender.split(' ')[0]}: `
                      : ''}
                    {conv.last_message || 'Nouvelle conversation'}
                  </span>
                  {conv.unread_count > 0 && (
                    <span className="mmsg-badge">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal nouvelle conversation */}
      {showNewConv && (
        <ModalLayout
          open
          onClose={() => setShowNewConv(false)}
          title="Nouveau message"
          icon={<MessageSquare size={20} />}
          size="sm"
          footer={
            <>
              <Button
                variant="ghost"
                className="mmsg-cancel"
                onClick={() => {
                  setShowNewConv(false);
                  setSelectedUserId(null);
                }}
              >
                Annuler
              </Button>
              <Button
                variant="ghost"
                className="mmsg-confirm"
                onClick={handleNewConversation}
                disabled={!selectedUserId}
              >
                Démarrer
              </Button>
            </>
          }
        >
          <div className="mmsg-user-list">
            {allUsers.map((user) => (
              <div
                key={user.id}
                className={`mmsg-user-item ${selectedUserId === user.id ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedUserId(user.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedUserId(user.id);
                  }
                }}
              >
                <div className="mmsg-user-avatar" style={{ background: getAvatarColor(user.name) }}>
                  {getInitials(user.name)}
                </div>
                <span>{user.name}</span>
              </div>
            ))}
            {allUsers.length === 0 && <p className="mmsg-no-users">Aucun autre utilisateur</p>}
          </div>
        </ModalLayout>
      )}
    </div>
  );
}

export default MobileMessaging;
