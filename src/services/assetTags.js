import { collection, query, orderBy, onSnapshot, getDoc, setDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { logInventoryAction } from './auditLog';
import { useAuthStore } from '../stores/authStore';
import { generateUniqueCodes, normalizeCode, isValidCode } from '../lib/shortCode';

// Collection name is deliberately NOT `tags` — that collection already exists as
// the user role/permission taxonomy (Board / Admin / …). These are physical QR
// asset labels.
const TAGS = 'asset_tags';

// Map an entityType discriminator to its Firestore collection.
const ENTITY_COLLECTION = { inventory: 'inventories', item: 'items' };

const getUserEmail = () => useAuthStore.getState().user?.email || 'unknown';

// A bound tag is immutable and one active tag per entity is enforced for real by
// Firestore security rules (a tag doc can only transition unassigned→active and
// active→retired, never re-point). These client checks are the first line of
// defence and give good offline UX; the rules are the backstop for the race
// where two offline devices bind the same code.
export const TagsService = {
  // ─── READ ──────────────────────────────────────────────────────────

  subscribeToTags: (callback) => {
    const q = query(collection(db, TAGS), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error('Error subscribing to asset tags:', error)
    );
  },

  /**
   * Resolve a scanned/typed code to a tag doc.
   * @returns {{ status: 'invalid' | 'not_found' | 'unassigned' | 'active' | 'retired', tag?: object }}
   */
  getByCode: async (rawCode) => {
    if (!isValidCode(rawCode)) return { status: 'invalid' };
    const code = normalizeCode(rawCode);
    const snap = await getDoc(doc(db, TAGS, code));
    if (!snap.exists()) return { status: 'not_found' };
    const tag = { id: snap.id, ...snap.data() };
    return { status: tag.status || 'unassigned', tag };
  },

  // ─── MINT (admin) ──────────────────────────────────────────────────

  /**
   * Batch-create `count` unassigned tag docs. Returns the created codes.
   * `getRandomBytes` is injectable for tests.
   */
  mintBatch: async (count, getRandomBytes) => {
    const userEmail = getUserEmail();
    const codes = generateUniqueCodes(count, getRandomBytes);

    // Collision guard against already-persisted codes. Cheap: batches are small
    // and the keyspace is large, so re-rolls are rare.
    const finalCodes = [];
    for (const code of codes) {
      let candidate = code;
      let existing = await getDoc(doc(db, TAGS, candidate));
      while (existing.exists()) {
        [candidate] = generateUniqueCodes(1, getRandomBytes, new Set(finalCodes));
        existing = await getDoc(doc(db, TAGS, candidate));
      }
      finalCodes.push(candidate);
    }

    await Promise.all(
      finalCodes.map((code) =>
        setDoc(doc(db, TAGS, code), {
          status: 'unassigned',
          entityType: null,
          entityId: null,
          retiredAt: null,
          supersededBy: null,
          createdAt: serverTimestamp(),
          createdBy: userEmail,
        })
      )
    );

    await logInventoryAction('tags_minted', null, `${finalCodes.length} tags`);
    return finalCodes;
  },

  // ─── BIND ──────────────────────────────────────────────────────────

  /**
   * Bind an unassigned tag to an entity, permanently. Writes the tag doc and
   * caches `activeTagId` on the entity.
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  bindTag: async ({ code, entityType, entityId }) => {
    const col = ENTITY_COLLECTION[entityType];
    if (!col) return { ok: false, reason: 'bad_entity_type' };

    const resolved = await TagsService.getByCode(code);
    if (resolved.status === 'invalid') return { ok: false, reason: 'invalid_code' };
    if (resolved.status === 'not_found') return { ok: false, reason: 'not_found' };
    if (resolved.status === 'active') return { ok: false, reason: 'already_bound' };
    if (resolved.status === 'retired') return { ok: false, reason: 'retired' };

    const tagId = resolved.tag.id;
    const userEmail = getUserEmail();

    await setDoc(
      doc(db, TAGS, tagId),
      {
        status: 'active',
        entityType,
        entityId,
        boundAt: serverTimestamp(),
        boundBy: userEmail,
      },
      { merge: true }
    );

    await updateDoc(doc(db, col, entityId), {
      activeTagId: tagId,
      updatedAt: new Date().toISOString(),
      updatedBy: userEmail,
    });

    await logInventoryAction('tag_bound', `${entityType}:${entityId}`, tagId);
    return { ok: true };
  },

  // ─── RETIRE & REISSUE (admin) ──────────────────────────────────────

  /**
   * Give an entity a new tag. The entity's current active tag (if any) is
   * retired — never deleted — and points forward to the replacement so a scan
   * of the old label can say "retired; now uses <new>".
   * @returns {{ ok: true } | { ok: false, reason: string }}
   */
  retireAndReissue: async ({ entityType, entityId, newCode }) => {
    const col = ENTITY_COLLECTION[entityType];
    if (!col) return { ok: false, reason: 'bad_entity_type' };

    const newResolved = await TagsService.getByCode(newCode);
    if (newResolved.status === 'invalid') return { ok: false, reason: 'invalid_code' };
    if (newResolved.status === 'not_found') return { ok: false, reason: 'not_found' };
    if (newResolved.status !== 'unassigned') return { ok: false, reason: 'new_tag_unavailable' };

    const entitySnap = await getDoc(doc(db, col, entityId));
    const oldTagId = entitySnap.data()?.activeTagId || null;
    const newTagId = newResolved.tag.id;
    const userEmail = getUserEmail();

    // Bind the new tag first so the entity is never tagless mid-operation.
    await TagsService.bindTag({ code: newTagId, entityType, entityId });

    if (oldTagId && oldTagId !== newTagId) {
      await updateDoc(doc(db, TAGS, oldTagId), {
        status: 'retired',
        retiredAt: serverTimestamp(),
        retiredBy: userEmail,
        supersededBy: newTagId,
      });
      await logInventoryAction('tag_retired', oldTagId, newTagId);
    }

    return { ok: true };
  },
};
