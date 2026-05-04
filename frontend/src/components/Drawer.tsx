import { Drawer as VaulDrawer } from 'vaul';
import clsx from 'clsx';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  children: React.ReactNode;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full',
};

export function Drawer({ open, onClose, title, size = 'md', children }: DrawerProps) {
  return (
    <VaulDrawer.Root open={open} onOpenChange={(open) => !open && onClose()} direction="right">
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <VaulDrawer.Content
          className={clsx(
            'fixed right-0 top-0 z-50 h-full bg-bg-secondary border-l border-border-subtle',
            'flex flex-col shadow-2xl',
            sizeClasses[size]
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
            <VaulDrawer.Title className="text-lg font-semibold text-text-primary">
              {title}
            </VaulDrawer.Title>
            <VaulDrawer.Close className="text-text-tertiary hover:text-text-primary transition-colors p-1">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </VaulDrawer.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {children}
          </div>
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}
