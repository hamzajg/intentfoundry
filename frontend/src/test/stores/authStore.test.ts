import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../stores';

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
    });
  });

  describe('initial state', () => {
    it('should start unauthenticated', () => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
    });
  });

  describe('setTokens', () => {
    it('should set tokens and mark as authenticated', () => {
      useAuthStore.getState().setTokens('access-123', 'refresh-456');
      const state = useAuthStore.getState();
      expect(state.token).toBe('access-123');
      expect(state.refreshToken).toBe('refresh-456');
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('setUser', () => {
    it('should set user when provided', () => {
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      };
      useAuthStore.getState().setUser(user);
      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.isAuthenticated).toBe(true);
    });

    it('should mark unauthenticated when user is null', () => {
      useAuthStore.getState().setUser({
        id: 'user-1',
        email: 'test@example.com',
        full_name: null,
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      });
      useAuthStore.getState().setUser(null);
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    it('should clear all auth state', () => {
      useAuthStore.getState().setTokens('access-123', 'refresh-456');
      useAuthStore.getState().setUser({
        id: 'user-1',
        email: 'test@example.com',
        full_name: 'Test User',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
      });

      useAuthStore.getState().logout();
      const state = useAuthStore.getState();
      expect(state.token).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('persistence config', () => {
    it('should only persist token and refreshToken', () => {
      const state = useAuthStore.getState();
      const store = (useAuthStore as unknown as { persist: { getOptions: () => { partialize: (s: unknown) => unknown } } }).persist.getOptions();
      const partialized = store.partialize(state);
      expect(Object.keys(partialized as object)).toEqual(['token', 'refreshToken']);
    });
  });
});
