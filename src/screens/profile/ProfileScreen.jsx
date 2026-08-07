import { useState, useEffect, useRef } from 'react';
import { Camera, ExternalLink, RefreshCw, LogOut, Mail } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AuthService } from '../../services/auth';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { TagsService } from '../../services/tags';
import { apiPost, fetchAdmins, syncUserPermissions, logAdminAction } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds, buildReadableMirrors } from '../../lib/tagGrants';
import { pickAndUploadMedia, ownProfileFolder } from '../../lib/mediaUpload';
import { AppCard, AppButton, AppInput, AppChip, AppBadge, AppSection, AppSkeleton } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const APP_VERSION = '3.0.0';

const getInitials = (name) => {
  if (!name) return '??';
  const parts = name.split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

const InfoRow = ({ label, value, isLink, isLast = false }) => (
  <div className="detail-row" style={isLast ? { borderBottom: 'none' } : undefined}>
    <span className="detail-label">{label}</span>
    <span className="detail-value" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {isLink ? (
        <a href={value} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
          {value}
        </a>
      ) : (
        value
      )}
      {isLink && <ExternalLink size={14} color="var(--accent)" />}
    </span>
  </div>
);

export default function ProfileScreen() {
  const authUser = useAuthStore((s) => s.user);
  const roles = useAuthStore((s) => s.roles);

  const [profile, setProfile] = useState(null);
  const [customFields, setCustomFields] = useState([]);
  const [tags, setTags] = useState([]);
  const [admins, setAdmins] = useState([]);

  const isSuperAdmin =
    admins.find((a) => (a.email || '').toLowerCase() === (authUser?.email || '').toLowerCase())?.isSuperAdmin || false;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const isEditingRef = useRef(false);
  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  const [editForm, setEditForm] = useState({});
  const [editCustomFields, setEditCustomFields] = useState({});

  const [showMigration, setShowMigration] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    if (!authUser?.email) return;
    let unsubUser = () => {};
    let unsubFields = () => {};
    let unsubTags = () => {};

    unsubUser = UsersService.subscribeToUser(authUser.email, (data) => {
      setProfile(data);
      if (data && !isEditingRef.current) {
        setEditForm({
          name: data.name || '',
          image: data.image || '',
          roomNumber: data.roomNumber || '',
          jobTitle: data.jobTitle || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
          tags: data.tags || [],
        });
        setEditCustomFields(data.customFields || {});
      }
      setLoading(false);
    });
    unsubFields = CustomFieldsService.subscribeToCustomFields((f) => setCustomFields(f || []));
    unsubTags = TagsService.subscribeToTags((t) => setTags(t || []));
    fetchAdmins()
      .then(setAdmins)
      .catch((err) => console.warn('[ProfileScreen] Could not fetch admins list:', err.message));

    return () => {
      unsubUser();
      unsubFields();
      unsubTags();
    };
  }, [authUser]);

  const handlePickImage = async () => {
    if (!authUser?.email) {
      toast.error('Your session has expired. Please sign in again.');
      return;
    }
    setUploadingImage(true);
    try {
      const result = await pickAndUploadMedia({ folder: ownProfileFolder(authUser.email) });
      if (result.canceled) return;
      if (!result.ok) {
        toast.error(result.error || 'Upload failed');
        return;
      }
      setEditForm((prev) => ({ ...prev, image: result.url }));
      try {
        const email = authUser.email.toLowerCase();
        await UsersService.updateUser(email, { image: result.url }, false, email);
        toast.success('Profile picture updated');
      } catch (error) {
        console.error('Profile picture save error:', error);
        toast.error('The picture uploaded but could not be saved to your profile.');
      }
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const text = (value) => (value ?? '').trim();
      const updatedData = {
        name: text(editForm.name),
        image: text(editForm.image),
        roomNumber: text(editForm.roomNumber),
        jobTitle: text(editForm.jobTitle),
        linkedin: text(editForm.linkedin),
        github: text(editForm.github),
        customFields: editCustomFields,
        customFieldsReadable: buildReadableMirrors([], tags, editCustomFields, customFields).customFieldsReadable,
        email: authUser.email.toLowerCase(),
        updatedAt: new Date().toISOString(),
      };
      if (isSuperAdmin) {
        updatedData.tags = expandTagIds(editForm.tags || [], tags);
        updatedData.tagNames = buildReadableMirrors(updatedData.tags, tags, {}, customFields).tagNames;
      }

      await UsersService.updateUser(authUser.email.toLowerCase(), updatedData, false, authUser.email.toLowerCase());

      if (isSuperAdmin) {
        await syncUserPermissions(authUser.email.toLowerCase(), updatedData.tags, tags, admins);
        await logAdminAction('user_profile_updated', authUser.email.toLowerCase(), 'Updated own profile', {
          target: authUser.email.toLowerCase(),
        });
      }

      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save profile updates');
    } finally {
      setSaving(false);
    }
  };

  const handleTagToggle = (tagId) => {
    setEditForm((prev) => {
      const current = prev.tags || [];
      if (current.includes(tagId)) {
        return { ...prev, tags: current.filter((id) => id !== tagId) };
      }
      const tag = tags.find((t) => t.id === tagId);
      const granted = getGrantedTagIds(tag, tags);
      const toAdd = [tagId, ...granted].filter((id) => !current.includes(id));
      return { ...prev, tags: [...current, ...toAdd] };
    });
  };

  const handleMigrate = async () => {
    if (!newEmail.trim()) {
      toast.error('Please enter a new email address');
      return;
    }
    setMigrating(true);
    try {
      const res = await apiPost('/api/migrate/request', { newEmail: newEmail.trim() });
      if (res.ok) {
        toast.success(`Verification email sent to ${newEmail.trim()}.`);
        setShowMigration(false);
        setNewEmail('');
      } else {
        toast.error(res.data?.error || 'Failed to request migration');
      }
    } catch (error) {
      console.error('Migration error:', error);
      toast.error('An error occurred during migration request');
    } finally {
      setMigrating(false);
    }
  };

  const handleLogout = () => {
    alertConfirm({
      title: 'Sign Out',
      message: 'Are you sure you want to sign out?',
      onConfirm: () => AuthService.logout(),
    });
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      name: profile.name || '',
      image: profile.image || '',
      roomNumber: profile.roomNumber || '',
      jobTitle: profile.jobTitle || '',
      linkedin: profile.linkedin || '',
      github: profile.github || '',
      tags: profile.tags || [],
    });
    setEditCustomFields(profile.customFields || {});
  };

  if (loading) {
    return (
      <Screen title="Profile">
        <AppCard>
          <div className="row gap-lg">
            <AppSkeleton width={64} height={64} borderRadius={32} />
            <div className="grow">
              <AppSkeleton width="60%" height={24} style={{ marginBottom: 8 }} />
              <AppSkeleton width="40%" height={14} />
            </div>
          </div>
        </AppCard>
        <AppCard style={{ height: 220 }}>
          <AppSkeleton width="40%" height={20} style={{ marginBottom: 20 }} />
          <AppSkeleton width="100%" height={16} style={{ marginBottom: 12 }} />
          <AppSkeleton width="100%" height={16} style={{ marginBottom: 12 }} />
          <AppSkeleton width="80%" height={16} />
        </AppCard>
      </Screen>
    );
  }

  if (!profile) {
    return (
      <Screen title="Profile">
        <div className="center-fill">Profile not found</div>
      </Screen>
    );
  }

  const displayData = isEditing ? editForm : profile;
  const displayCustomFields = isEditing ? editCustomFields : profile.customFields || {};
  const resolvedTags = (profile.tags || [])
    .map((tagId) => tags.find((t) => t.id === tagId)?.name || null)
    .filter(Boolean);

  return (
    <Screen title="Profile">
      {/* Hero */}
      <AppCard elevated={isEditing}>
        <div className="row gap-lg" style={{ marginBottom: 16 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            {displayData.image ? (
              <img className="avatar" src={displayData.image} alt="" style={{ width: 64, height: 64 }} />
            ) : (
              <div className="avatar" style={{ width: 64, height: 64, fontSize: 20 }}>
                {getInitials(displayData.name || authUser?.email)}
              </div>
            )}
            {isEditing && (
              <button
                type="button"
                onClick={handlePickImage}
                disabled={uploadingImage}
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  background: 'var(--accent)',
                  border: '2px solid var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Camera size={13} color="#121212" />
              </button>
            )}
          </div>
          <div className="grow">
            <div className="section-title" style={{ fontSize: 20 }}>
              {displayData.name || 'Unnamed Member'}
            </div>
            <div className="t-caption muted" style={{ marginTop: 2 }}>
              {profile.email}
            </div>
            <div className="row gap-xs wrap" style={{ marginTop: 8 }}>
              <AppBadge variant={profile.status === 'active' || !profile.status ? 'success' : 'warning'}>
                {profile.status || 'Active'}
              </AppBadge>
              {roles?.admin && <AppBadge variant="admin">Admin</AppBadge>}
              {isSuperAdmin && <AppBadge variant="superAdmin">Super</AppBadge>}
            </div>
          </div>
        </div>
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          {!isEditing ? (
            <AppButton variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
              Edit Profile
            </AppButton>
          ) : (
            <div className="row gap-sm">
              <AppButton variant="ghost" size="sm" onClick={cancelEdit} style={{ flex: 1 }}>
                Cancel
              </AppButton>
              <AppButton variant="primary" size="sm" onClick={handleSave} loading={saving} style={{ flex: 1 }}>
                Save
              </AppButton>
            </div>
          )}
        </div>
      </AppCard>

      {/* Info */}
      <AppSection title="Profile Information" subtitle="Personal details and team metadata">
        {isEditing ? (
          <>
            <AppInput label="Full Name" value={editForm.name} onChangeText={(t) => setEditForm((p) => ({ ...p, name: t }))} />
            <AppInput label="Room Number" value={editForm.roomNumber} onChangeText={(t) => setEditForm((p) => ({ ...p, roomNumber: t }))} />
            <AppInput label="Job Title / Role" value={editForm.jobTitle} onChangeText={(t) => setEditForm((p) => ({ ...p, jobTitle: t }))} />
            <AppInput label="LinkedIn URL" value={editForm.linkedin} onChangeText={(t) => setEditForm((p) => ({ ...p, linkedin: t }))} autoCapitalize="none" inputMode="url" />
            <AppInput label="GitHub URL" value={editForm.github} onChangeText={(t) => setEditForm((p) => ({ ...p, github: t }))} autoCapitalize="none" inputMode="url" />
            {customFields.map((field) => (
              <AppInput
                key={field.id}
                label={field.name}
                value={(editCustomFields[field.id] || '').toString()}
                onChangeText={(t) => setEditCustomFields((p) => ({ ...p, [field.id]: t }))}
                placeholder={field.description || `Enter ${field.name}...`}
                multiline={field.type === 'text'}
                inputMode={field.type === 'number' ? 'numeric' : undefined}
              />
            ))}
            {isSuperAdmin && tags.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="t-metadata" style={{ textTransform: 'uppercase', marginBottom: 10 }}>
                  Assign Groups & Tags
                </div>
                <div className="wrap gap-sm">
                  {tags.map((tag) => (
                    <AppChip key={tag.id} selected={(editForm.tags || []).includes(tag.id)} onClick={() => handleTagToggle(tag.id)}>
                      {tag.name}
                    </AppChip>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <InfoRow label="Room Number" value={profile.roomNumber || 'N/A'} />
            <InfoRow label="Job Title / Role" value={profile.jobTitle || 'N/A'} />
            <InfoRow label="LinkedIn" value={profile.linkedin || 'N/A'} isLink={!!profile.linkedin} />
            <InfoRow label="GitHub" value={profile.github || 'N/A'} isLink={!!profile.github} />
            {customFields.map((field, index) => {
              const val = displayCustomFields[field.id];
              const isUrl = typeof val === 'string' && /^https?:\/\//.test(val);
              return (
                <InfoRow
                  key={field.id}
                  label={field.name}
                  value={val || 'N/A'}
                  isLink={isUrl}
                  isLast={index === customFields.length - 1 && resolvedTags.length === 0}
                />
              );
            })}
            {resolvedTags.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                <div className="t-metadata" style={{ textTransform: 'uppercase', marginBottom: 10 }}>
                  Assigned Groups
                </div>
                <div className="wrap gap-sm">
                  {resolvedTags.map((name, i) => (
                    <AppChip key={i} selected={false}>
                      {name}
                    </AppChip>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </AppSection>

      {/* System & Account */}
      <AppSection title="System & Account">
        <div className="row-between" style={{ padding: '8px 0' }}>
          <div>
            <div className="t-body" style={{ fontWeight: 600 }}>App Version</div>
            <div className="t-caption muted">v{APP_VERSION} (Web)</div>
          </div>
          <AppButton
            variant="secondary"
            size="sm"
            onClick={() => window.location.reload()}
            icon={<RefreshCw size={14} />}
          >
            Reload
          </AppButton>
        </div>

        <div className="divider" />

        {!showMigration ? (
          <div className="row-between" style={{ padding: '8px 0' }}>
            <div className="grow" style={{ marginRight: 12 }}>
              <div className="t-body" style={{ fontWeight: 600 }}>Email Address</div>
              <div className="t-caption muted">Migrate account to a different address</div>
            </div>
            <AppButton variant="secondary" size="sm" onClick={() => setShowMigration(true)} icon={<Mail size={14} />}>
              Migrate
            </AppButton>
          </div>
        ) : (
          <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)' }}>
            <div className="t-body" style={{ fontWeight: 600 }}>Migrate Account Email</div>
            <div className="t-caption muted" style={{ marginBottom: 12 }}>
              Enter your new email address. We will send a verification link.
            </div>
            <AppInput value={newEmail} onChangeText={setNewEmail} placeholder="new.email@example.com" autoCapitalize="none" inputMode="email" />
            <div className="row gap-sm">
              <AppButton variant="ghost" size="sm" onClick={() => setShowMigration(false)} style={{ flex: 1 }}>
                Cancel
              </AppButton>
              <AppButton variant="primary" size="sm" onClick={handleMigrate} loading={migrating} style={{ flex: 1 }}>
                Request
              </AppButton>
            </div>
          </div>
        )}

        <div className="divider" />

        <div className="row-between" style={{ padding: '8px 0' }}>
          <div className="grow">
            <div className="t-body" style={{ fontWeight: 600, color: 'var(--danger)' }}>Sign Out</div>
            <div className="t-caption muted">End your current session</div>
          </div>
          <AppButton variant="danger" size="sm" onClick={handleLogout} icon={<LogOut size={14} color="var(--danger)" />}>
            Sign Out
          </AppButton>
        </div>
      </AppSection>
    </Screen>
  );
}
