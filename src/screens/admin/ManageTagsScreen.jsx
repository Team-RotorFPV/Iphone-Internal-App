import { useEffect, useMemo, useState } from 'react';
import { QrCode, Download, Plus } from 'lucide-react';
import { TagsService } from '../../services/assetTags';
import { exportTagsSheet } from '../../services/tagExport';
import { useAuthStore } from '../../stores/authStore';
import { AppCard, AppSection, AppButton, AppInput, AppBadge, AppSkeleton } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

export default function ManageTagsScreen() {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const canManage = hasPermission('inventory');

  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [countText, setCountText] = useState('50');
  const [minting, setMinting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastMinted, setLastMinted] = useState([]);

  useEffect(() => {
    const unsub = TagsService.subscribeToTags((data) => {
      setTags(data);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const counts = useMemo(() => {
    const c = { total: tags.length, unassigned: 0, active: 0, retired: 0 };
    for (const t of tags) {
      if (t.status === 'active') c.active++;
      else if (t.status === 'retired') c.retired++;
      else c.unassigned++;
    }
    return c;
  }, [tags]);

  const handleExport = async (codes) => {
    try {
      setExporting(true);
      await exportTagsSheet(codes);
    } catch (error) {
      console.error('Error exporting tags:', error);
      toast.error(error.message || 'Could not export the tag sheet.');
    } finally {
      setExporting(false);
    }
  };

  const handleMint = async () => {
    const count = parseInt(countText, 10);
    if (!Number.isFinite(count) || count < 1) {
      return toast.error('Enter how many tags to generate (1 or more).');
    }
    if (count > 500) {
      return toast.error('Generate at most 500 tags per batch.');
    }
    try {
      setMinting(true);
      const codes = await TagsService.mintBatch(count);
      setLastMinted(codes);
      alertConfirm({
        title: 'Tags generated',
        message: `${codes.length} new tag${codes.length === 1 ? '' : 's'} created. Export the sheet to print them now?`,
        confirmLabel: 'Export now',
        onConfirm: () => handleExport(codes),
      });
    } catch (error) {
      console.error('Error minting tags:', error);
      toast.error('Could not generate tags. Please try again.');
    } finally {
      setMinting(false);
    }
  };

  const exportUnassigned = () => {
    const codes = tags.filter((t) => (t.status || 'unassigned') === 'unassigned').map((t) => t.id);
    if (codes.length === 0) return toast('There are no unassigned tags.');
    handleExport(codes);
  };

  if (!canManage) {
    return (
      <Screen title="QR Asset Tags">
        <div className="empty" style={{ paddingTop: 60 }}>
          <QrCode size={40} color="var(--text-muted)" />
          <div className="empty-msg" style={{ marginTop: 12 }}>You need inventory permission to manage tags.</div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen title="QR Asset Tags">
      <AppSection title="Tag Inventory">
        {loading ? (
          <AppSkeleton width="100%" height={90} />
        ) : (
          <div className="stat-row" style={{ marginBottom: 0 }}>
            <div className="stat-pill">
              <div className="stat-value">{counts.unassigned}</div>
              <div className="stat-label">Unassigned</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: '#66BB6A' }}>{counts.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-pill">
              <div className="stat-value" style={{ color: 'var(--text-muted)' }}>{counts.retired}</div>
              <div className="stat-label">Retired</div>
            </div>
          </div>
        )}
      </AppSection>

      <AppSection title="Generate New Tags" style={{ marginTop: 18 }}>
        <p className="t-body-secondary" style={{ marginTop: 0 }}>
          Print these before sticking them on anything. Each tag starts unassigned and is bound when first scanned inside a folder.
        </p>
        <AppInput label="How many?" value={countText} onChangeText={setCountText} inputMode="numeric" placeholder="50" />
        <AppButton variant="primary" onClick={handleMint} loading={minting} icon={<Plus size={16} color="#121212" />} fullWidth>
          Generate Tags
        </AppButton>
      </AppSection>

      <AppSection title="Export for Printing" style={{ marginTop: 18 }}>
        {lastMinted.length > 0 && (
          <div className="row-between" style={{ marginBottom: 12 }}>
            <AppBadge variant="success">{lastMinted.length} just generated</AppBadge>
            <AppButton variant="secondary" size="sm" onClick={() => handleExport(lastMinted)} loading={exporting} icon={<Download size={14} />}>
              Export last batch
            </AppButton>
          </div>
        )}
        <AppButton variant="secondary" onClick={exportUnassigned} loading={exporting} icon={<Download size={16} />} fullWidth>
          {`Export all unassigned (${counts.unassigned})`}
        </AppButton>
      </AppSection>
    </Screen>
  );
}
