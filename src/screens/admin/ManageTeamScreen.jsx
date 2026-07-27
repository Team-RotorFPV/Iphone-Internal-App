import { useEffect, useState } from 'react';
import { Award, Briefcase, Wrench, Eye, EyeOff } from 'lucide-react';
import { TeamService } from '../../services/team';
import { useAuthStore } from '../../stores/authStore';
import { AppChip, AppListItem, AppFAB, AppModal, AppInput, AppButton, AppBadge, AppToggle, AppSkeleton, AppEmptyState } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const EMPTY_MEMBER = { userId: '', role: '', category: 'leaders', order: 0, isActive: true, year: '' };

export default function ManageTeamScreen() {
  const user = useAuthStore((s) => s.user);
  const [years, setYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState(null);
  const [members, setMembers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(EMPTY_MEMBER);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsubYears = TeamService.subscribeToTeamYears((data) => {
      setYears(data);
      if (data.length > 0 && !selectedYear) setSelectedYear(data[0].year);
    });
    const unsubMembers = TeamService.subscribeToTeamMembers((data) => {
      setMembers(data);
      setLoading(false);
    });
    TeamService.getUsers().then(setUsers);
    return () => {
      unsubYears();
      unsubMembers();
    };
  }, [selectedYear]);

  const currentYearMembers = members.filter((m) => m.year === selectedYear);

  const openAddModal = () => {
    if (!selectedYear) {
      toast.error('Please create or select a team year first.');
      return;
    }
    setFormData({ ...EMPTY_MEMBER, year: selectedYear });
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (item) => {
    setFormData({
      userId: item.userId || '',
      role: item.role || '',
      category: item.category || 'leaders',
      order: item.order || 0,
      isActive: item.isActive !== false,
      year: item.year || selectedYear,
    });
    setEditingId(item.id);
    setModalVisible(true);
  };

  const handleDelete = (item) => {
    alertConfirm({
      title: 'Remove Team Member',
      message: `Permanently remove this member from the ${item.year} roster?`,
      onConfirm: () => TeamService.deleteTeamMember(item),
    });
  };

  const handleSave = async () => {
    if (!formData.userId) {
      toast.error('A User ID / Account Email is required.');
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, order: Number(formData.order) };
      if (editingId) await TeamService.updateTeamMember(editingId, dataToSave, user?.email);
      else await TeamService.addTeamMember(dataToSave, user?.email);
      setModalVisible(false);
    } catch {
      toast.error('Failed to save team member details');
    } finally {
      setIsSaving(false);
    }
  };

  const getUserDetails = (userId) => {
    const found = users.find((u) => u.id === userId || u.email === userId);
    return found ? found.name || found.email : userId;
  };

  const getCategoryIcon = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat === 'leaders') return <Award size={18} color="#A855F7" />;
    if (cat === 'technical') return <Wrench size={18} color="#38BDF8" />;
    return <Briefcase size={18} color="#10B981" />;
  };

  const getCategoryBadgeVariant = (category) => {
    const cat = (category || '').toLowerCase();
    if (cat === 'leaders') return 'primary';
    if (cat === 'technical') return 'secondary';
    return 'success';
  };

  return (
    <Screen title="Manage Board">
      <div className="row gap-sm" style={{ marginBottom: 12, overflowX: 'auto' }}>
        <span className="t-caption" style={{ fontWeight: 600, flexShrink: 0 }}>Roster Year</span>
        {years.map((y) => (
          <AppChip key={y.id || y.year} label={`${y.year}${y.isCurrent ? ' ★' : ''}`} selected={selectedYear === y.year} onClick={() => setSelectedYear(y.year)} />
        ))}
      </div>

      {loading ? (
        <div className="stack gap-sm">
          <AppSkeleton width="100%" height={76} />
          <AppSkeleton width="100%" height={76} />
        </div>
      ) : currentYearMembers.length === 0 ? (
        <AppEmptyState
          title={`No Roster Found (${selectedYear || 'Select Year'})`}
          description="There are no team members assigned to this academic year yet."
          actionLabel="Add Team Member"
          onAction={openAddModal}
        />
      ) : (
        currentYearMembers.map((item) => {
          const badgeVariant = !item.isActive ? 'danger' : getCategoryBadgeVariant(item.category);
          const badgeLabel = !item.isActive ? 'Inactive' : (item.category || 'Member').toUpperCase();
          return (
            <AppListItem
              key={item.id}
              title={getUserDetails(item.userId)}
              description={`${item.role || 'Team Member'} • Order #${item.order}`}
              leftIcon={
                <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: item.category === 'leaders' ? '#A855F715' : '#38BDF815' }}>
                  {getCategoryIcon(item.category)}
                </div>
              }
              rightElement={<AppBadge variant={badgeVariant}>{badgeLabel}</AppBadge>}
              onClick={() => openEditModal(item)}
              onDelete={() => handleDelete(item)}
            />
          );
        })
      )}

      <AppFAB label="Add Member" onClick={openAddModal} />

      <AppModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        title={editingId ? 'Edit Team Assignment' : `Add to ${selectedYear || ''} Roster`}
        footer={
          <div className="row gap-sm">
            <AppButton variant="ghost" onClick={() => setModalVisible(false)} style={{ flex: 1 }} disabled={isSaving}>
              Cancel
            </AppButton>
            <AppButton variant="primary" onClick={handleSave} style={{ flex: 1 }} loading={isSaving}>
              Save Assignment
            </AppButton>
          </div>
        }
      >
        <AppInput
          label="User ID / Account Email"
          value={formData.userId}
          onChangeText={(t) => setFormData({ ...formData, userId: t })}
          placeholder="e.g. member@rotorfpv.com or User ID"
          autoFocus={!editingId}
        />
        <AppInput label="Assigned Role / Title" value={formData.role} onChangeText={(t) => setFormData({ ...formData, role: t })} placeholder="e.g. CAPTAIN, DRONE PILOT" />
        <AppInput label="Roster Category" value={formData.category} onChangeText={(t) => setFormData({ ...formData, category: t })} placeholder="leaders / technical / essential" />
        <AppInput label="Display Priority Order" value={String(formData.order)} onChangeText={(t) => setFormData({ ...formData, order: t })} inputMode="numeric" placeholder="0" />

        <div className="row-between" style={{ background: 'var(--surface)', border: '1px solid var(--border)', padding: 16, borderRadius: 12, marginTop: 8 }}>
          <div className="grow" style={{ marginRight: 12 }}>
            <div className="row gap-xs">
              {formData.isActive ? <Eye size={16} color="#10B981" /> : <EyeOff size={16} color="#EF4444" />}
              <span className="t-body" style={{ fontWeight: 600 }}>Active Roster Status</span>
            </div>
            <div className="t-caption">When disabled, this member is hidden from the public team page.</div>
          </div>
          <AppToggle value={formData.isActive} onValueChange={(v) => setFormData({ ...formData, isActive: v })} />
        </div>
      </AppModal>
    </Screen>
  );
}
