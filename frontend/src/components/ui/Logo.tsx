interface LogoProps {
  className?: string;
}

export function LogoIcon({ className = 'h-7 w-7' }: LogoProps) {
  return (
    <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <ellipse cx="25" cy="32" rx="11" ry="16" stroke="currentColor" strokeWidth="4" fill="none" />
      <ellipse cx="39" cy="32" rx="11" ry="16" stroke="currentColor" strokeWidth="4" fill="none" />
    </svg>
  );
}

export function LogoFull({ className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <LogoIcon className="h-7 w-7" />
      <span className="text-lg font-bold tracking-tight">Eugene Intelligence</span>
    </div>
  );
}
