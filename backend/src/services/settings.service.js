import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit } from './audit.js';

/* Each settings group has a schema (validation) and defaults (used until an admin saves a change). */

const GROUPS = {
  platform: {
    schema: z.object({
      platformName: z.string().trim().min(1).max(60),
      currency: z.string().trim().length(3).toUpperCase(),
      commissionPercent: z.number().min(0).max(50),
      trialDays: z.number().int().min(0).max(90),
      maintenanceMode: z.boolean(),
      emailNotifications: z.boolean(),
      adminTwoFactor: z.boolean(), // saved only: real 2FA is not built yet
    }),
    defaults: { platformName: 'Humiq Loop', currency: 'USD', commissionPercent: 10, trialDays: 14, maintenanceMode: false, emailNotifications: true, adminTwoFactor: false },
  },
  interview: {
    schema: z.object({
      questionsPerRole: z.number().int().min(3).max(10), // the question bank holds 10 questions
      maxDurationMinutes: z.number().int().min(10).max(45),
      maxAnswerMinutes: z.number().int().min(1).max(10),
      aiToolDetection: z.boolean(),
      recordingRetentionDays: z.number().int().min(7).max(365),
      retakePolicy: z.enum(['unlimited', 'one_attempt', 'technical_failures_only']),
      practiceMode: z.boolean(),
    }),
    defaults: { questionsPerRole: 5, maxDurationMinutes: 25, maxAnswerMinutes: 3, aiToolDetection: true, recordingRetentionDays: 90, retakePolicy: 'unlimited', practiceMode: false },
  },
  scoring: {
    schema: z.object({
      weights: z.object({
        technical_depth: z.number().min(0).max(100), communication: z.number().min(0).max(100),
        system_design: z.number().min(0).max(100), problem_solving: z.number().min(0).max(100),
      }).refine((w) => Math.round(Object.values(w).reduce((s, n) => s + n, 0)) === 100, { message: 'Weights must total 100.' }),
      tiers: z.array(z.object({
        tier: z.string().trim().min(1).max(3), min: z.number().min(0).max(100),
        label: z.string().trim().min(1).max(40), visibility: z.string().trim().min(1).max(60),
      })).min(1).max(8),
    }),
    defaults: {
      weights: { technical_depth: 40, communication: 25, system_design: 20, problem_solving: 15 },
      tiers: [
        { tier: 'S', min: 90, label: 'Exceptional', visibility: 'Priority recommended' },
        { tier: 'A', min: 80, label: 'Strong', visibility: 'Recommended' },
        { tier: 'B', min: 70, label: 'Good', visibility: 'Visible with note' },
        { tier: 'C', min: 0, label: 'Below bar', visibility: 'Not surfaced' },
      ],
    },
  },
  llm: {
    schema: z.object({
      model: z.string().trim().min(1).max(80),
      fallbackModel: z.string().trim().max(80),
      temperature: z.number().min(0).max(1),
      maxTokens: z.number().int().min(100).max(8000),
      contextWindow: z.number().int().min(1000).max(2000000),
      monthlyTokenBudget: z.number().int().min(0),
      systemPrompt: z.string().trim().min(10).max(4000),
    }),
    defaults: {
      model: 'gemini-3.1-flash-lite', fallbackModel: '', temperature: 0.7, maxTokens: 800, contextWindow: 200000,
      monthlyTokenBudget: 200000000,
      systemPrompt: 'You are a professional AI interviewer evaluating candidates for technical roles. Ask structured questions covering technical expertise, communication clarity, system design thinking and problem-solving ability. Maintain a professional and encouraging tone.',
    },
  },
};

export const GROUP_KEYS = Object.keys(GROUPS);

/** Current value of a settings group, falling back to defaults for anything not saved yet. */
export async function getGroup(key) {
  const g = GROUPS[key];
  if (!g) throw new HttpError(404, 'Unknown settings group.');
  const { rows } = await pool.query('SELECT value, updated_at FROM platform_settings WHERE key = $1', [key]);
  return { ...g.defaults, ...(rows[0]?.value ?? {}) };
}

export async function getGroupWithMeta(key) {
  const { rows } = await pool.query('SELECT updated_at FROM platform_settings WHERE key = $1', [key]);
  return { ...(await getGroup(key)), updatedAt: rows[0]?.updated_at ?? null };
}

export async function saveGroup(key, adminId, body) {
  const g = GROUPS[key];
  if (!g) throw new HttpError(404, 'Unknown settings group.');
  const { updatedAt, ...clean } = body ?? {};
  void updatedAt;
  const value = parse(g.schema.partial(), clean);
  if (key === 'scoring' && (value.weights || value.tiers)) {
    // Weights and tiers are validated as a whole, so a partial save must still leave a complete group.
    const merged = parse(g.schema, { ...(await getGroup(key)), ...value });
    Object.assign(value, merged);
  }
  const next = { ...(await getGroup(key)), ...value };
  await pool.query(
    `INSERT INTO platform_settings (key, value, updated_by) VALUES ($1,$2,$3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by`, [key, next, adminId]);
  await audit({ companyId: null, actorId: adminId, entityType: 'settings', action: `settings.${key}.updated`, meta: { fields: Object.keys(value) } });
  return getGroupWithMeta(key);
}

/* ── subscription plans ──────────────────────────────────── */

const planSchema = z.object({
  name: z.string().trim().min(1).max(60),
  priceMonthly: z.number().min(0).nullable(),
  maxRoles: z.number().int().min(0).nullable(),
  features: z.array(z.string().trim().min(1).max(100)).max(20),
  isActive: z.boolean(),
}).partial();

const shapePlan = (r) => ({ code: r.code, name: r.name, priceMonthly: r.price_monthly == null ? null : +r.price_monthly, maxRoles: r.max_roles, features: r.features, isActive: r.is_active });

export async function listPlans() {
  const { rows } = await pool.query(`SELECT * FROM subscription_plans ORDER BY CASE code WHEN 'starter' THEN 1 WHEN 'pro' THEN 2 ELSE 3 END`);
  return rows.map(shapePlan);
}

export async function updatePlan(code, adminId, body) {
  const p = parse(planSchema, body);
  const map = { name: 'name', priceMonthly: 'price_monthly', maxRoles: 'max_roles', features: 'features', isActive: 'is_active' };
  const entries = Object.entries(p).filter(([k]) => map[k]);
  if (!entries.length) throw new HttpError(400, 'Nothing to update.');
  const sets = entries.map(([k], i) => `${map[k]} = $${i + 2}`).join(', ');
  const { rows } = await pool.query(`UPDATE subscription_plans SET ${sets} WHERE code = $1 RETURNING *`, [code, ...entries.map(([, v]) => v)]);
  if (!rows[0]) throw new HttpError(404, 'Plan not found.');
  await audit({ companyId: null, actorId: adminId, entityType: 'plan', action: 'plan.updated', meta: { code, fields: entries.map(([k]) => k) } });
  return shapePlan(rows[0]);
}
