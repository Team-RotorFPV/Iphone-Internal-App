import { useEffect, useState } from 'react';
import { Image as ImageIcon, Edit2, Trash2, Sparkles, CheckCircle2, LayoutGrid, Hash } from 'lucide-react';
import { GalleryService } from '../../services/gallery';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia } from '../../lib/mediaUpload';
import { AppCard, AppFAB, AppModal, AppInput, AppButton, AppSkeleton, AppEmptyState, AppSection } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';
import './gallery.css';

const EMPTY_GALLERY = { img: '', order: 0, originalWidth: null, originalHeight: null };

export default function ManageGalleryScreen() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_GALLERY);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState({ heroImageUrl: '' });

  useEffect(() => {
    const unsubGallery = GalleryService.subscribeToGallery((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubSettings = GalleryService.subscribeToGallerySettings(setPageSettings);
    return () => {
      unsubGallery();
      unsubSettings();
    };
  }, []);

  const openAddModal = () => {
    setFormData(EMPTY_GALLERY);
    setEditingId(null);
    setModalVisible(true);
  };
  const openEditModal = (item) => {
    setFormData({ img: item.img || '', order: item.order || 0, originalWidth: item.originalWidth || null, originalHeight: item.originalHeight || null });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) =>
    alertConfirm({ title: 'Confirm Delete', message: 'Are you sure you want to permanently delete this gallery image?', onConfirm: () => GalleryService.deleteGalleryItem(item) });

  const handlePickImage = async () => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: 'gallery' });
      if (result.canceled) return;
      if (result.ok) setFormData((prev) => ({ ...prev, img: result.url, originalWidth: result.width || 600, originalHeight: result.height || 400 }));
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.img) {
      toast.error('An image upload is required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order), originalWidth: formData.originalWidth || 600, originalHeight: formData.originalHeight || 400 };
      if (editingId) {
        const oldItem = items.find((e) => e.id === editingId);
        await GalleryService.updateGalleryItem(editingId, oldItem, dataToSave, user?.email);
      } else {
        await GalleryService.addGalleryItem(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch {
      toast.error('Failed to save gallery item details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await GalleryService.updateGallerySettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      toast.success('Gallery page hero settings updated');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async () => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: 'gallery' });
      if (result.canceled) return;
      if (result.ok) setPageSettings({ heroImageUrl: result.url });
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="Manage Gallery">
      <AppCard variant="elevated">
        <div className="row-between" style={{ alignItems: 'flex-start' }}>
          <div className="grow" style={{ marginRight: 12 }}>
            <div className="row gap-xs" style={{ marginBottom: 4 }}>
              <Sparkles size={16} color="var(--accent)" />
              <span className="t-caption" style={{ color: 'var(--accent)', fontWeight: 700 }}>Website Header</span>
            </div>
            <div className="t-body" style={{ fontWeight: 600, fontSize: 18 }}>Gallery Hero Image</div>
            <div className="t-caption">Configure the main showcase banner at the top of the gallery page.</div>
          </div>
          <AppButton variant="secondary" size="sm" onClick={() => setSettingsModalVisible(true)} icon={<Edit2 size={14} />}>
            Configure
          </AppButton>
        </div>
        {pageSettings.heroImageUrl && <img className="thumb" src={pageSettings.heroImageUrl} alt="" style={{ width: '100%', height: 100, marginTop: 14 }} />}
      </AppCard>

      <div className="row gap-sm" style={{ marginBottom: 12 }}>
        <LayoutGrid size={18} color="#FF9800" />
        <span className="section-title" style={{ fontSize: 20 }}>Gallery Grid ({items.length})</span>
      </div>

      {loading ? (
        <div className="gallery-grid">
          <AppSkeleton width="100%" height={160} />
          <AppSkeleton width="100%" height={160} />
        </div>
      ) : items.length === 0 ? (
        <AppEmptyState
          title="No gallery images"
          description="Upload your team's action shots and drone photographs to showcase on the web."
          actionLabel="Add Gallery Image"
          onAction={openAddModal}
        />
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <button key={item.id} type="button" className="grid-card" onClick={() => openEditModal(item)}>
              {item.img ? <img src={item.img} alt="" /> : <div className="grid-placeholder"><ImageIcon size={28} color="var(--text-muted)" /></div>}
              <div className="grid-overlay">
                <span className="order-badge">
                  <Hash size={10} /> {item.order}
                </span>
                <span className="overlay-actions">
                  <span role="button" tabIndex={0} className="ov-btn" onClick={(e) => { e.stopPropagation(); openEditModal(item); }}>
                    <Edit2 size={14} color="#fff" />
                  </span>
                  <span role="button" tabIndex={0} className="ov-btn danger" onClick={(e) => { e.stopPropagation(); handleDelete(item); }}>
                    <Trash2 size={14} color="#F44336" />
                  </span>
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <AppFAB label="Add Image" onClick={openAddModal} />

      {/* Item Edit Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Gallery Image' : 'Upload Gallery Image'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>Save Image</AppButton>
          </div>
        }
      >
        <AppInput label="Display Order (priority)" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="0" />
        <AppSection title="Image File" style={{ marginTop: 16 }}>
          <div className="upload-tile" style={{ aspectRatio: 'auto', height: 180, marginBottom: 12 }}>
            {formData.img ? <img src={formData.img} alt="" /> : (<><ImageIcon size={32} /><span className="t-caption">No image selected yet.</span></>)}
          </div>
          {formData.img && (
            <div className="meta-line" style={{ color: '#66BB6A', marginBottom: 12 }}>
              <CheckCircle2 size={14} /> Uploaded ({formData.originalWidth}x{formData.originalHeight})
            </div>
          )}
          <AppButton variant="secondary" onClick={handlePickImage} loading={isSaving} disabled={isSaving} fullWidth icon={<ImageIcon size={16} />}>
            {formData.img ? 'Replace Image' : 'Select From Photo Library'}
          </AppButton>
        </AppSection>
      </AppModal>

      {/* Hero Settings Modal */}
      <AppModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        title="Gallery Page Hero Banner"
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setSettingsModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSaveSettings} style={{ flex: 1 }} loading={isSaving}>Update Banner</AppButton>
          </div>
        }
      >
        <p className="t-body-secondary" style={{ marginTop: 0, marginBottom: 16 }}>
          This image serves as the full-width header background for visitors browsing the gallery page.
        </p>
        <div className="upload-tile" style={{ aspectRatio: 'auto', height: 180, marginBottom: 12 }}>
          {pageSettings.heroImageUrl ? <img src={pageSettings.heroImageUrl} alt="" /> : (<><ImageIcon size={32} /><span className="t-caption">No hero banner configured.</span></>)}
        </div>
        <AppButton variant="secondary" onClick={handlePickSettingsImage} loading={isSaving} disabled={isSaving} fullWidth icon={<ImageIcon size={16} />}>
          {pageSettings.heroImageUrl ? 'Replace Hero Banner' : 'Upload Hero Banner'}
        </AppButton>
      </AppModal>
    </Screen>
  );
}
