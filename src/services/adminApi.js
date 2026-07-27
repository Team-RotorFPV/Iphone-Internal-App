import { auth, db } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';

// Fall back to the deployed backend rather than localhost so a missing
// VITE_API_URL doesn't silently break every upload / admin call.
export const API_URL = import.meta.env.VITE_API_URL || 'https://team-rotorfpv-website.onrender.com';

const getIdToken = async () => {
  if (!auth.currentUser) {
    throw new Error('Not authenticated. Please sign in again.');
  }
  return await auth.currentUser.getIdToken();
};

export async function apiPost(path, body) {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function uploadFile(file, folder) {
  const idToken = await getIdToken();

  // On the web the browser sets the multipart boundary + content-type itself
  // when we hand it a File/Blob, so we just append it directly.
  const form = new FormData();
  const filename = file?.name || 'upload.jpg';
  form.append('image', file, filename);
  if (folder) form.append('folder', folder);

  const res = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: form,
  });

  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export async function deleteCloudinaryImage(url) {
  if (!url || !url.includes('res.cloudinary.com')) return;
  try {
    const { ok, data } = await apiPost('/api/delete-asset', { url });
    if (!ok) {
      throw new Error(data.error || 'Cloudinary delete failed');
    }
  } catch (error) {
    console.error('deleteCloudinaryImage error:', error);
  }
}

export async function moveCloudinaryImage(url, toFolder) {
  if (!url || !url.includes('res.cloudinary.com')) return url;
  try {
    const { ok, data } = await apiPost('/api/move-asset', { url, toFolder });
    if (ok && data.secure_url) return data.secure_url;
    return url;
  } catch (error) {
    console.error('moveCloudinaryImage error:', error);
    return url;
  }
}

export async function logAdminAction(actionType, targetType, details) {
  try {
    if (!auth.currentUser) return;
    await addDoc(collection(db, 'activity_logs'), {
      userEmail: auth.currentUser.email,
      actionType,
      targetType,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

export async function fetchAdmins() {
  const idToken = await getIdToken();
  const res = await fetch(`${API_URL}/api/admins`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.admins || [];
}

export async function syncUserPermissions(email, selectedTagIds, allTags, currentAdmins) {
  let targetIsAdmin = false;
  let targetIsSuperAdmin = false;

  for (const tagId of selectedTagIds) {
    const tag = allTags.find(t => t.id === tagId);
    if (tag?.grantsAdmin) targetIsAdmin = true;
    if (tag?.grantsSuperAdmin) {
      targetIsAdmin = true;
      targetIsSuperAdmin = true;
    }
  }

  const currentAdminRec = currentAdmins.find(a => a.email === email);
  
  // Safety: Never demote root through this UI
  if (currentAdminRec?.isRoot) return;

  const currentIsAdmin = !!currentAdminRec;
  const currentIsSuperAdmin = currentAdminRec?.isSuperAdmin || false;

  if (targetIsAdmin && !currentIsAdmin) {
    await apiPost('/api/setAdmin', { email });
  } else if (!targetIsAdmin && currentIsAdmin) {
    await apiPost('/api/removeAdmin', { email });
  }

  if (targetIsSuperAdmin && !currentIsSuperAdmin) {
    await apiPost('/api/setSuperAdmin', { email });
  } else if (!targetIsSuperAdmin && currentIsSuperAdmin) {
    await apiPost('/api/removeSuperAdmin', { email });
  }
}
