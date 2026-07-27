import { useEffect, useState, useMemo } from 'react';
import { Settings, Image as ImageIcon, FileText, Upload, CheckCircle2, Eye, EyeOff, DollarSign } from 'lucide-react';
import { SponsorsService } from '../../services/sponsors';
import { useAuthStore } from '../../stores/authStore';
import { pickAndUploadMedia, buildFolder } from '../../lib/mediaUpload';
import { AppSearchBar, AppListItem, AppFAB, AppModal, AppInput, AppButton, AppBadge, AppToggle, AppSkeleton, AppEmptyState, AppSection } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const EMPTY_SPONSOR = { name: '', website: '', logo: '', order: 0, isActive: true };
const DEFAULT_PAGE_SETTINGS = {
  title: 'Sponsor Us',
  description: '',
  teamImage: { url: '', publicId: '' },
  brochure: { url: '', publicId: '', name: '' },
  whySponsorUs: '',
};

export default function ManageSponsorsScreen() {
  const user = useAuthStore((s) => s.user);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_SPONSOR);
  const [isSaving, setIsSaving] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [pageSettings, setPageSettings] = useState(DEFAULT_PAGE_SETTINGS);

  useEffect(() => {
    const unsubSponsors = SponsorsService.subscribeToSponsors((data) => {
      setItems(data);
      setLoading(false);
    });
    const unsubSettings = SponsorsService.subscribeToSponsorSettings(setPageSettings);
    return () => {
      unsubSponsors();
      unsubSettings();
    };
  }, []);

  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((t) => t.name?.toLowerCase().includes(q));
  }, [items, searchQuery]);

  const openAddModal = () => {
    setFormData(EMPTY_SPONSOR);
    setEditingId(null);
    setModalVisible(true);
  };
  const openEditModal = (item) => {
    setFormData({ name: item.name || '', website: item.website || '', logo: item.logo || '', order: item.order || 0, isActive: item.isActive !== false });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) =>
    alertConfirm({ title: 'Remove Sponsor', message: `Remove "${item.name}" from the sponsor showcase?`, onConfirm: () => SponsorsService.deleteSponsor(item) });

  const handlePickImage = async () => {
    if (!formData.name) {
      toast.error('Please enter a sponsor name first.');
      return;
    }
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({ folder: buildFolder('sponsors', formData.name) });
      if (result.canceled) return;
      if (result.ok) setFormData((prev) => ({ ...prev, logo: result.url }));
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.logo) {
      toast.error('Sponsor Name and Logo are required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      if (editingId) {
        const oldItem = items.find((e) => e.id === editingId);
        await SponsorsService.updateSponsor(editingId, oldItem, dataToSave, user?.email);
      } else {
        await SponsorsService.addSponsor(dataToSave, user?.email);
      }
      setModalVisible(false);
    } catch {
      toast.error('Failed to save sponsor details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await SponsorsService.updateSponsorSettings(pageSettings, user?.email);
      setSettingsModalVisible(false);
      toast.success('Sponsor page updated successfully');
    } catch {
      toast.error('Failed to save sponsor page settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePickSettingsImage = async (type) => {
    setIsSaving(true);
    try {
      const result = await pickAndUploadMedia({
        folder: type === 'teamImage' ? 'sponsor-us/team-image' : 'sponsor-us',
        accept: type === 'brochure' ? '.pdf,image/*,video/*' : 'image/*',
      });
      if (result.canceled) return;
      if (!result.ok) {
        toast.error(result.error || 'Upload failed');
        return;
      }
      if (type === 'teamImage') {
        setPageSettings((prev) => ({ ...prev, teamImage: { url: result.url, publicId: result.publicId } }));
      } else {
        setPageSettings((prev) => ({ ...prev, brochure: { url: result.url, publicId: result.publicId, name: 'Sponsorship_Brochure.pdf' } }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const headerRight = (
    <AppButton variant="secondary" size="sm" icon={<Settings size={16} />} onClick={() => setSettingsModalVisible(true)}>
      Config
    </AppButton>
  );

  return (
    <Screen title="Manage Sponsors" headerRight={headerRight}>
      <AppSearchBar placeholder="Search sponsors by company name..." value={searchQuery} onChangeText={setSearchQuery} />

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={80} />
          <AppSkeleton width="100%" height={80} />
        </div>
      ) : filteredItems.length === 0 ? (
        <AppEmptyState
          title="No Sponsors Listed"
          description={searchQuery ? 'No sponsors matched your search criteria.' : 'Add corporate partners and sponsors to display on the public landing page.'}
          actionLabel={searchQuery ? undefined : 'Add First Sponsor'}
          onAction={searchQuery ? undefined : openAddModal}
        />
      ) : (
        filteredItems.map((item) => (
          <AppListItem
            key={item.id}
            title={item.name || 'Untitled Sponsor'}
            description={`${item.website || 'No website specified'} • Priority #${item.order}`}
            leftIcon={
              item.logo ? (
                <div className="icon-well" style={{ width: 52, height: 52, borderRadius: 12, background: '#fff', padding: 6 }}>
                  <img src={item.logo} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ) : (
                <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: '#10B98115' }}>
                  <DollarSign size={20} color="#10B981" />
                </div>
              )
            }
            rightElement={<AppBadge variant={item.isActive !== false ? 'success' : 'danger'}>{item.isActive !== false ? 'ACTIVE' : 'HIDDEN'}</AppBadge>}
            onClick={() => openEditModal(item)}
            onDelete={() => handleDelete(item)}
          />
        ))
      )}

      <AppFAB label="Add Partner" onClick={openAddModal} />

      {/* Sponsor Add/Edit Modal */}
      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Sponsor Profile' : 'Add Corporate Sponsor'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>Save Partner</AppButton>
          </div>
        }
      >
        <AppInput label="Company / Partner Name" value={formData.name} onChangeText={(t) => setFormData({ ...formData, name: t })} placeholder="e.g. Altium, BetaFPV" />
        <AppInput label="Website URL" value={formData.website} onChangeText={(t) => setFormData({ ...formData, website: t })} placeholder="https://www.sponsor.com" autoCapitalize="none" inputMode="url" />
        <AppInput label="Display Priority Order" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="0" />

        <div className="row-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 16, borderRadius: 12, marginTop: 8 }}>
          <div className="grow" style={{ marginRight: 12 }}>
            <div className="row gap-xs">
              {formData.isActive ? <Eye size={16} color="#10B981" /> : <EyeOff size={16} color="#EF4444" />}
              <span className="t-body" style={{ fontWeight: 600 }}>Showcase Status</span>
            </div>
            <div className="t-caption">If disabled, logo is hidden from the public website.</div>
          </div>
          <AppToggle value={formData.isActive} onValueChange={(v) => setFormData({ ...formData, isActive: v })} />
        </div>

        <AppSection title="Company Logo (.png / .svg / .jpg)" style={{ marginTop: 18 }}>
          <div className="upload-tile" style={{ aspectRatio: 'auto', height: 120, background: formData.logo ? '#fff' : 'var(--surface)', marginBottom: 12 }}>
            {formData.logo ? <img src={formData.logo} alt="" style={{ objectFit: 'contain', padding: 16 }} /> : (<><ImageIcon size={32} /><span className="t-caption">No partner logo uploaded yet.</span></>)}
          </div>
          {formData.logo && (
            <div className="meta-line" style={{ color: '#10B981', marginBottom: 12 }}>
              <CheckCircle2 size={14} /> Uploaded to Cloud Storage
            </div>
          )}
          <AppButton variant="secondary" onClick={handlePickImage} loading={isSaving} disabled={isSaving} fullWidth icon={<Upload size={16} />}>
            {formData.logo ? 'Replace Logo Asset' : 'Upload Logo Asset'}
          </AppButton>
        </AppSection>
      </AppModal>

      {/* Sponsor Page Settings Modal */}
      <AppModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        title="Sponsor Us Page Narrative"
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setSettingsModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSaveSettings} style={{ flex: 1 }} loading={isSaving}>Save Settings</AppButton>
          </div>
        }
      >
        <AppInput label="Page Intro & Description" value={pageSettings.description} onChangeText={(t) => setPageSettings({ ...pageSettings, description: t })} placeholder="Tell prospective sponsors..." multiline numberOfLines={4} />
        <AppInput label="Why Sponsor Us (Value Proposition)" value={pageSettings.whySponsorUs} onChangeText={(t) => setPageSettings({ ...pageSettings, whySponsorUs: t })} placeholder="Detail the recruitment access, branding..." multiline numberOfLines={5} />

        <AppSection title="Team Showcase Photograph" style={{ marginTop: 18 }}>
          <div className="upload-tile" style={{ marginBottom: 12 }}>
            {pageSettings.teamImage?.url ? <img src={pageSettings.teamImage.url} alt="" /> : (<><ImageIcon size={32} /><span className="t-caption">No hero team photograph uploaded.</span></>)}
          </div>
          {pageSettings.teamImage?.url && (
            <div className="meta-line" style={{ color: '#10B981', marginBottom: 12 }}>
              <CheckCircle2 size={14} /> Team Image Active
            </div>
          )}
          <AppButton variant="secondary" onClick={() => handlePickSettingsImage('teamImage')} loading={isSaving} disabled={isSaving} fullWidth icon={<Upload size={16} />}>
            Upload Team Photo
          </AppButton>
        </AppSection>

        <AppSection title="Sponsorship Prospectus Brochure (.pdf)" style={{ marginTop: 18 }}>
          <div className="row gap-md" style={{ marginBottom: 14 }}>
            <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: '#38BDF815' }}>
              <FileText size={20} color="#38BDF8" />
            </div>
            <div className="grow">
              <div className="t-body" style={{ fontWeight: 600 }}>
                {pageSettings.brochure?.url ? pageSettings.brochure.name || 'Sponsorship_Brochure.pdf' : 'No Brochure Attached'}
              </div>
              <div className="t-caption">
                {pageSettings.brochure?.url ? 'Available for download on the Sponsor Us page' : 'Upload your sponsorship tier prospectus'}
              </div>
            </div>
          </div>
          <AppButton variant="secondary" onClick={() => handlePickSettingsImage('brochure')} loading={isSaving} disabled={isSaving} fullWidth icon={<Upload size={16} />}>
            {pageSettings.brochure?.url ? 'Replace Brochure File' : 'Upload Brochure PDF'}
          </AppButton>
        </AppSection>
      </AppModal>
    </Screen>
  );
}
