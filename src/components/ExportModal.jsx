import { useState } from 'react';
import { Download, FileText, Table, Layers, CheckCircle2, AlertCircle, CheckSquare, Square } from 'lucide-react';
import { exportToCsv, exportToExcel, getExportScopes } from '../services/inventoryExportService';
import { AppModal, AppButton, AppSection } from './ui';
import './exportModal.css';

export default function ExportModal({ visible, onDismiss, onClose, listId, inventoryId }) {
  const [format, setFormat] = useState('csv');
  const [scope, setScope] = useState('full');
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState(null);

  const handleClose = onClose || onDismiss || (() => {});
  const scopes = getExportScopes(listId, inventoryId);

  const handleExport = async () => {
    setExporting(true);
    setResult(null);
    try {
      const selectedScope = scopes.find((s) => s.key === scope) || scopes[0];
      const exportFn = format === 'csv' ? exportToCsv : exportToExcel;
      const ext = format === 'csv' ? 'csv' : 'xlsx';
      const fileName = `TRFPV_Inventory_${scope}_${new Date().toISOString().slice(0, 10)}.${ext}`;
      const res = await exportFn(selectedScope.filter, fileName);

      if (res.success) {
        setResult({ type: 'success', message: `Exported ${res.itemCount} items successfully!` });
        setTimeout(() => {
          handleClose();
          setResult(null);
        }, 1500);
      } else {
        setResult({ type: 'error', message: res.error || 'Export failed to generate file.' });
      }
    } catch (error) {
      setResult({ type: 'error', message: error.message || 'An unexpected error occurred during export.' });
    } finally {
      setExporting(false);
    }
  };

  const OptionCard = ({ active, onClick, icon, label, sub }) => (
    <button type="button" className={`opt-card${active ? ' active' : ''}`} onClick={onClick}>
      <div className="opt-head">
        <div className="opt-iconbox" style={{ background: active ? '#8B5CF620' : 'var(--elevated)' }}>
          {icon}
        </div>
        {active ? <CheckSquare size={18} color="#8B5CF6" /> : <Square size={18} color="var(--text-muted)" />}
      </div>
      <div className="opt-label">{label}</div>
      {sub && <div className="opt-sub">{sub}</div>}
    </button>
  );

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Export Inventory Data"
      footer={
        <div className="row gap-sm">
          <AppButton variant="ghost" onClick={handleClose} disabled={exporting} style={{ flex: 1 }}>
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={exporting}
            style={{ flex: 1 }}
            icon={<Download size={16} color="var(--bg)" />}
          >
            Generate Export
          </AppButton>
        </div>
      }
    >
      <AppSection title="Select Export Scope">
        <div className="opt-grid">
          {scopes.map((s) => (
            <OptionCard
              key={s.key}
              active={scope === s.key}
              onClick={() => setScope(s.key)}
              icon={<Layers size={18} color={scope === s.key ? '#8B5CF6' : 'var(--text-secondary)'} />}
              label={s.label}
            />
          ))}
        </div>
      </AppSection>

      <AppSection title="File Format" style={{ marginTop: 18 }}>
        <div className="opt-grid">
          <OptionCard
            active={format === 'csv'}
            onClick={() => setFormat('csv')}
            icon={<FileText size={18} color={format === 'csv' ? '#8B5CF6' : 'var(--text-secondary)'} />}
            label="Standard CSV (.csv)"
            sub="Universal comma-separated format for scripts and databases"
          />
          <OptionCard
            active={format === 'excel'}
            onClick={() => setFormat('excel')}
            icon={<Table size={18} color={format === 'excel' ? '#8B5CF6' : 'var(--text-secondary)'} />}
            label="Excel Workbook (.xlsx)"
            sub="A real spreadsheet with a summary block and rows grouped by list"
          />
        </div>
      </AppSection>

      {result && (
        <div className={`result-box ${result.type}`}>
          {result.type === 'success' ? (
            <CheckCircle2 size={18} color="#10B981" />
          ) : (
            <AlertCircle size={18} color="#EF4444" />
          )}
          <span>{result.message}</span>
        </div>
      )}
    </AppModal>
  );
}
