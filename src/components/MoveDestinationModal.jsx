import { useState, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, ListFilter, Check, Ban, CornerDownRight } from 'lucide-react';
import { AppModal, AppButton, AppEmptyState } from './ui';
import './moveModal.css';

export default function MoveDestinationModal({
  visible,
  onDismiss,
  onClose,
  onConfirm,
  lists = [],
  inventories = [],
  allowedTypes = [],
  invalidTargets = [],
}) {
  const [selectedTarget, setSelectedTarget] = useState(null);
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const handleClose = onClose || onDismiss || (() => {});

  useEffect(() => {
    if (visible) {
      setSelectedTarget(null);
      const initialExpanded = new Set();
      lists.forEach((l) => {
        if (!l.isArchived) initialExpanded.add(`list_${l.id}`);
      });
      setExpandedNodes(initialExpanded);
    }
  }, [visible, lists]);

  const toggleExpand = (id) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isInvalid = (type, id) => {
    if (invalidTargets.includes(`${type}:${id}`)) return true;
    if (type === 'inventory') {
      const seen = new Set();
      let current = inventories.find((i) => i.id === id);
      let depth = 0;
      while (current && depth < 20 && !seen.has(current.id)) {
        if (invalidTargets.includes(`inventory:${current.id}`)) return true;
        seen.add(current.id);
        current = inventories.find((i) => i.id === current.parentInventoryId);
        depth++;
      }
    }
    return false;
  };

  const buildTree = () => {
    const data = [];
    const activeLists = lists.filter((l) => !l.isArchived);

    const getChildren = (parentId, level) => {
      const children = inventories.filter((i) => i.parentInventoryId === parentId);
      children.forEach((child) => {
        const hasChildren = inventories.some((i) => i.parentInventoryId === child.id);
        const expanded = expandedNodes.has(`inventory_${child.id}`);
        data.push({ ...child, _nodeType: 'inventory', _level: level, _hasChildren: hasChildren, _expanded: expanded });
        if (expanded && hasChildren) getChildren(child.id, level + 1);
      });
    };

    activeLists.forEach((list) => {
      const rootInvs = inventories.filter((i) => i.listId === list.id && !i.parentInventoryId);
      const hasChildren = rootInvs.length > 0;
      const expanded = expandedNodes.has(`list_${list.id}`);
      data.push({ ...list, _nodeType: 'list', _level: 0, _hasChildren: hasChildren, _expanded: expanded });
      if (expanded && hasChildren) {
        rootInvs.forEach((inv) => {
          const invHasChildren = inventories.some((i) => i.parentInventoryId === inv.id);
          const invExpanded = expandedNodes.has(`inventory_${inv.id}`);
          data.push({ ...inv, _nodeType: 'inventory', _level: 1, _hasChildren: invHasChildren, _expanded: invExpanded });
          if (invExpanded && invHasChildren) getChildren(inv.id, 2);
        });
      }
    });

    return data;
  };

  const data = buildTree();

  return (
    <AppModal
      visible={visible}
      onClose={handleClose}
      title="Select Destination"
      footer={
        <div className="row gap-sm">
          <AppButton variant="ghost" onClick={handleClose} style={{ flex: 1 }}>
            Cancel
          </AppButton>
          <AppButton
            variant="primary"
            disabled={!selectedTarget}
            onClick={() => onConfirm(selectedTarget)}
            style={{ flex: 1 }}
          >
            Confirm Move
          </AppButton>
        </div>
      }
    >
      <p className="move-subtitle">
        Choose the target list or folder destination where you wish to relocate the selected item(s).
      </p>

      <div className="tree-box">
        {data.length === 0 ? (
          <AppEmptyState
            title="No Valid Destinations"
            description="There are currently no active inventory lists or folders available."
          />
        ) : (
          data.map((item) => {
            const type = item._nodeType;
            const invalid = isInvalid(type, item.id);
            const canSelect = allowedTypes.includes(type);
            const isSelected = selectedTarget?.type === type && selectedTarget?.id === item.id;
            const isList = type === 'list';
            return (
              <div
                key={`${type}_${item.id}`}
                className={`node-row${isSelected ? ' selected' : ''}${invalid ? ' disabled' : ''}`}
                style={{ paddingLeft: item._level * 20 + 12 }}
                onClick={() => {
                  if (item._hasChildren) toggleExpand(`${type}_${item.id}`);
                  if (!invalid && canSelect) setSelectedTarget({ type, id: item.id, name: item.name });
                }}
              >
                <span
                  className="expand-box"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (item._hasChildren) toggleExpand(`${type}_${item.id}`);
                  }}
                >
                  {item._hasChildren ? (
                    item._expanded ? (
                      <ChevronDown size={16} color="var(--text-secondary)" />
                    ) : (
                      <ChevronRight size={16} color="var(--text-secondary)" />
                    )
                  ) : item._level > 0 ? (
                    <CornerDownRight size={14} color="rgba(100,116,139,0.5)" />
                  ) : null}
                </span>

                <span className={`type-iconbox${isSelected ? ' sel' : ''}`}>
                  {isList ? (
                    <ListFilter size={16} color={isSelected ? '#268BD2' : 'var(--accent)'} />
                  ) : (
                    <Folder size={16} color={isSelected ? '#268BD2' : '#2AA198'} />
                  )}
                </span>

                <span className="grow" style={{ marginRight: 8 }}>
                  <span className={`node-name${isSelected ? ' sel' : ''}`}>{item.name}</span>
                  <span className="node-sub">
                    {isList ? 'Inventory List Root' : `Sub-folder${item._hasChildren ? ' • Contains sub-items' : ''}`}
                  </span>
                </span>

                {invalid ? (
                  <span className="badge-invalid">
                    <Ban size={12} color="#DC322F" />
                    Invalid
                  </span>
                ) : isSelected ? (
                  <span className="badge-selected">
                    <Check size={14} color="var(--bg)" />
                  </span>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </AppModal>
  );
}
