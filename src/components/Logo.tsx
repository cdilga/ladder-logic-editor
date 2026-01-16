/**
 * Ladder Logic Editor Logo
 *
 * Industrial-inspired geometric mark representing a ladder rung with contact symbol.
 * Uses electric amber (#FF9500) for technical, high-visibility aesthetic.
 */

interface LogoProps {
  size?: number;
  className?: string;
  variant?: 'full' | 'icon';
}

export function Logo({ size = 32, className = '', variant = 'icon' }: LogoProps) {
  if (variant === 'icon') {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={{ flexShrink: 0 }}
      >
        {/* Vertical rails */}
        <rect x="4" y="4" width="2.5" height="24" fill="#FF9500" rx="1" />
        <rect x="25.5" y="4" width="2.5" height="24" fill="#FF9500" rx="1" />

        {/* Top horizontal rung */}
        <rect x="6.5" y="9" width="19" height="2" fill="#FF9500" rx="1" />

        {/* Middle rung with contact symbol */}
        <rect x="6.5" y="15" width="6" height="2" fill="#FF9500" rx="1" />

        {/* Contact symbol (normally open) */}
        <rect x="14" y="14" width="1.5" height="4" fill="#FF9500" rx="0.5" />
        <rect x="16.5" y="14" width="1.5" height="4" fill="#FF9500" rx="0.5" />

        {/* Continuation of middle rung */}
        <rect x="19.5" y="15" width="6" height="2" fill="#FF9500" rx="1" />

        {/* Bottom rung */}
        <rect x="6.5" y="21" width="19" height="2" fill="#FF9500" rx="1" />

        {/* Energy indicator dots (adds industrial flair) */}
        <circle cx="11" cy="16" r="1" fill="#FF9500" opacity="0.6" />
        <circle cx="21" cy="16" r="1" fill="#FF9500" opacity="0.6" />
      </svg>
    );
  }

  // Full logo with text
  return (
    <div className={`logo-full ${className}`} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect x="4" y="4" width="2.5" height="24" fill="#FF9500" rx="1" />
        <rect x="25.5" y="4" width="2.5" height="24" fill="#FF9500" rx="1" />
        <rect x="6.5" y="9" width="19" height="2" fill="#FF9500" rx="1" />
        <rect x="6.5" y="15" width="6" height="2" fill="#FF9500" rx="1" />
        <rect x="14" y="14" width="1.5" height="4" fill="#FF9500" rx="0.5" />
        <rect x="16.5" y="14" width="1.5" height="4" fill="#FF9500" rx="0.5" />
        <rect x="19.5" y="15" width="6" height="2" fill="#FF9500" rx="1" />
        <rect x="6.5" y="21" width="19" height="2" fill="#FF9500" rx="1" />
        <circle cx="11" cy="16" r="1" fill="#FF9500" opacity="0.6" />
        <circle cx="21" cy="16" r="1" fill="#FF9500" opacity="0.6" />
      </svg>
      <span
        style={{
          fontFamily: "'IBM Plex Mono', 'SF Mono', 'Consolas', monospace",
          fontSize: `${size * 0.5}px`,
          fontWeight: 600,
          color: '#FF9500',
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
        }}
      >
        LLE
      </span>
    </div>
  );
}
