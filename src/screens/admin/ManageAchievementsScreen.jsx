import { useEffect, useState, useMemo } from 'react';
import { Trophy, Image as ImageIcon, CheckCircle2, Award } from 'lucide-react';
import { AchievementsService } from '../../services/achievements';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia, buildFolder } from '../../lib/mediaUpload';
import { AppSearchBar, AppListItem, AppFAB, AppModal, AppInput, AppButton, AppBadge, AppSkeleton, AppEmptyState, AppSection } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const EMPTY_ACHIEVEMENT = { title: '', year: '', description: '', images: [], order: 0 };

export default function ManageAchievementsScreen() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_ACHIEVEMENT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = AchievementsService.subscribeToAchievements((data) => {
      setItems(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((t) => t.title?.toLowerCase().includes(q) || t.year?.toString().includes(q));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_ACHIEVEMENT);
    setEditingId(null);
    setModalVisible(true);
  };
  const openEditModal = (item) => {
    setFormData({ title: item.title || '', description: item.description || '', year: item.year || '', images: item.images || [], order: item.order || 0 });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) =>
    alertConfirm({ title: 'Confirm Deletion', message: `Permanently delete "${item.title}"?`, onConfirm: () => AchievementsService.deleteAchievement(item) });

  const handlePickImage = async () => {
    if (!formData.title) {
      toast.error('Please enter an achievement title first.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: buildFolder('achievements', formData.title) });
      if (result.canceled) return;
      if (result.ok) setFormData((prev) => ({ ...prev, images: [result.url] }));
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.images?.length) {
      toast.error('Achievement Title and at least one Showcase Image are required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      if (editingId) {
        const oldItem = items.find((e) => e.id === editingId);
        await AchievementsService.updateAchievement(editingId, oldItem, dataToSave, user?.email);
      } else {
        await AchievementsService.addAchievement(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch {
      toast.error('Failed to save achievement details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="Manage Achievements">
      <AppSearchBar placeholder="Search achievements by title or year..." value={searchQuery} onChangeText={setSearchQuery} />

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={84} />
          <AppSkeleton width="100%" height={84} />
        </div>
      ) : filteredItems.length === 0 ? (
        <AppEmptyState
          title="No achievements recorded"
          description={searchQuery ? 'No results matched your search query.' : 'Document your competition milestones, awards, and records.'}
          actionLabel={searchQuery ? undefined : 'Record Achievement'}
          onAction={searchQuery ? undefined : openAddModal}
        />
      ) : (
        filteredItems.map((item) => {
          const hasImage = item.images && item.images.length > 0;
          return (
            <AppListItem
              key={item.id}
              title={item.title || 'Untitled Achievement'}
              description={`${item.description || 'No description provided'} • Order #${item.order}`}
              leftIcon={
                hasImage ? (
                  <img className="thumb" src={item.images[0]} alt="" style={{ width: 44, height: 44 }} />
                ) : (
                  <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-muted)' }}>
                    <Trophy size={20} color="#268BD2" />
                  </div>
                )
              }
              rightElement={<AppBadge variant="primary">{item.year || 'N/A'}</AppBadge>}
              onClick={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            />
          );
        })
      )}

      <AppFAB label="New Award" onClick={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Achievement Record' : 'Record New Achievement'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Achievement
            </AppButton>
          </div>
        }
      >
        <AppInput label="Award / Milestone Title" value={formData.title} onChangeText={(t) => setFormData({ ...formData, title: t })} placeholder="e.g. 1st Place Autonomous Navigation" />
        <AppInput label="Competition Year" value={formData.year} onChangeText={(t) => setFormData({ ...formData, year: t })} placeholder="e.g. 2025" />
        <AppInput label="Display Priority Order" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="0" />
        <AppInput label="Description & Context" value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="Details about the competition" multiline numberOfLines={3} />

        <AppSection title="Award Photograph" style={{ marginTop: 18 }}>
          <div className="upload-tile" style={{ marginBottom: 12 }}>
            {formData.images?.length ? <img src={formData.images[0]} alt="" /> : (<><Award size={32} /><span className="t-caption">No award photo uploaded yet.</span></>)}
          </div>
          {formData.images?.length > 0 && (
            <div className="meta-line" style={{ color: '#859900', marginBottom: 12 }}>
              <CheckCircle2 size={14} /> Uploaded to Cloud Storage
            </div>
          )}
          <AppButton variant="secondary" onClick={handlePickImage} loading={isSaving} disabled={isSaving} fullWidth icon={<ImageIcon size={16} />}>
            {formData.images?.length ? 'Replace Photograph' : 'Upload Award Photo'}
          </AppButton>
        </AppSection>
      </AppModal>
    </Screen>
  );
}
