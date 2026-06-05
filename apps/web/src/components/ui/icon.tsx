import type { LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

export function Icon({ icon: Lucide, size = 20, className = '', strokeWidth = 1.75 }: IconProps) {
  return <Lucide size={size} strokeWidth={strokeWidth} className={`yf-icon ${className}`.trim()} aria-hidden />;
}
