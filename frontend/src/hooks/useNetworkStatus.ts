import { useEffect } from 'react';
import { useCanvasStore } from '../stores/canvasStore';

export function useNetworkStatus() {
  const { isOnline, setOnline, syncQueue, processSyncQueue, syncStatus } = useCanvasStore();

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => {
      setOnline(false);
      useCanvasStore.getState().setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Set initial state
    setOnline(navigator.onLine);
    if (navigator.onLine) {
      processSyncQueue();
    } else {
      useCanvasStore.getState().setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && syncQueue.length > 0) {
      processSyncQueue();
    }
  }, [isOnline, syncQueue.length]);

  return { isOnline, syncStatus, pendingChanges: syncQueue.length };
}