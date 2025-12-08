import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`
        bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }: CardProps) {
  return (
    <div
      className={`px-6 py-4 border-b border-[var(--border-color)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <h3 className={`text-lg font-semibold ${className}`}>{children}</h3>
  );
}

export function CardContent({ className = '', children, ...props }: CardProps) {
  return (
    <div className={`px-6 py-4 ${className}`} {...props}>
      {children}
    </div>
  );
}

