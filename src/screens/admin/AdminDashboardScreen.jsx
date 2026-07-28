import { useNavigate } from 'react-router-dom';
import {
  Images,
  Award,
  Layout,
  Trophy,
  Users,
  Calendar,
  MessageSquare,
  UserCog,
  Share2,
  ChevronRight,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { AppCard } from '../../components/ui';
import Screen from '../../components/Screen';
import '../screens.css';

const adminModules = [
  { title: 'Gallery', path: '/admin/gallery', icon: Images, permission: 'media', color: '#38BDF8', desc: 'Photos & videos' },
  { title: 'Sponsors', path: '/admin/sponsors', icon: Award, permission: 'board', color: '#A855F7', desc: 'Partners & tiers' },
  { title: 'Home Page', path: '/admin/home', icon: Layout, permission: 'admin', color: '#3B82F6', desc: 'Hero & announcements' },
  { title: 'Achievements', path: '/admin/achievements', icon: Trophy, permission: 'board', color: '#F59E0B', desc: 'Awards & milestones' },
  { title: 'Board', path: '/admin/board', icon: Users, permission: 'board', color: '#EC4899', desc: 'Leadership structure' },
  { title: 'Events', path: '/admin/events', icon: Calendar, permission: 'board', color: '#10B981', desc: 'Schedule & RSVP' },
  { title: 'Messages', path: '/admin/messages', icon: MessageSquare, permission: 'board', color: '#6366F1', desc: 'Inquiries & inbox' },
  { title: 'Team Members', path: '/admin/team-members', icon: UserCog, permission: 'superAdmin', color: '#8B5CF6', desc: 'Roster & permissions' },
  { title: 'Socials', path: '/admin/socials', icon: Share2, permission: 'board', color: '#F472B6', desc: 'Footer & link tree' },
];

export default function AdminDashboardScreen() {
  const navigate = useNavigate();
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const visible = adminModules.filter((m) => hasPermission(m.permission));

  return (
    <Screen title="Admin Dashboard">
      <div className="screen-header">
        <h1 className="page-title">Dashboard Overview</h1>
        <p className="page-subtitle">Select a module to manage platform data and configuration</p>
      </div>

      {visible.length === 0 ? (
        <p className="secondary" style={{ textAlign: 'center', marginTop: 40 }}>
          You don't have access to any admin modules.
        </p>
      ) : (
        <div className="grid-2">
          {visible.map((module) => {
            const Icon = module.icon;
            return (
              <AppCard key={module.path} className="module-card" onClick={() => navigate(module.path)}>
                <div className="module-top">
                  <div
                    className="module-iconbox"
                    style={{ background: `${module.color}15`, borderColor: `${module.color}30` }}
                  >
                    <Icon size={18} color={module.color} />
                  </div>
                  <ChevronRight size={16} color="var(--text-muted)" />
                </div>
                <div>
                  <div className="module-title">{module.title}</div>
                  <div className="module-desc">{module.desc}</div>
                </div>
              </AppCard>
            );
          })}
        </div>
      )}
    </Screen>
  );
}
