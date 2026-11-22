import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import * as core from '../services/admin-core.service.js';
import * as ops from '../services/admin-ops.service.js';
import * as settings from '../services/settings.service.js';

const router = Router();
router.use('/admin', requireAuth, requireRole('admin'));

const uid = (req) => req.auth.sub;
// `{/}` makes the trailing slash optional, matching the URLs the frontend calls.
const p = (route) => `/admin${route}{/}`;

router.get(p('/overview'), async (_req, res) => res.json(await core.getOverview()));

/* users */
router.get(p('/users'), async (req, res) => res.json(await core.listUsers(req.query)));
router.get(p('/users/export'), async (req, res) => {
  const csv = await core.exportUsersCsv(req.query);
  res.type('text/csv').attachment('users.csv').send(csv);
});
router.get(p('/users/:id'), async (req, res) => res.json(await core.getUser(req.params.id)));
router.patch(p('/users/:id'), async (req, res) => res.json(await core.updateUser(uid(req), req.params.id, req.body)));

/* employers */
router.get(p('/employers'), async (req, res) => res.json(await core.listEmployers(req.query)));
router.get(p('/employers/:id'), async (req, res) => res.json(await core.getEmployer(req.params.id)));
router.post(p('/employers/:id/kyc'), async (req, res) => res.json(await core.setKyc(uid(req), req.params.id, req.body)));
router.post(p('/employers/:id/plan'), async (req, res) => res.json(await core.setPlan(uid(req), req.params.id, req.body)));

/* jobs */
router.get(p('/jobs'), async (req, res) => res.json(await core.listJobs(req.query)));
router.post(p('/jobs/:id/moderate'), async (req, res) => res.json(await core.moderateJob(uid(req), req.params.id, req.body)));

/* settings groups */
const group = (route, key) => {
  router.get(p(route), async (_req, res) => res.json(await settings.getGroupWithMeta(key)));
  router.put(p(route), async (req, res) => res.json(await settings.saveGroup(key, uid(req), req.body)));
};
group('/settings', 'platform');
group('/interview-config', 'interview');
group('/scoring-model', 'scoring');
group('/llm-settings', 'llm');
router.get(p('/settings/plans'), async (_req, res) => res.json(await settings.listPlans()));
router.patch(p('/settings/plans/:code'), async (req, res) => res.json(await settings.updatePlan(req.params.code, uid(req), req.body)));
router.get(p('/llm-settings/token-usage'), async (_req, res) => res.json(await ops.getTokenUsage()));

/* interviews */
router.get(p('/interviews/flagged'), async (req, res) => res.json(await ops.listFlags(req.query)));
router.post(p('/interviews/:id/resolve'), async (req, res) => res.json(await ops.resolveFlag(uid(req), req.params.id, req.body)));

/* payroll & billing */
router.get(p('/transactions'), async (req, res) => res.json(await ops.getFinance(req.query)));
router.post(p('/payroll/run'), async (req, res) => res.status(201).json(await ops.runPayroll(uid(req))));
router.get(p('/billing/disputes'), async (req, res) => res.json(await ops.listDisputes(req.query)));
router.post(p('/billing/disputes/:id/resolve'), async (req, res) => res.json(await ops.resolveDispute(uid(req), req.params.id, req.body)));

/* compliance */
router.get(p('/compliance'), async (_req, res) => res.json(await ops.getCompliance()));
router.get(p('/compliance/deletions'), async (req, res) => res.json(await ops.listDeletions(req.query)));
router.post(p('/compliance/deletions/:id/process'), async (req, res) => res.json(await ops.processDeletion(uid(req), req.params.id)));
router.get(p('/compliance/audit'), async (req, res) => res.json(await ops.listAudit(req.query)));

export default router;
