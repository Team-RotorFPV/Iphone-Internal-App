import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, ChevronRight, Trash2, Inbox, Plus } from 'lucide-react';
import './ui.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ── Button ── */
export function AppButton({
  children,
  onClick,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  type = 'button',
  className,
  style,
}) {
  const handler = onClick || onPress;
  return (
    <button
      type={type}
      onClick={handler}
      disabled={disabled || loading}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, fullWidth && 'btn-full', className)}
      style={style}
    >
      {loading ? (
        <span className="spinner" />
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}

/* ── Card ── */
export function AppCard({ children, onClick, onPress, variant, elevated = false, className, style, flush }) {
  const handler = onClick || onPress;
  const isElevated = variant ? variant === 'elevated' : elevated;
  const cls = cx('card', isElevated && 'card-elevated', flush && 'card-flush', className);
  if (handler) {
    return (
      <button type="button" className={cls} style={style} onClick={handler}>
        {children}
      </button>
    );
  }
  return (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

/* ── Badge ── */
export function AppBadge({ children, variant = 'default', className, style }) {
  const map = {
    success: 'success', active: 'success', Available: 'success',
    warning: 'warning', Missing: 'warning', inactive: 'warning',
    danger: 'danger', CheckedOut: 'danger',
    accent: 'accent', primary: 'accent', admin: 'accent',
    secondary: 'secondary', superAdmin: 'superAdmin',
  };
  const v = map[variant] || 'default';
  return <span className={cx('badge', `badge-${v}`, className)} style={style}>{children}</span>;
}

/* ── Chip ── */
export function AppChip({ children, label, onClick, onPress, selected = false, icon, className, style }) {
  const handler = onClick || onPress;
  return (
    <button
      type="button"
      onClick={handler}
      className={cx('chip', selected && 'chip-selected', className)}
      style={style}
    >
      {icon}
      {children ?? label}
    </button>
  );
}

/* ── Input ── */
export function AppInput({
  label,
  error,
  leftIcon,
  rightIcon,
  multiline,
  numberOfLines,
  value,
  onChangeText,
  onChange,
  containerStyle,
  className,
  ...props
}) {
  const handleChange = (e) => {
    if (onChangeText) onChangeText(e.target.value);
    if (onChange) onChange(e);
  };
  return (
    <div className="field" style={containerStyle}>
      {label && <label className="field-label">{label}</label>}
      <div className={cx('input-wrap', multiline && 'multiline', error && 'error', className)}>
        {leftIcon}
        {multiline ? (
          <textarea value={value} onChange={handleChange} rows={numberOfLines || 4} {...props} />
        ) : (
          <input value={value} onChange={handleChange} {...props} />
        )}
        {rightIcon}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

/* ── Native select (web convenience, mirrors AppInput styling) ── */
export function AppSelect({ label, value, onChange, children, containerStyle }) {
  return (
    <div className="field" style={containerStyle}>
      {label && <label className="field-label">{label}</label>}
      <select className="input-native" value={value} onChange={onChange}>
        {children}
      </select>
    </div>
  );
}

/* ── Search bar ── */
export function AppSearchBar({ value, onChangeText, placeholder = 'Search...', onClear, style }) {
  const handleClear = () => {
    if (onChangeText) onChangeText('');
    if (onClear) onClear();
  };
  return (
    <div className="searchbar" style={style}>
      <Search size={18} color="var(--text-secondary)" />
      <input
        value={value || ''}
        onChange={(e) => onChangeText && onChangeText(e.target.value)}
        placeholder={placeholder}
      />
      {value && value.length > 0 && (
        <button type="button" className="clear-btn" onClick={handleClear} aria-label="Clear">
          <X size={18} />
        </button>
      )}
    </div>
  );
}

/* ── Section ── */
export function AppSection({
  title,
  subtitle,
  children,
  collapsible = false,
  defaultExpanded = true,
  rightElement,
  style,
  contentStyle,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const hasHeader = title || subtitle || rightElement;
  const Header = collapsible ? 'button' : 'div';
  return (
    <div className="section" style={style}>
      {hasHeader && (
        <Header
          type={collapsible ? 'button' : undefined}
          className="section-header"
          onClick={collapsible ? () => setExpanded((e) => !e) : undefined}
        >
          <div className="titles">
            {collapsible &&
              (expanded ? (
                <ChevronDown size={18} color="var(--text-secondary)" />
              ) : (
                <ChevronRight size={18} color="var(--text-secondary)" />
              ))}
            <div style={{ minWidth: 0 }}>
              {title && <div className="section-title">{title}</div>}
              {subtitle && <div className="section-subtitle">{subtitle}</div>}
            </div>
          </div>
          {rightElement && <div style={{ marginLeft: 12 }}>{rightElement}</div>}
        </Header>
      )}
      {(!collapsible || expanded) && (
        <div className="section-content" style={contentStyle}>
          {children}
        </div>
      )}
    </div>
  );
}

/* ── List item ── */
export function AppListItem({
  title,
  description,
  metadata,
  leftIcon,
  rightElement,
  onPress,
  onClick,
  onDelete,
  showChevron = true,
  style,
}) {
  const handler = onClick || onPress;
  const Tag = handler ? 'button' : 'div';
  return (
    <Tag type={handler ? 'button' : undefined} className="list-item" style={style} onClick={handler}>
      {leftIcon}
      <div className="li-copy">
        <div className="li-header">
          <span className="li-title">{title}</span>
          {metadata && <span className="li-meta">{metadata}</span>}
        </div>
        {description && <div className="li-desc">{description}</div>}
      </div>
      <div className="li-right">
        {rightElement}
        {onDelete && (
          <span
            role="button"
            tabIndex={0}
            className="li-delete"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 size={18} />
          </span>
        )}
        {showChevron && handler && <ChevronRight size={18} color="var(--text-muted)" />}
      </div>
    </Tag>
  );
}

/* ── FAB ── */
export function AppFAB({ onPress, onClick, icon, label, variant = 'accent', style }) {
  const handler = onClick || onPress;
  return (
    <button
      type="button"
      onClick={handler}
      className={cx('fab', variant === 'surface' && 'fab-surface', !label && 'fab-icon-only')}
      style={style}
    >
      {icon || <Plus size={20} strokeWidth={2.5} />}
      {label && <span>{label}</span>}
    </button>
  );
}

/* ── Empty state ── */
export function AppEmptyState({ icon, title = 'No items found', description, message, actionLabel, onAction, style }) {
  const body = description ?? message ?? 'There is nothing to display here yet.';
  return (
    <div className="empty" style={style}>
      <div className="empty-icon">{icon || <Inbox size={42} strokeWidth={1.5} />}</div>
      <div className="empty-title">{title}</div>
      <div className="empty-msg">{body}</div>
      {actionLabel && onAction && (
        <div className="empty-action">
          <AppButton variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </AppButton>
        </div>
      )}
    </div>
  );
}

/* ── Skeleton ── */
export function AppSkeleton({ width = '100%', height = 20, borderRadius = 8, style }) {
  return <div className="skeleton" style={{ width, height, borderRadius, ...style }} />;
}

/* ── Glass surface ── */
export function GlassSurface({ children, variant = 'default', borderRadius = 24, className, style }) {
  return (
    <div
      className={cx('glass', variant === 'clear' && 'glass-clear', className)}
      style={{ borderRadius, ...style }}
    >
      {children}
    </div>
  );
}

/* ── Toggle switch ── */
export function AppToggle({ value, onValueChange, onChange }) {
  const handler = () => {
    if (onValueChange) onValueChange(!value);
    if (onChange) onChange(!value);
  };
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      className={cx('toggle', value && 'toggle-on')}
      onClick={handler}
    >
      <span className="toggle-knob" />
    </button>
  );
}

/* ── Modal (bottom sheet, draggable handle) ── */
export function AppModal({ visible = false, onClose, title, children, footer, style, expanded: expandedProp = false }) {
  const [dragY, setDragY] = useState(0);
  const [expanded, setExpanded] = useState(expandedProp);
  const drag = useRef(null);

  // Reset drag/expand state each time the sheet opens.
  useEffect(() => {
    if (visible) {
      setDragY(0);
      setExpanded(expandedProp);
    }
  }, [visible, expandedProp]);

  if (!visible) return null;

  const onPointerDown = (e) => {
    drag.current = { startY: e.clientY, dy: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const dy = e.clientY - drag.current.startY;
    drag.current.dy = dy;
    // Follow the finger downward; allow a small rubber-band upward.
    setDragY(dy > 0 ? dy : Math.max(dy, -48));
  };
  const onPointerUp = () => {
    const dy = drag.current?.dy || 0;
    drag.current = null;
    if (dy > 120) {
      onClose?.(); // pulled down far enough → dismiss
      return;
    }
    if (dy < -40) setExpanded(true); // pulled up → expand to full height
    else if (dy > 40 && expanded) setExpanded(false); // pulled down → collapse
    setDragY(0);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={cx('modal-sheet', expanded && 'expanded')}
        style={{
          ...style,
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          transition: dragY ? 'none' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-handle"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <span />
        </div>
        {title && (
          <div className="modal-header">
            <span className="modal-title">{title}</span>
            {onClose && (
              <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
                <X size={20} />
              </button>
            )}
          </div>
        )}
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}
