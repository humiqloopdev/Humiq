// src/store/authStore.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/api/auth/authApi', () => ({
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  logoutAll: vi.fn(),
  me: vi.fn(),
}));

import * as AuthAPI from '@/api/auth/authApi';
import { useAuthStore } from './authStore';
import { queryClient } from '@/lib/queryClient';

const api = vi.mocked(AuthAPI);
const session = (role: 'candidate' | 'employer' | 'admin') => ({
  data: {
    user: { id: 1, name: 'Test User', email: `${role}@example.com`, role },
  },
}) as never;

describe('authStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    useAuthStore.setState({ user: null, loading: false, isCandidate: false, isEmployer: false, isAdmin: false });
  });

  it('logs in and sets the role flags', async () => {
    api.login.mockResolvedValue(session('candidate'));
    const user = await useAuthStore.getState().login('CANDIDATE', 'candidate123');
    expect(api.login).toHaveBeenCalledWith('CANDIDATE', 'candidate123');
    expect(user.role).toBe('candidate');
    expect(useAuthStore.getState().isCandidate).toBe(true);
  });

  it.each(['candidate', 'employer', 'admin'] as const)('sets the right flag for the %s role', async (role) => {
    api.login.mockResolvedValue(session(role));
    await useAuthStore.getState().login('x', 'y');
    const s = useAuthStore.getState();
    expect([s.isCandidate, s.isEmployer, s.isAdmin]).toEqual([role === 'candidate', role === 'employer', role === 'admin']);
  });

  it('rejects bad credentials and signs nobody in', async () => {
    api.login.mockRejectedValue({ response: { status: 401, data: { detail: 'Invalid username or password.' } } });
    await expect(useAuthStore.getState().login('ADMIN', 'wrong')).rejects.toBeTruthy();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('registers through the API and signs the new user in', async () => {
    api.register.mockResolvedValue(session('employer'));
    const user = await useAuthStore.getState().register({ name: 'New Employer', email: 'n@e.com', password: 'password123', role: 'employer' });
    expect(api.register).toHaveBeenCalledWith({ name: 'New Employer', email: 'n@e.com', password: 'password123', role: 'employer' });
    expect(user.role).toBe('employer');
  });

  it('logout ends the session on the server, then clears cached data', async () => {
    api.login.mockResolvedValue(session('admin'));
    api.logout.mockResolvedValue({} as never);
    await useAuthStore.getState().login('ADMIN', 'admin123');
    queryClient.setQueryData(['secret'], 'private data');

    await useAuthStore.getState().logout();

    expect(api.logout).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
    expect(queryClient.getQueryData(['secret'])).toBeUndefined();
  });

  it('logout still signs out locally when the server call fails', async () => {
    api.login.mockResolvedValue(session('candidate'));
    api.logout.mockRejectedValue(new Error('network down'));
    await useAuthStore.getState().login('a', 'b');
    await useAuthStore.getState().logout();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('logout-all signs out locally as well', async () => {
    api.login.mockResolvedValue(session('candidate'));
    api.logoutAll.mockResolvedValue({} as never);
    await useAuthStore.getState().login('a', 'b');
    await useAuthStore.getState().logoutAll();
    expect(api.logoutAll).toHaveBeenCalled();
  });

  it('login clears data cached for the previous user', async () => {
    queryClient.setQueryData(['employer', 'jobs'], ['previous user data']);
    api.login.mockResolvedValue(session('candidate'));
    await useAuthStore.getState().login('a', 'b');
    expect(queryClient.getQueryData(['employer', 'jobs'])).toBeUndefined();
  });

  describe('restoreSession', () => {
    it('loads the user behind the session cookie', async () => {
      api.me.mockResolvedValue({ data: { id: 3, name: 'Arjun', email: 'a@e.com', role: 'candidate' } } as never);
      await useAuthStore.getState().restoreSession();
      expect(useAuthStore.getState().user?.role).toBe('candidate');
      expect(useAuthStore.getState().isCandidate).toBe(true);
    });

    it('leaves nobody signed in when there is no session', async () => {
      api.me.mockRejectedValue({ response: { status: 401 } });
      await useAuthStore.getState().restoreSession();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().loading).toBe(false);
    });
  });
});
