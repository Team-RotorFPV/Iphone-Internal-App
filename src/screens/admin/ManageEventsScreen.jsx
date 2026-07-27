import { useEffect, useState } from 'react';
import { Calendar, Image as ImageIcon, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { EventsService } from '../../services/events';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia, buildFolder } from '../../lib/mediaUpload';
import { AppListItem, AppFAB, AppModal, AppInput, AppButton, AppBadge, AppToggle, AppSkeleton, AppEmptyState, AppSection, AppCard } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const EMPTY_EVENT = { name: '', description: '', longDescription: '', image: '', galleryImages: [], status: 'upcoming', order: 0, isActive: true };

export default function ManageEventsScreen() {
  const user = useAuthStore((s) => s.user);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_EVENT);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = EventsService.subscribeToEvents((data) => {
      setEvents(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_EVENT);
    setEditingId(null);
    setModalVisible(true);
  };
  const openEditModal = (item) => {
    setFormData({
      name: item.name || '',
      description: item.description || '',
      longDescription: item.longDescription || '',
      image: item.image || '',
      galleryImages: item.galleryImages || [],
      status: item.status || 'upcoming',
      order: item.order || 0,
      isActive: item.isActive !== false,
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) =>
    alertConfirm({ title: 'Confirm Delete', message: `Permanently delete "${item.name}"?`, onConfirm: () => EventsService.deleteEvent(item) });

  const handlePickImage = async () => {
    if (!formData.name) {
      toast.error('Please enter an event name first.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: buildFolder('events', formData.status, formData.name) });
      if (result.canceled) return;
      if (result.ok) setFormData((prev) => ({ ...prev, image: result.url }));
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.image) {
      toast.error('Event Name and Cover Image are required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      if (editingId) {
        const oldEvent = events.find((e) => e.id === editingId);
        await EventsService.updateEvent(editingId, oldEvent, dataToSave, user?.email);
      } else {
        await EventsService.addEvent(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch {
      toast.error('Failed to save event details');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="Manage Events">
      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={80} />
          <AppSkeleton width="100%" height={80} />
        </div>
      ) : events.length === 0 ? (
        <AppEmptyState title="No events scheduled" description="You haven't created any events for the website yet." actionLabel="Add First Event" onAction={openAddModal} />
      ) : (
        events.map((item) => {
          const badgeVariant = !item.isActive ? 'danger' : item.status === 'upcoming' ? 'success' : 'secondary';
          const statusLabel = !item.isActive ? 'Hidden' : (item.status || '').toUpperCase();
          return (
            <AppListItem
              key={item.id}
              title={item.name || 'Unnamed Event'}
              description={`${item.description || 'No description'} • Order #${item.order}`}
              leftIcon={
                item.image ? (
                  <img className="thumb" src={item.image} alt="" style={{ width: 44, height: 44 }} />
                ) : (
                  <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: '#38BDF815' }}>
                    <Calendar size={18} color="#38BDF8" />
                  </div>
                )
              }
              rightElement={<AppBadge variant={badgeVariant}>{statusLabel}</AppBadge>}
              onClick={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            />
          );
        })
      )}

      <AppFAB label="New Event" onClick={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Event Specification' : 'Create New Event'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Event
            </AppButton>
          </div>
        }
      >
        <AppInput label="Event Name" value={formData.name} onChangeText={(t) => setFormData({ ...formData, name: t })} placeholder="e.g. AUVSI SUAS 2026" />
        <AppInput label="Status" value={formData.status} onChangeText={(t) => setFormData({ ...formData, status: t })} placeholder="upcoming or past" />
        <AppInput label="Display Order (priority)" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="0" />
        <AppInput label="Short Summary" value={formData.description} onChangeText={(t) => setFormData({ ...formData, description: t })} placeholder="Brief overview" multiline numberOfLines={2} />
        <AppInput label="Detailed Description" value={formData.longDescription} onChangeText={(t) => setFormData({ ...formData, longDescription: t })} placeholder="Full event details" multiline numberOfLines={4} />

        <div className="row-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 16, borderRadius: 12, marginTop: 8 }}>
          <div className="grow" style={{ marginRight: 12 }}>
            <div className="row gap-xs">
              {formData.isActive ? <Eye size={16} color="#10B981" /> : <EyeOff size={16} color="#EF4444" />}
              <span className="t-body" style={{ fontWeight: 600 }}>Publicly Visible</span>
            </div>
            <div className="t-caption">When disabled, this event is hidden from the public website.</div>
          </div>
          <AppToggle value={formData.isActive} onValueChange={(v) => setFormData({ ...formData, isActive: v })} />
        </div>

        <AppSection title="Cover Banner" style={{ marginTop: 18 }}>
          <div className="upload-tile" style={{ marginBottom: 12 }}>
            {formData.image ? <img src={formData.image} alt="" /> : (<><ImageIcon size={32} /><span className="t-caption">No cover image uploaded yet.</span></>)}
          </div>
          {formData.image && (
            <div className="meta-line" style={{ color: '#10B981', marginBottom: 12 }}>
              <CheckCircle2 size={14} /> Uploaded to Cloud Storage
            </div>
          )}
          <AppButton variant="secondary" onClick={handlePickImage} loading={isSaving} disabled={isSaving} fullWidth icon={<ImageIcon size={16} />}>
            {formData.image ? 'Replace Cover Image' : 'Upload Cover Banner'}
          </AppButton>
        </AppSection>
      </AppModal>
    </Screen>
  );
}
