import { useState, useEffect } from 'react';
import { Video, Upload, RotateCcw, FileText, Clock } from 'lucide-react';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { deleteCloudinaryImage, logAdminAction } from '../../services/adminApi';
import { pickAndUploadMedia } from '../../lib/mediaUpload';
import { useAuthStore } from '../../stores/authStore';
import { AppSection, AppInput, AppButton, AppBadge } from '../../components/ui';
import Screen from '../../components/Screen';
import { alertConfirm, toast } from '../../lib/toast';
import '../screens.css';

const EMPTY_SETTINGS = { backgroundVideoUrl: '', aboutUs: '', updatedAt: null, updatedBy: '' };

const isMediaUrl = (value) => {
  if (typeof value !== 'string') return false;
  const n = value.trim().toLowerCase();
  return n.includes('res.cloudinary.com') || n.includes('/video/upload/') || n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.mov');
};

export default function ManageHomeSettingsScreen() {
  const user = useAuthStore((s) => s.user);
  const [homeSettings, setHomeSettings] = useState(EMPTY_SETTINGS);
  const [homeVideoUrl, setHomeVideoUrl] = useState('');
  const [aboutUs, setAboutUs] = useState('');
  const [isSavingAbout, setIsSavingAbout] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSavingVideo, setIsSavingVideo] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'home'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setHomeSettings(data);
          setHomeVideoUrl(typeof data.backgroundVideoUrl === 'string' ? data.backgroundVideoUrl : '');
          setAboutUs(typeof data.aboutUs === 'string' && !isMediaUrl(data.aboutUs) ? data.aboutUs : '');
        } else {
          setHomeSettings(EMPTY_SETTINGS);
          setHomeVideoUrl('');
          setAboutUs('');
        }
      },
      (error) => console.error('Error fetching home settings:', error)
    );
    return () => unsub();
  }, []);

  const handleAboutSubmit = async () => {
    if (isMediaUrl(aboutUs)) {
      toast.error('Please enter About Us copy, not a video or Cloudinary URL.');
      return;
    }
    setIsSavingAbout(true);
    try {
      await setDoc(doc(db, 'settings', 'home'), { aboutUs, updatedAt: serverTimestamp(), updatedBy: user?.email || 'unknown' }, { merge: true });
      await logAdminAction('UPDATE', 'HomeSettings', 'Updated About Us text');
      toast.success('About Us section updated successfully!');
    } catch (error) {
      console.error('Error updating About Us:', error);
      toast.error('Failed to update About Us text.');
    } finally {
      setIsSavingAbout(false);
    }
  };

  const handlePickVideo = async () => {
    setIsUploading(true);
    try {
      const result = await pickAndUploadMedia({ folder: 'home', accept: 'video/*' });
      if (result.canceled) return;
      if (result.ok) setHomeVideoUrl(result.url);
      else toast.error(result.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleHomeVideoSubmit = async () => {
    if (!homeVideoUrl) {
      toast.error('Please provide a video URL or upload a file.');
      return;
    }
    setIsSavingVideo(true);
    try {
      if (homeSettings?.backgroundVideoUrl && homeSettings.backgroundVideoUrl !== homeVideoUrl) {
        await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
      }
      await setDoc(doc(db, 'settings', 'home'), { backgroundVideoUrl: homeVideoUrl, updatedAt: serverTimestamp(), updatedBy: user?.email || 'unknown' }, { merge: true });
      await logAdminAction('UPDATE', 'HomeSettings', 'Updated Home background video');
      toast.success('Home background video updated successfully!');
    } catch (error) {
      console.error('Error updating home video:', error);
      toast.error('Failed to update background video.');
    } finally {
      setIsSavingVideo(false);
    }
  };

  const handleRevertHomeVideo = () => {
    alertConfirm({
      title: 'Revert to Default',
      message: 'Remove the custom background video and revert to the default?',
      onConfirm: async () => {
        setIsSavingVideo(true);
        try {
          if (homeSettings?.backgroundVideoUrl) await deleteCloudinaryImage(homeSettings.backgroundVideoUrl);
          await setDoc(doc(db, 'settings', 'home'), { backgroundVideoUrl: '', updatedAt: serverTimestamp(), updatedBy: user?.email || 'unknown' }, { merge: true });
          setHomeVideoUrl('');
          await logAdminAction('UPDATE', 'HomeSettings', 'Reverted Home background video to default');
          toast.success('Reverted to default background video.');
        } catch (error) {
          console.error('Error reverting home video:', error);
          toast.error('Failed to revert video.');
        } finally {
          setIsSavingVideo(false);
        }
      },
    });
  };

  return (
    <Screen title="Manage Home Settings">
      <AppSection title="Home Page Background Video">
        <div className="row gap-md" style={{ marginBottom: 16 }}>
          <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--accent-muted)' }}>
            <Video size={20} color="#8B5CF6" />
          </div>
          <div className="grow">
            <div className="t-body" style={{ fontWeight: 600 }}>Hero Reel Stream</div>
            <div className="t-caption">Plays automatically in loop on the public landing screen</div>
          </div>
          {!!homeSettings?.backgroundVideoUrl && <AppBadge variant="success">Active</AppBadge>}
        </div>

        <div style={{ background: 'var(--elevated)', padding: 16, borderRadius: 12, border: '1px solid var(--border)', marginBottom: 16 }}>
          <AppButton variant="secondary" icon={<Upload size={16} />} onClick={handlePickVideo} loading={isUploading} disabled={isUploading || isSavingVideo} fullWidth>
            {isUploading ? 'Uploading Video File...' : 'Upload Video File to Cloud Storage'}
          </AppButton>
          <div className="row gap-md" style={{ margin: '14px 0' }}>
            <div className="grow" style={{ height: 1, background: 'var(--border)' }} />
            <span className="t-metadata">OR DIRECT URL</span>
            <div className="grow" style={{ height: 1, background: 'var(--border)' }} />
          </div>
          <AppInput
            label="Cloudinary Stream URL (.mp4 / .webm)"
            value={homeVideoUrl}
            onChangeText={setHomeVideoUrl}
            placeholder="https://res.cloudinary.com/..."
            disabled={isUploading || isSavingVideo}
          />
        </div>

        <div className="row gap-sm">
          {!!homeSettings?.backgroundVideoUrl && (
            <AppButton variant="danger" icon={<RotateCcw size={16} color="#EF4444" />} style={{ flex: 1 }} onClick={handleRevertHomeVideo} disabled={isUploading || isSavingVideo}>
              Revert Default
            </AppButton>
          )}
          <AppButton variant="primary" onClick={handleHomeVideoSubmit} loading={isSavingVideo} disabled={isUploading || isSavingVideo || !homeVideoUrl} style={{ flex: 1 }}>
            Save Video Stream
          </AppButton>
        </div>
      </AppSection>

      <AppSection title="About Us Section & Mission" style={{ marginTop: 18 }}>
        <div className="row gap-md" style={{ marginBottom: 16 }}>
          <div className="icon-well" style={{ width: 44, height: 44, borderRadius: 12, background: '#A855F715' }}>
            <FileText size={20} color="#A855F7" />
          </div>
          <div className="grow">
            <div className="t-body" style={{ fontWeight: 600 }}>Team Narrative</div>
            <div className="t-caption">Displayed below the hero section on the home page</div>
          </div>
        </div>

        <AppInput
          label="About Us Text (Markdown Supported)"
          value={aboutUs}
          onChangeText={setAboutUs}
          multiline
          numberOfLines={8}
          placeholder="Tell visitors about Team Rotor FPV..."
        />
        <AppButton variant="primary" onClick={handleAboutSubmit} loading={isSavingAbout} disabled={isSavingAbout} fullWidth>
          Save About Us Text
        </AppButton>

        {homeSettings?.updatedAt && (
          <div className="meta-line" style={{ justifyContent: 'center', marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <Clock size={14} />
            Last updated: {homeSettings.updatedAt.toDate ? homeSettings.updatedAt.toDate().toLocaleString() : 'Recently'}
            {homeSettings.updatedBy && ` by ${homeSettings.updatedBy}`}
          </div>
        )}
      </AppSection>
    </Screen>
  );
}
