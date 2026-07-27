import { uploadFile } from '../services/adminApi';

// ── Cloudinary folder naming ──────────────────────────────────────────────
// The server strips caller-supplied folders down to [a-zA-Z0-9/_-] and then,
// for non-admins, requires the result to equal their own profile folder.
// Keep in sync with sanitizeFolder()/ownProfileFolder() in the backend
// (Team-RotorFPV-Website/server/index.js).
export const sanitizeFolder = (folder) =>
  (folder || '').replace(/[^a-zA-Z0-9/_-]/g, '');

/** The one folder a non-admin is permitted to upload into. */
export const ownProfileFolder = (email) =>
  `users/${sanitizeFolder((email || '').toLowerCase())}`;

/**
 * Build a folder path from arbitrary segments, sanitising each one.
 * e.g. buildFolder('events', 'Upcoming', 'Drone Race 2026')
 *      -> 'events/Upcoming/Drone-Race-2026'
 */
export const buildFolder = (...segments) =>
  segments
    .filter(Boolean)
    .map((seg) =>
      sanitizeFolder(String(seg).trim().replace(/\s+/g, '-'))
        .replace(/-{2,}/g, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('/');

/**
 * Open the OS file picker and resolve with a single File (or null if cancelled).
 * Web replacement for expo-image-picker.
 */
export const pickFile = (accept = 'image/*') =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.onchange = () => {
      const file = input.files && input.files[0] ? input.files[0] : null;
      resolve(file);
      input.remove();
    };
    document.body.appendChild(input);
    input.click();
  });

/**
 * Normalises every possible outcome of an upload into one shape:
 *   { ok, url, width, height, publicId, resourceType, error }
 * @param {File|Blob} file
 */
export const uploadMedia = async (file, folder) => {
  if (!file) {
    return { ok: false, url: null, error: 'No file selected.' };
  }

  const safeFolder = sanitizeFolder(folder);

  try {
    const { ok, data } = await uploadFile(file, safeFolder);

    if (ok && data?.secure_url) {
      return {
        ok: true,
        url: data.secure_url,
        width: data.width ?? null,
        height: data.height ?? null,
        publicId: data.public_id ?? '',
        resourceType: data.resource_type ?? 'image',
        error: null,
      };
    }

    return {
      ok: false,
      url: null,
      error: data?.error || 'The server rejected the upload. Please try again.',
    };
  } catch (err) {
    return {
      ok: false,
      url: null,
      error: err?.message || 'Could not reach the server. Check your connection.',
    };
  }
};

/**
 * Launch the picker and upload in one step.
 * Returns { ok, url, canceled, error, ... }.
 */
export const pickAndUploadMedia = async ({ folder, accept = 'image/*' } = {}) => {
  const file = await pickFile(accept);
  if (!file) {
    return { ok: false, canceled: true, url: null, error: null };
  }
  const uploaded = await uploadMedia(file, folder);
  return { ...uploaded, canceled: false };
};
