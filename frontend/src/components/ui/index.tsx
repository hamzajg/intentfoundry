import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}>(function Button({ className, variant = 'primary', size = 'md', loading, disabled, children, ...props }, ref) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'btn',
        {
          'btn-primary': variant === 'primary',
          'btn-secondary': variant === 'secondary',
          'btn-ghost': variant === 'ghost',
          'btn-danger': variant === 'danger',
          'px-3 py-1.5 text-xs': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  );
});

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(function Input({ className, label, id, ...props }, ref) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <input ref={ref} id={id} className={clsx('input', className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }>(function Textarea({ className, label, id, ...props }, ref) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <textarea
        ref={ref}
        id={id}
        className={clsx('input min-h-[100px] resize-y', className)}
        {...props}
      />
    </div>
  );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string }>(function Select({ className, label, id, children, ...props }, ref) {
  return (
    <div>
      {label && <label htmlFor={id} className="label">{label}</label>}
      <select ref={ref} id={id} className={clsx('input', className)} {...props}>
        {children}
      </select>
    </div>
  );
});

interface BadgeProps {
  variant?: 'amber' | 'success' | 'error' | 'info' | 'neutral';
  children: ReactNode;
  className?: string;
}

export function Badge({ variant = 'amber', children, className }: BadgeProps) {
  return (
    <span className={clsx('badge', { 'badge-amber': variant === 'amber', 'badge-success': variant === 'success', 'badge-error': variant === 'error', 'badge-info': variant === 'info', 'bg-foundry-700 text-foundry-300 border border-foundry-600': variant === 'neutral' }, className)}>
      {children}
    </span>
  );
}

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <svg
      className={clsx('animate-spin', { 'w-4 h-4': size === 'sm', 'w-6 h-6': size === 'md', 'w-8 h-8': size === 'lg' }, className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, children, size = 'md' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={clsx('relative z-10 card-raised w-full mx-4 max-h-[90vh] overflow-auto', { 'max-w-sm': size === 'sm', 'max-w-md': size === 'md', 'max-w-lg': size === 'lg', 'max-w-xl': size === 'xl' })}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-foundry-600">
          <h2 className="text-lg font-semibold font-mono text-foundry-50">{title}</h2>
          <button onClick={onClose} className="text-foundry-400 hover:text-foundry-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-4 text-foundry-400">{icon}</div>}
      <h3 className="text-lg font-medium text-foundry-100">{title}</h3>
      {description && <p className="mt-1 text-sm text-foundry-400">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({ className, children, raised = false, onClick }: { className?: string; children?: ReactNode; raised?: boolean; onClick?: () => void }) {
  return <div className={clsx('card', raised && 'card-raised', className)} onClick={onClick}>{children}</div>;
}

export function Divider({ className }: { className?: string }) {
  return <div className={clsx('divider', className)} />;
}