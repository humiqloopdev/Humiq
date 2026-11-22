// src/schemas/index.test.ts
import { describe, it, expect } from 'vitest';
import { loginSchema, signUpSchema } from './index';

describe('schemas', () => {
  it('loginSchema accepts valid input', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'secret' });
    expect(result.success).toBe(true);
  });

  it('loginSchema rejects empty username', () => {
    const result = loginSchema.safeParse({ email: '', password: 'secret' });
    expect(result.success).toBe(false);
  });

  it('signUpSchema enforces minimum password length', () => {
    const result = signUpSchema.safeParse({ name: 'A B', email: 'a@b.com', password: 'short' });
    expect(result.success).toBe(false);
  });
});
