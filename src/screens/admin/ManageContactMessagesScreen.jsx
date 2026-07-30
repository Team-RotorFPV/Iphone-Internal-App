import { useEffect, useState } from 'react';
import { Mail, MailOpen, Phone, Building2, Reply, Trash2, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { MessagesService } from '../../services/messages';
import { AppSearchBar, AppChip, AppCard, AppButton, AppBadge, AppSkeleton, AppEmptyState } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

export default function ManageContactMessagesScreen() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const unsub = MessagesService.subscribeToMessages((data) => {
      setMessages(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const handleToggleStatus = (msg) => {
    const newStatus = msg.status === 'unread' ? 'read' : 'unread';
    MessagesService.updateMessageStatus(msg.id, newStatus).catch(() => toast.error('Failed to update read status.'));
  };

  const handleDelete = (msg) => {
    alertConfirm({
      title: 'Delete Inquiry',
      message: `Permanently delete this message from "${msg.name || 'Anonymous'}"?`,
      onConfirm: () => MessagesService.deleteMessage(msg.id).catch(() => toast.error('Failed to delete message.')),
    });
  };

  const handleReply = (msg) => {
    window.location.href = `mailto:${msg.email}?subject=Re: [Team RotorFPV] ${msg.queryType || 'Inquiry Response'}`;
  };

  const filteredMessages = messages.filter((msg) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (msg.name?.toLowerCase() || '').includes(q) ||
      (msg.email?.toLowerCase() || '').includes(q) ||
      (msg.message?.toLowerCase() || '').includes(q) ||
      (msg.organization?.toLowerCase() || '').includes(q);
    if (filter === 'all') return matchesSearch;
    return matchesSearch && msg.status === filter;
  });

  return (
    <Screen title="Manage Messages">
      <AppSearchBar
        placeholder="Search inquiries by name, email, or content..."
        value={searchQuery}
        onChangeText={setSearchQuery}
      />
      <div className="chips-row">
        <AppChip label={`All (${messages.length})`} selected={filter === 'all'} onClick={() => setFilter('all')} />
        <AppChip label={`Unread (${messages.filter((m) => m.status === 'unread').length})`} selected={filter === 'unread'} onClick={() => setFilter('unread')} />
        <AppChip label={`Read (${messages.filter((m) => m.status === 'read').length})`} selected={filter === 'read'} onClick={() => setFilter('read')} />
      </div>

      {loading ? (
        <div className="stack gap-lg">
          <AppSkeleton width="100%" height={160} />
          <AppSkeleton width="100%" height={160} />
        </div>
      ) : filteredMessages.length === 0 ? (
        <AppEmptyState
          title={`No ${filter === 'all' ? '' : filter} inquiries found`}
          description={searchQuery ? 'No contact messages matched your search query.' : 'When sponsors, students, or partners contact the team through the website, messages appear here.'}
        />
      ) : (
        filteredMessages.map((item) => {
          const isUnread = item.status === 'unread';
          const formattedDate = item.createdAt?.toLocaleString ? item.createdAt.toLocaleString() : 'Recent';
          return (
            <AppCard key={item.id} variant={isUnread ? 'elevated' : 'surface'} style={isUnread ? { borderColor: 'rgba(38, 139, 210,0.5)' } : undefined}>
              <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 14 }}>
                <div className="row gap-md grow" style={{ marginRight: 12 }}>
                  <div className="icon-well" style={{ width: 40, height: 40, borderRadius: 12, background: isUnread ? '#268BD220' : '#D3368215' }}>
                    {isUnread ? <Mail size={18} color="#268BD2" /> : <MailOpen size={18} color="#D33682" />}
                  </div>
                  <div className="grow">
                    <div className="t-body" style={{ fontWeight: 600 }}>{item.name || 'Anonymous Inquiry'}</div>
                    <div className="t-caption">{item.email || 'No email provided'}</div>
                  </div>
                </div>
                <div className="stack gap-xs" style={{ alignItems: 'flex-end' }}>
                  <AppBadge variant={isUnread ? 'primary' : 'secondary'}>{isUnread ? 'NEW' : 'READ'}</AppBadge>
                  <span className="meta-line">
                    <Clock size={12} /> {formattedDate}
                  </span>
                </div>
              </div>

              <div className="wrap gap-sm" style={{ marginBottom: 14 }}>
                {item.queryType && (
                  <span className="badge" style={{ background: '#2AA19815', color: '#2AA198', borderColor: '#2AA19830' }}>
                    <MessageSquare size={12} style={{ marginRight: 6 }} /> {item.queryType.toUpperCase()}
                  </span>
                )}
                {item.phone && (
                  <span className="badge badge-secondary" style={{ textTransform: 'none' }}>
                    <Phone size={12} style={{ marginRight: 6 }} /> {item.phone}
                  </span>
                )}
                {item.organization && (
                  <span className="badge badge-secondary" style={{ textTransform: 'none' }}>
                    <Building2 size={12} style={{ marginRight: 6 }} /> {item.organization}
                  </span>
                )}
              </div>

              <div style={{ background: 'rgba(11,10,16,0.5)', padding: 10, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
                <p className="t-body" style={{ margin: 0 }}>{item.message || 'No message content provided.'}</p>
              </div>

              <div className="row gap-sm">
                <AppButton
                  variant={isUnread ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => handleToggleStatus(item)}
                  icon={isUnread ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                >
                  {isUnread ? 'Mark Read' : 'Unread'}
                </AppButton>
                <AppButton variant="primary" size="sm" onClick={() => handleReply(item)} style={{ flex: 1 }} icon={<Reply size={14} color="var(--bg)" />}>
                  Reply via Email
                </AppButton>
                <AppButton variant="danger" size="sm" onClick={() => handleDelete(item)} icon={<Trash2 size={16} color="#DC322F" />} />
              </div>
            </AppCard>
          );
        })
      )}
    </Screen>
  );
}
