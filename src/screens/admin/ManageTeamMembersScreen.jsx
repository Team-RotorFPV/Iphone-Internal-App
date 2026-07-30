import { useEffect, useState, useMemo } from 'react';
import { User, UserCheck, UserX, Tag, Archive, Trash2, RotateCcw, CheckSquare, Square, AlertTriangle } from 'lucide-react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { UsersService } from '../../services/users';
import { CustomFieldsService } from '../../services/customFields';
import { JoinRequestsService } from '../../services/joinRequests';
import { TagsService } from '../../services/tags';
import { apiPost, fetchAdmins, syncUserPermissions } from '../../services/adminApi';
import { expandTagIds, getGrantedTagIds } from '../../lib/tagGrants';
import { AppSearchBar, AppChip, AppCard, AppButton, AppBadge, AppFAB, AppModal, AppInput, AppSkeleton, AppEmptyState, AppSection } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

export default function ManageTeamMembersScreen() {
  const [users, setUsers] = useState([]);
  const [joinRequests, setJoinRequests] = useState([]);
  const [tags, setTags] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [admins, setAdmins] = useState([]);

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTagFilter, setSelectedTagFilter] = useState('all');

  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({});
  const [selectedTags, setSelectedTags] = useState([]);

  useEffect(() => {
    const unsubUsers = UsersService.subscribeToUsers(setUsers);
    const unsubRequests = JoinRequestsService.subscribeToPendingRequests(setJoinRequests);
    const unsubTags = TagsService.subscribeToTags(setTags);
    const unsubFields = CustomFieldsService.subscribeToCustomFields(setCustomFields);
    fetchAdmins()
      .then(setAdmins)
      .catch((err) => console.warn('[ManageTeamMembersScreen] Could not fetch admins list:', err.message));
    setLoading(false);
    return () => {
      unsubUsers();
      unsubRequests();
      unsubTags();
      unsubFields();
    };
  }, []);

  const sections = useMemo(() => {
    const activeUsers = users.filter((u) => u.status === 'active' || !u.status);
    const mergedMembers = [...activeUsers];
    admins.forEach((admin) => {
      if (!mergedMembers.find((u) => u.email === admin.email)) {
        mergedMembers.push({ email: admin.email, name: 'Incomplete Profile', isOrphanedAdmin: true, tags: [] });
      }
    });
    const archivedMembers = users.filter((u) => u.isArchived);

    const filterBySearch = (list) =>
      list.filter(
        (u) =>
          (u.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (u.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      );

    const filteredMerged = filterBySearch(mergedMembers);
    const filteredArchived = filterBySearch(archivedMembers);
    const groups = [];

    tags.forEach((tag) => {
      if (selectedTagFilter !== 'all' && tag.id !== selectedTagFilter) return;
      const membersInTag = filteredMerged.filter((m) => (m.tags || []).includes(tag.id));
      if (membersInTag.length > 0 || selectedTagFilter === tag.id) {
        groups.push({ title: tag.name, data: membersInTag, tagId: tag.id });
      }
    });

    const validTagIds = new Set(tags.map((t) => t.id));
    const untaggedMembers =
      selectedTagFilter === 'all' || selectedTagFilter === 'untagged'
        ? filteredMerged.filter((m) => (m.tags || []).filter((tid) => validTagIds.has(tid)).length === 0)
        : [];
    if (untaggedMembers.length > 0 || selectedTagFilter === 'untagged') {
      groups.push({ title: 'Untagged Members', data: untaggedMembers });
    }

    if (selectedTagFilter === 'all' || selectedTagFilter === 'archived') {
      if (filteredArchived.length > 0 || selectedTagFilter === 'archived') {
        groups.push({ title: 'Archived Members', data: filteredArchived });
      }
    }
    return groups;
  }, [users, tags, admins, searchQuery, selectedTagFilter]);

  const handleApproveRequest = async (req) => {
    try {
      await apiPost('/api/admin/requests/approve', { requestId: req.id, email: req.email, name: req.name, tags: [], customFields: req.customFields || {} });
      toast.success('Member application approved and account created!');
    } catch (error) {
      toast.error(error.message || 'Failed to approve application.');
    }
  };

  const handleRejectRequest = async (reqId) => {
    try {
      await JoinRequestsService.rejectRequest(reqId);
      toast.success('Application rejected.');
    } catch (error) {
      toast.error(error.message || 'Failed to reject application.');
    }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setFormData({ email: '', tags: [], customFields: {} });
    setSelectedTags([]);
    setModalVisible(true);
  };
  const openEditModal = (u) => {
    setIsEditing(true);
    setFormData({ ...u, customFields: u.customFields || {} });
    setSelectedTags(u.tags || []);
    setModalVisible(true);
  };

  const handleSaveUser = async () => {
    if (!formData.email) {
      toast.error('Email address is required.');
      return;
    }
    setSaving(true);
    try {
      const email = formData.email.trim().toLowerCase();
      const finalTags = expandTagIds(selectedTags, tags);
      if (!isEditing) {
        const res = await apiPost('/api/admin/users/create', { email, tags: finalTags, customFields: formData.customFields });
        if (!res.ok) throw new Error(res.data?.error || 'Failed to create user account.');
      } else {
        const payload = { ...formData, tags: finalTags, updatedAt: new Date().toISOString() };
        await setDoc(doc(db, 'users', email), payload, { merge: true });
      }
      const currentAdmins = admins.length > 0 ? admins : await fetchAdmins();
      await syncUserPermissions(email, finalTags, tags, currentAdmins);
      fetchAdmins().then(setAdmins).catch(() => {});
      setModalVisible(false);
      toast.success(`Team member ${isEditing ? 'updated' : 'registered'} successfully.`);
    } catch (error) {
      toast.error(error.message || 'Failed to save member profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchiveUser = (email) =>
    alertConfirm({
      title: 'Archive Member',
      message: 'Archive this user? They will lose active platform access.',
      onConfirm: async () => {
        try {
          await UsersService.archiveUser(email);
          toast.success('Member archived.');
        } catch (err) {
          toast.error(err.message);
        }
      },
    });

  const handleRestoreUser = async (email) => {
    try {
      await setDoc(doc(db, 'users', email), { isActive: true, isArchived: false }, { merge: true });
      toast.success('Member account restored to active status.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDeleteUser = (email) =>
    alertConfirm({
      title: 'Permanent Deletion',
      message: 'Permanently delete this account? All associated records and permissions will be wiped.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'users', email));
          await syncUserPermissions(email, [], tags, admins);
          toast.success('User permanently deleted.');
        } catch (err) {
          toast.error(err.message);
        }
      },
    });

  const toggleTag = (tagId) => {
    setSelectedTags((prev) => {
      let newTags = [...prev];
      if (newTags.includes(tagId)) {
        newTags = newTags.filter((id) => id !== tagId);
      } else {
        newTags.push(tagId);
        const tag = tags.find((t) => t.id === tagId);
        if (tag) getGrantedTagIds(tag, tags).forEach((gid) => !newTags.includes(gid) && newTags.push(gid));
      }
      return newTags;
    });
  };

  const renderMember = (item) => (
    <AppCard key={item.email} variant="surface" onClick={item.isArchived ? undefined : () => openEditModal(item)} style={{ marginBottom: 10 }}>
      <div className="row-between">
        <div className="row gap-md grow">
          <div className="avatar" style={{ width: 44, height: 44, border: '1px solid var(--border)' }}>
            {item.image ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} color="var(--text-secondary)" />}
          </div>
          <div className="grow">
            <div className="row gap-xs">
              <span className="t-body" style={{ fontWeight: 600 }}>{item.name || item.email}</span>
              {item.isOrphanedAdmin && <AppBadge variant="warning">ORPHANED</AppBadge>}
            </div>
            <div className="t-caption">{item.email}</div>
          </div>
        </div>
        <div className="row gap-sm" onClick={(e) => e.stopPropagation()}>
          {item.isArchived ? (
            <>
              <AppBadge variant="danger">ARCHIVED</AppBadge>
              <button type="button" className="icon-well" style={{ width: 32, height: 32, background: 'var(--elevated)' }} onClick={() => handleRestoreUser(item.email)}>
                <RotateCcw size={16} color="#859900" />
              </button>
              <button type="button" className="icon-well" style={{ width: 32, height: 32, background: '#DC322F15', borderColor: '#DC322F30' }} onClick={() => handleDeleteUser(item.email)}>
                <Trash2 size={16} color="#DC322F" />
              </button>
            </>
          ) : (
            <>
              <AppBadge variant="success">ACTIVE</AppBadge>
              <button type="button" className="icon-well" style={{ width: 32, height: 32, background: 'var(--elevated)' }} onClick={() => handleArchiveUser(item.email)}>
                <Archive size={16} color="var(--text-secondary)" />
              </button>
            </>
          )}
        </div>
      </div>
      {item.tags && item.tags.length > 0 && (
        <div className="wrap gap-xs" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(42,41,61,0.5)' }}>
          {item.tags.map((tid) => {
            const tagObj = tags.find((t) => t.id === tid);
            if (!tagObj) return null;
            return (
              <span key={tid} className="badge badge-accent" style={{ textTransform: 'none' }}>
                <Tag size={10} style={{ marginRight: 4 }} /> {tagObj.name}
              </span>
            );
          })}
        </div>
      )}
    </AppCard>
  );

  const totalMembers = sections.reduce((n, s) => n + s.data.length, 0);

  return (
    <Screen title="Team Members">
      <AppSearchBar placeholder="Search team members by name or email..." value={searchQuery} onChangeText={setSearchQuery} />
      <div className="row gap-sm" style={{ marginBottom: 12, overflowX: 'auto', paddingBottom: 4 }}>
        <AppChip selected={selectedTagFilter === 'all'} onClick={() => setSelectedTagFilter('all')}>All Members</AppChip>
        <AppChip selected={selectedTagFilter === 'untagged'} onClick={() => setSelectedTagFilter('untagged')}>Untagged</AppChip>
        <AppChip selected={selectedTagFilter === 'archived'} onClick={() => setSelectedTagFilter('archived')}>Archived</AppChip>
        {tags.filter((t) => t.isGroup !== false).map((t) => (
          <AppChip key={t.id} selected={selectedTagFilter === t.id} onClick={() => setSelectedTagFilter(t.id)}>{t.name}</AppChip>
        ))}
      </div>

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={100} />
          <AppSkeleton width="100%" height={100} />
        </div>
      ) : (
        <>
          {joinRequests.length > 0 && (
            <div style={{ marginBottom: 20, background: 'rgba(25,24,37,0.4)', padding: 16, borderRadius: 20, border: '1px solid #B5890040' }}>
              <div className="row gap-md" style={{ marginBottom: 14 }}>
                <div className="icon-well" style={{ width: 40, height: 40, borderRadius: 12, background: '#B5890015' }}>
                  <AlertTriangle size={18} color="#B58900" />
                </div>
                <div className="grow">
                  <div className="t-body" style={{ fontWeight: 600, color: '#B58900' }}>Pending Join Applications ({joinRequests.length})</div>
                  <div className="t-caption">Review applicants wishing to join the team</div>
                </div>
              </div>
              {joinRequests.map((req) => (
                <AppCard key={req.id} variant="elevated" style={{ border: '1px solid #B5890030' }}>
                  <div className="row-between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
                    <div className="grow">
                      <div className="t-body" style={{ fontWeight: 600 }}>{req.name || 'Anonymous Applicant'}</div>
                      <div className="t-caption">{req.email}</div>
                    </div>
                    <AppBadge variant="warning">AWAITING</AppBadge>
                  </div>
                  {req.customFields && Object.keys(req.customFields).length > 0 && (
                    <div style={{ background: 'rgba(11,10,16,0.5)', padding: 10, borderRadius: 8, marginBottom: 12, border: '1px solid var(--border)' }}>
                      {Object.entries(req.customFields).map(([fieldId, value]) => (
                        <div key={fieldId} className="row gap-xs">
                          <span className="t-caption" style={{ fontWeight: 600 }}>{customFields.find((f) => f.id === fieldId)?.name || fieldId}:</span>
                          <span className="t-caption" style={{ color: 'var(--text-primary)' }}>{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="row gap-sm">
                    <AppButton variant="ghost" size="sm" onClick={() => handleRejectRequest(req.id)} style={{ flex: 1 }} icon={<UserX size={14} color="#DC322F" />}>Reject</AppButton>
                    <AppButton variant="primary" size="sm" onClick={() => handleApproveRequest(req)} style={{ flex: 1 }} icon={<UserCheck size={14} color="var(--bg)" />}>Approve</AppButton>
                  </div>
                </AppCard>
              ))}
            </div>
          )}

          {totalMembers === 0 && sections.length === 0 ? (
            <AppEmptyState
              title="No Team Members Found"
              description={searchQuery ? 'No members match your search criteria.' : 'No team members are listed under this filter group.'}
              actionLabel={searchQuery ? undefined : 'Add New Member'}
              onAction={searchQuery ? undefined : openAddModal}
            />
          ) : (
            sections.map((section) => (
              <div key={section.title}>
                <div className="row gap-xs" style={{ padding: '12px 0 4px', marginTop: 8 }}>
                  <span className="t-body" style={{ fontWeight: 600, color: 'var(--accent)' }}>{section.title}</span>
                  <span className="muted">({section.data.length})</span>
                </div>
                {section.data.map(renderMember)}
              </div>
            ))
          )}
        </>
      )}

      <AppFAB label="Add Member" onClick={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={isEditing ? 'Modify Member Permissions' : 'Register New Team Member'}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={saving}>Cancel</AppButton>
            <AppButton variant="primary" onClick={handleSaveUser} style={{ flex: 1 }} loading={saving}>Save Member</AppButton>
          </div>
        }
      >
        <AppInput
          label="Account Email Address"
          value={formData.email || ''}
          onChangeText={(text) => setFormData({ ...formData, email: text })}
          placeholder="member@teamrotorfpv.com"
          disabled={isEditing}
          autoCapitalize="none"
          inputMode="email"
        />

        <AppSection title="Role & Division Tags (Permissions)" style={{ marginTop: 18 }}>
          <p className="t-caption" style={{ marginTop: 0, marginBottom: 12 }}>
            Assigning a division tag automatically grants associated sub-division permissions.
          </p>
          <div className="stack gap-sm">
            {tags.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className="tag-select-card"
                  style={isSelected ? { background: 'var(--accent-muted)', borderColor: 'var(--accent)' } : undefined}
                  onClick={() => toggleTag(tag.id)}
                >
                  {isSelected ? <CheckSquare size={16} color="#268BD2" /> : <Square size={16} color="var(--text-muted)" />}
                  <span style={{ color: isSelected ? '#fff' : 'var(--text-primary)' }}>{tag.name}</span>
                </button>
              );
            })}
          </div>
        </AppSection>

        {customFields.length > 0 && !isEditing && (
          <AppSection title="Custom Application Fields" style={{ marginTop: 18 }}>
            {customFields.map((field) => (
              <AppInput
                key={field.id}
                label={field.name}
                value={formData.customFields?.[field.id] || ''}
                onChangeText={(text) => setFormData({ ...formData, customFields: { ...formData.customFields, [field.id]: text } })}
                placeholder={`Enter ${field.name.toLowerCase()}...`}
              />
            ))}
          </AppSection>
        )}
      </AppModal>
    </Screen>
  );
}
