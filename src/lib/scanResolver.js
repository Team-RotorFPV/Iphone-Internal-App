// Pure decision logic for "what does this scan do here?".
//
// Given a tag already resolved via TagsService.getByCode() plus the surface the
// user scanned from, decide the outcome. The screen/hook layer then performs the
// async fetch + navigation + writes — this function stays pure so it is fully
// testable and has no Firestore or navigation dependency.
//
// Since a bound tag is immutable, an active tag never offers "bind" — the only
// two branches that matter (per design Rec 2) are unassigned→bind and
// active→resolve. The cross-folder restriction from the original spec is
// intentionally absent: it was dead logic.

/**
 * @param {{status:string, tag?:object}} resolved  Output of TagsService.getByCode.
 * @param {{surface:'home'|'list'|'folder', containerId?:string}} context
 * @returns {object} a scan-action descriptor (see kinds below).
 */
export const decideScanAction = (resolved, context = {}) => {
  const { surface, containerId } = context;

  switch (resolved?.status) {
    case 'invalid':
      return { kind: 'error', reason: 'invalid' };
    case 'not_found':
      return { kind: 'error', reason: 'not_found' };

    case 'retired':
      return {
        kind: 'retired',
        supersededBy: resolved.tag?.supersededBy || null,
        retiredAt: resolved.tag?.retiredAt || null,
      };

    case 'unassigned':
      // Binding needs a container to bind INTO. A folder binds to a
      // sub-folder/item within it; a list binds to a folder within it. From the
      // home surface there is no container, so we can't bind here.
      if (surface === 'folder' && containerId) {
        return { kind: 'bind', container: { type: 'inventory', id: containerId } };
      }
      if (surface === 'list' && containerId) {
        return { kind: 'bind', container: { type: 'list', id: containerId } };
      }
      return { kind: 'bind_no_context' };

    case 'active': {
      const entity = { type: resolved.tag?.entityType, id: resolved.tag?.entityId };
      const offers = ['navigate', 'hold'];
      // On a folder page, scanning a tag bound to something that isn't THIS
      // folder offers to move it here (§6). Actual "lives elsewhere" is confirmed
      // in the UI, which shows the current location before moving.
      if (surface === 'folder' && containerId && entity.id !== containerId) {
        offers.push('move');
      }
      return { kind: 'resolved', entity, offers };
    }

    default:
      return { kind: 'error', reason: 'unknown' };
  }
};
