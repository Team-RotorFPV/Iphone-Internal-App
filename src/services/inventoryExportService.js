import * as XLSX from 'xlsx';
import { EXPORT_COLUMNS } from './exportColumns';
import { getInventorySnapshot } from './inventorySnapshotService';

// Excel only auto-detects UTF-8 in a CSV if the file opens with a byte order
// mark. Without it, accented characters and symbols render as mojibake.
const UTF8_BOM = '﻿';

const escapeCell = (value) => {
  const str = value !== undefined && value !== null ? String(value) : '';
  return `"${str.replace(/"/g, '""')}"`;
};

const headerRow = () => EXPORT_COLUMNS.map((col) => escapeCell(col.header)).join(',');
const itemRow = (item) => EXPORT_COLUMNS.map((col) => escapeCell(item[col.key])).join(',');

/** Trigger a browser download for a blob. */
const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const downloadText = (fileName, content, mime = 'text/csv;charset=utf-8') => {
  downloadBlob(new Blob([content], { type: mime }), fileName);
};

/**
 * Plain CSV: header row plus one row per item, no summary block.
 * @param {Object} filter - Optional { listId, inventoryId }
 */
export const exportToCsv = async (filter = {}, fileName = 'TRFPV_Inventory.csv') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    const lines = [headerRow(), ...snapshot.allItems.map(itemRow)];
    downloadText(fileName, UTF8_BOM + lines.join('\n'));
    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('CSV Export failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Real multi-section .xlsx workbook: a summary block followed by all items
 * grouped by list, using the shared EXPORT_COLUMNS definition.
 * @param {Object} filter - Optional { listId, inventoryId }
 */
export const exportToExcel = async (filter = {}, fileName = 'TRFPV_Inventory.xlsx') => {
  try {
    const snapshot = await getInventorySnapshot(filter);
    const { summary } = snapshot;

    const aoa = [
      ['Team Rotor FPV - Inventory Export'],
      [`Generated: ${new Date(snapshot.generatedAt).toLocaleString()}`],
      [],
      ['Total Lists', summary.totalLists],
      ['Total Inventories', summary.totalInventories],
      ['Total Sub-Inventories', summary.totalSubInventories],
      ['Total Items', summary.totalItems],
      ['Assigned Items', summary.assignedItems],
      ['Unassigned Items', summary.unassignedItems],
      ['Unique Holders', summary.uniqueHolders],
      [],
      EXPORT_COLUMNS.map((col) => col.header),
    ];

    for (const listName of Object.keys(snapshot.lists).sort()) {
      const items = [...(snapshot.lists[listName] || [])].sort((a, b) =>
        (a.itemName || '').localeCompare(b.itemName || '')
      );
      for (const item of items) {
        aoa.push(EXPORT_COLUMNS.map((col) => item[col.key] ?? ''));
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = EXPORT_COLUMNS.map((col) => ({ wch: col.width || 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventory');

    const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    downloadBlob(
      new Blob([out], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      fileName
    );
    return { success: true, itemCount: snapshot.allItems.length };
  } catch (error) {
    console.error('Excel export failed:', error);
    return { success: false, error: error.message };
  }
};

/** Export scopes available given the current screen context. */
export const getExportScopes = (selectedListId, selectedInventoryId) => {
  const scopes = [{ key: 'full', label: 'Full Database', filter: {} }];

  if (selectedListId) {
    scopes.push({ key: 'list', label: 'Current List', filter: { listId: selectedListId } });
  }
  if (selectedInventoryId) {
    scopes.push({
      key: 'inventory',
      label: 'Selected Inventory',
      filter: { inventoryId: selectedInventoryId },
    });
  }

  return scopes;
};
