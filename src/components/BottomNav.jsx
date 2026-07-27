import { useNavigate, useLocation } from 'react-router-dom';
import { Layers, ShieldAlert, User } from 'lucide-react';
import { GlassSurface } from './ui';

const TABS = [
  { key: 'inventory', path: '/inventory', Icon: Layers },
  { key: 'admin', path: '/admin', Icon: ShieldAlert },
  { key: 'profile', path: '/profile', Icon: User },
];

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => location.pathname.startsWith(t.path))
  );

  return (
    <div className="tabbar-wrap">
      <GlassSurface variant="default" borderRadius={31} className="tabbar">
        <div
          className="tabbar-indicator"
          style={{
            width: `calc((100% - 12px) / ${TABS.length})`,
            left: 6,
            transform: `translateX(calc(${activeIndex} * 100%))`,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.18)',
            backdropFilter: 'blur(6px)',
          }}
        />
        {TABS.map(({ key, path, Icon }, i) => {
          const active = i === activeIndex;
          return (
            <button
              key={key}
              type="button"
              className={active ? 'tabbar-item active' : 'tabbar-item'}
              onClick={() => navigate(path)}
              aria-label={key}
            >
              <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            </button>
          );
        })}
      </GlassSurface>
    </div>
  );
}
