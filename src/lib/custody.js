// Effective-holder resolution for the QR custody model.
//
// Custody rule (product decision, "Q6"):
//   Holding a folder implicitly holds everything inside it — items AND
//   sub-folders — EXCEPT any entity someone has explicitly grabbed. An explicit
//   `currentHolder` on an entity is an override that wins; an empty
//   `currentHolder` means "inherit the nearest ancestor folder that has one."
//
// So `currentHolder` on a doc always stores the EXPLICIT holder only (or null).
// The holder shown in the UI is COMPUTED here by walking up the parent chain —
// it is never denormalised, so releasing an override cleanly reverts to the
// folder owner.

const MAX_TREE_DEPTH = 20;

// Walk up the inventory parent chain from `startInvId`, returning the first
// ancestor (inclusive) that carries an explicit holder.
const walkInventoriesForHolder = (startInvId, allInvs) => {
  const seen = new Set();
  let current = allInvs.find((i) => i.id === startInvId);
  let depth = 0;
  while (current && !seen.has(current.id) && depth < MAX_TREE_DEPTH) {
    if (current.currentHolder) {
      return {
        holder: current.currentHolder,
        source: 'inherited',
        from: { id: current.id, name: current.name },
      };
    }
    seen.add(current.id);
    current = allInvs.find((i) => i.id === current.parentInventoryId);
    depth++;
  }
  return { holder: null, source: 'none', from: null };
};

/**
 * Resolve who effectively holds an entity.
 *
 * @param {object} entity      The item or inventory doc.
 * @param {'item'|'inventory'} entityType
 * @param {Array}  allInvs     All inventory docs (for the parent walk).
 * @returns {{holder: string|null, source: 'self'|'inherited'|'none', from: {id,name}|null}}
 *   - source 'self'      → the entity has its own explicit holder (an override).
 *   - source 'inherited' → holder comes from ancestor folder `from`.
 *   - source 'none'      → nobody holds it or any ancestor.
 */
export const resolveEffectiveHolder = (entity, entityType, allInvs = []) => {
  if (!entity) return { holder: null, source: 'none', from: null };

  if (entity.currentHolder) {
    return { holder: entity.currentHolder, source: 'self', from: null };
  }

  const startInvId = entityType === 'item' ? entity.inventoryId : entity.parentInventoryId;
  return walkInventoriesForHolder(startInvId, allInvs);
};

/**
 * True when the entity's shown holder comes from a parent, not itself — useful
 * for rendering "Held by Alice (via Motors folder)" vs a direct hold.
 */
export const isInheritedHolder = (entity, entityType, allInvs = []) =>
  resolveEffectiveHolder(entity, entityType, allInvs).source === 'inherited';
