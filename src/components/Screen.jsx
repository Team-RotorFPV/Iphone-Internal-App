import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import './shell.css';

/**
 * Standard screen chrome: a sticky top app bar (optional back button + title +
 * right actions) and a scrollable body. Replaces the native stack header.
 */
export default function Screen({
  title,
  showBack = false,
  onBack,
  headerRight,
  children,
  flush = false,
  contentStyle,
}) {
  const navigate = useNavigate();
  const goBack = () => {
    if (onBack) onBack();
    else navigate(-1);
  };

  return (
    <>
      <div className="appbar">
        {showBack && (
          <button type="button" className="appbar-back" onClick={goBack} aria-label="Back">
            <ChevronLeft size={26} />
          </button>
        )}
        <div className="appbar-title">{title}</div>
        {headerRight && <div className="appbar-right">{headerRight}</div>}
      </div>
      <div className="screen-body">
        <div className={flush ? 'screen-content flush' : 'screen-content'} style={contentStyle}>
          {children}
        </div>
      </div>
    </>
  );
}
