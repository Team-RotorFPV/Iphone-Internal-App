import { useEffect, useState, useMemo } from 'react';
import {
  FaInstagram,
  FaYoutube,
  FaLinkedinIn,
  FaXTwitter,
  FaGithub,
  FaFacebook,
  FaWhatsapp,
  FaDiscord,
  FaTelegram,
  FaSpotify,
  FaTwitch,
  FaThreads,
} from 'react-icons/fa6';
import { Mail, Globe, Link as LinkIcon, Phone, MapPin, Music, ShoppingBag, FileText, Calendar, Users, Rss, Disc, ExternalLink } from 'lucide-react';
import { SocialsService } from '../../services/socials';
import { AppSearchBar, AppListItem, AppFAB, AppModal, AppInput, AppButton, AppBadge, AppToggle, AppSkeleton, AppEmptyState } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

// Icon key set — matches the native app + the website's SocialsTab so the
// stored `icon` key renders the same brand glyph everywhere.
const SOCIAL_ICONS = [
  { key: 'instagram', label: 'Instagram', Icon: FaInstagram },
  { key: 'youtube', label: 'YouTube', Icon: FaYoutube },
  { key: 'linkedin', label: 'LinkedIn', Icon: FaLinkedinIn },
  { key: 'twitter', label: 'Twitter / X', Icon: FaXTwitter },
  { key: 'github', label: 'GitHub', Icon: FaGithub },
  { key: 'facebook', label: 'Facebook', Icon: FaFacebook },
  { key: 'whatsapp', label: 'WhatsApp', Icon: FaWhatsapp },
  { key: 'discord', label: 'Discord', Icon: FaDiscord },
  { key: 'telegram', label: 'Telegram', Icon: FaTelegram },
  { key: 'spotify', label: 'Spotify', Icon: FaSpotify },
  { key: 'twitch', label: 'Twitch', Icon: FaTwitch },
  { key: 'threads', label: 'Threads', Icon: FaThreads },
  { key: 'mail', label: 'Email', Icon: Mail },
  { key: 'globe', label: 'Website', Icon: Globe },
  { key: 'link', label: 'Link', Icon: LinkIcon },
  { key: 'phone', label: 'Phone', Icon: Phone },
  { key: 'location', label: 'Location', Icon: MapPin },
  { key: 'music', label: 'Music', Icon: Music },
  { key: 'shop', label: 'Shop', Icon: ShoppingBag },
  { key: 'blog', label: 'Blog / Document', Icon: FileText },
  { key: 'calendar', label: 'Calendar', Icon: Calendar },
  { key: 'team', label: 'Team', Icon: Users },
  { key: 'rss', label: 'RSS', Icon: Rss },
  { key: 'podcast', label: 'Podcast', Icon: Disc },
  { key: 'external', label: 'External Link', Icon: ExternalLink },
];

const ICON_BY_KEY = Object.fromEntries(SOCIAL_ICONS.map((o) => [o.key, o]));

const SocialGlyph = ({ iconKey, size = 18, color }) => {
  const opt = ICON_BY_KEY[iconKey] || ICON_BY_KEY.link;
  const Icon = opt.Icon;
  return <Icon size={size} color={color} />;
};

const EMPTY_FORM = { title: '', url: '', icon: 'link', order: '10', enabled: true };

export default function ManageSocialsScreen() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = SocialsService.subscribeToSocials((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((s) => s.title?.toLowerCase().includes(q) || s.url?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_FORM);
    setEditingId(null);
    setModalVisible(true);
  };
  const openEditModal = (item) => {
    setFormData({
      title: item.title || '',
      url: item.url || '',
      icon: item.icon || 'link',
      order: String(item.order ?? 10),
      enabled: item.enabled !== false,
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) =>
    alertConfirm({ title: 'Delete Social Link', message: `Permanently delete "${item.title}"?`, onConfirm: () => SocialsService.deleteSocial(item) });

  const handleSave = async () => {
    const title = formData.title.trim();
    const url = formData.url.trim();
    if (!title || !url) {
      toast.error('Both a title and a URL are required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { title, url, icon: formData.icon, order: Number(formData.order) || 0, enabled: formData.enabled };
      if (editingId) await SocialsService.updateSocial(editingId, dataToSave);
      else await SocialsService.addSocial(dataToSave);
      setModalVisible(false);
    } catch {
      toast.error('Failed to save. You might not have permission.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="Manage Socials">
      <AppSearchBar placeholder="Search links by title or URL..." value={searchQuery} onChangeText={setSearchQuery} />

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={72} />
          <AppSkeleton width="100%" height={72} />
        </div>
      ) : filteredItems.length === 0 ? (
        <AppEmptyState
          title="No social links yet"
          description={searchQuery ? 'No results matched your search.' : 'Add links that appear on socials.teamrotorfpv.com and the website footer.'}
          actionLabel={searchQuery ? undefined : 'Add First Link'}
          onAction={searchQuery ? undefined : openAddModal}
        />
      ) : (
        filteredItems.map((item) => {
          const isHidden = item.enabled === false;
          return (
            <AppListItem
              key={item.id}
              title={item.title || 'Untitled'}
              description={item.url}
              style={isHidden ? { opacity: 0.55 } : undefined}
              leftIcon={
                <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-muted)', color: 'var(--accent)' }}>
                  <SocialGlyph iconKey={item.icon} size={20} color="var(--accent)" />
                </div>
              }
              rightElement={<AppBadge variant={isHidden ? 'warning' : 'primary'}>{isHidden ? 'Hidden' : `#${item.order ?? 0}`}</AppBadge>}
              onClick={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            />
          );
        })
      )}

      <AppFAB label="New Link" onClick={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Social Link' : 'Add Social Link'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>{editingId ? 'Update Link' : 'Add Link'}</AppButton>
          </div>
        }
      >
        <AppInput label="Title" value={formData.title} onChangeText={(t) => setFormData({ ...formData, title: t })} placeholder="e.g. Instagram" />
        <AppInput label="URL" value={formData.url} onChangeText={(t) => setFormData({ ...formData, url: t })} placeholder="https://instagram.com/teamrotorfpv" autoCapitalize="none" inputMode="url" />

        <div className="field-label" style={{ marginTop: 6 }}>Icon</div>
        <div className="icon-grid">
          {SOCIAL_ICONS.map((opt) => {
            const selected = formData.icon === opt.key;
            const Icon = opt.Icon;
            return (
              <button
                key={opt.key}
                type="button"
                className={`icon-tile${selected ? ' selected' : ''}`}
                onClick={() => setFormData({ ...formData, icon: opt.key })}
                aria-label={opt.label}
              >
                <Icon size={20} color={selected ? 'var(--accent)' : 'var(--text-secondary)'} />
              </button>
            );
          })}
        </div>
        <div className="t-caption muted" style={{ marginTop: 8 }}>{ICON_BY_KEY[formData.icon]?.label || 'Link'}</div>

        <AppInput label="Order (lower shows first)" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="10" containerStyle={{ marginTop: 16 }} />

        <div className="row-between" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <div className="grow" style={{ marginRight: 12 }}>
            <div className="t-body" style={{ fontWeight: 600 }}>Visible on link tree & footer</div>
            <div className="t-caption muted">Turn off to hide without deleting.</div>
          </div>
          <AppToggle value={formData.enabled} onValueChange={(v) => setFormData({ ...formData, enabled: v })} />
        </div>
      </AppModal>
    </Screen>
  );
}
