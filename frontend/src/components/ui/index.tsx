import { clsx } from 'clsx';
import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
export { Drawer } from '../Drawer';

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

interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;
}

import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toast: Omit<ToastItem, 'id'>) => {
    const id = Math.random().toString(36).slice(2);
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-80">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={clsx(
              'p-4 rounded border shadow-lg bg-foundry-800 animate-slide-in',
              {
                'border-emerald-500/50': toast.type === 'success',
                'border-red-500/50': toast.type === 'error',
                'border-amber-500/50': toast.type === 'warning',
                'border-blue-500/50': toast.type === 'info',
              }
            )}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className={clsx('text-sm font-medium', {
                  'text-emerald-300': toast.type === 'success',
                  'text-red-300': toast.type === 'error',
                  'text-amber-300': toast.type === 'warning',
                  'text-blue-300': toast.type === 'info',
                })}>{toast.title}</div>
                {toast.message && <div className="mt-1 text-xs text-foundry-400">{toast.message}</div>}
              </div>
              <button onClick={() => removeToast(toast.id)} className="text-foundry-400 hover:text-foundry-100 ml-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

export function useApiToast() {
  const { addToast } = useToast();
  return {
    success: (title: string, message?: string) => addToast({ type: 'success', title, message }),
    error: (title: string, message?: string) => addToast({ type: 'error', title, message }),
    info: (title: string, message?: string) => addToast({ type: 'info', title, message }),
    warning: (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    catch: (e: unknown, fallbackTitle = 'Operation failed') => {
      const msg = e && typeof e === 'object' && 'response' in e
        ? ((e as { response?: { data?: { detail?: string } } }).response?.data?.detail)
        : e && typeof e === 'object' && 'message' in e
          ? (e as { message?: string }).message
          : 'An unexpected error occurred';
      addToast({ type: 'error', title: fallbackTitle, message: msg as string });
    },
  };
}