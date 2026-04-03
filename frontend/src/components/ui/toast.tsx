'use client';

import { useToast } from '@/hooks/use-toast';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "px-4 py-3 rounded-lg shadow-lg border text-sm",
            "animate-in slide-in-from-right-5 fade-in duration-200",
            toast.type === 'success' && "bg-card border-[#3fb950]/35 text-[#3fb950]",
            toast.type === 'error' && "bg-card border-[#f85149]/35 text-[#f85149]",
            toast.type === 'info' && "bg-card border-primary/35 text-primary"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              {toast.title && (
                <div className="font-medium mb-0.5">{toast.title}</div>
              )}
              {toast.description && (
                <div className="text-xs opacity-80">{toast.description}</div>
              )}
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Re-export for convenience
export { useToast, toast } from '@/hooks/use-toast';
