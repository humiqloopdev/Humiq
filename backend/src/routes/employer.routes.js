import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { requireCompany } from '../middleware/company.js';
import * as company from '../services/company.service.js';
import * as jobs from '../services/employer-jobs.service.js';
import * as pipeline from '../services/employer-pipeline.service.js';
import * as talent from '../services/employer-talent.service.js';
import * as insights from '../services/employer-insights.service.js';

const router = Router();
router.use('/employer', requireAuth, requireRole('employer'));

const uid = (req) => req.auth.sub;
// `{/}` makes the trailing slash optional, matching the URLs the frontend calls.
const p = (route) => `/employer${route}{/}`;
const viewer = requireCompany('viewer');
const recruiter = requireCompany('recruiter');
const admin = requireCompany('admin');

/* company & team (profile works before a company exists: it creates one) */
router.get(p('/profile'), async (req, res) => res.json(await company.getProfile(uid(req))));
router.patch(p('/profile'), async (req, res) => res.json(await company.saveProfile(uid(req), req.body)));
router.get(p('/team'), viewer, async (req, res) => res.json(await company.getTeam(req.company.id)));
router.post(p('/team/invite'), admin, async (req, res) => res.status(201).json(await company.inviteMember(req.company, uid(req), req.body)));
router.post(p('/team/accept'), async (req, res) => res.json(await company.acceptInvitation(uid(req), req.body)));
router.delete(p('/team/:id'), admin, async (req, res) => res.json(await company.removeTeamEntry(req.company, uid(req), req.params.id)));

/* jobs */
router.get(p('/jobs'), viewer, async (req, res) => res.json(await jobs.listJobs(req.company.id, req.query)));
router.post(p('/jobs'), recruiter, async (req, res) => res.status(201).json(await jobs.createJob(req.company, uid(req), req.body)));
router.get(p('/jobs/:id'), viewer, async (req, res) => res.json(await jobs.getJob(req.company.id, req.params.id)));
router.patch(p('/jobs/:id'), recruiter, async (req, res) => res.json(await jobs.updateJob(req.company, uid(req), req.params.id, req.body)));
router.delete(p('/jobs/:id'), admin, async (req, res) => res.json(await jobs.deleteJob(req.company, uid(req), req.params.id)));
for (const action of ['activate', 'pause', 'close']) {
  router.post(p(`/jobs/:id/${action}`), recruiter, async (req, res) => res.json(await jobs.changeStatus(req.company, uid(req), req.params.id, action)));
}

/* pipeline */
router.get(p('/pipeline'), viewer, async (req, res) => res.json(await pipeline.getPipeline(req.company.id, req.query)));
router.get(p('/applications/:id'), viewer, async (req, res) => res.json(await pipeline.getApplication(req.company.id, req.params.id)));
router.post(p('/applications/:id/move'), recruiter, async (req, res) => res.json(await pipeline.moveApplication(req.company, uid(req), req.params.id, req.body)));
router.post(p('/applications/:id/notes'), recruiter, async (req, res) => res.status(201).json(await pipeline.addNote(req.company, uid(req), req.params.id, req.body)));
router.post(p('/shortlist'), recruiter, async (req, res) => res.json(await pipeline.shortlist(req.company, uid(req), req.body)));
router.post(p('/interview-invite'), recruiter, async (req, res) => res.status(201).json(await pipeline.inviteToInterview(req.company, uid(req), req.body)));
router.post(p('/offers'), recruiter, async (req, res) => res.status(201).json(await pipeline.sendOffer(req.company, uid(req), req.body)));
// The frontend's "hire" action sends an offer; the hire completes when the candidate accepts it.
router.post(p('/hire'), recruiter, async (req, res) => res.status(201).json(await pipeline.sendOffer(req.company, uid(req), req.body)));

/* talent pool */
router.get(p('/candidates'), viewer, async (req, res) => res.json(await talent.getPool(req.company.id, req.query)));
router.get(p('/candidates/:id'), viewer, async (req, res) => res.json(await talent.getCandidate(req.company.id, req.params.id)));
router.post(p('/candidates/:id/save'), recruiter, async (req, res) => res.status(201).json(await talent.saveCandidate(req.company, uid(req), req.params.id, req.body?.note)));
router.delete(p('/candidates/:id/save'), recruiter, async (req, res) => res.json(await talent.unsaveCandidate(req.company, uid(req), req.params.id)));
router.post(p('/ai-search'), viewer, async (req, res) => res.json(await talent.aiSearch(req.company.id, req.body)));

/* insights */
router.get(p('/dashboard'), viewer, async (req, res) => res.json(await insights.getDashboard(req.company.id)));
router.get(p('/analytics'), viewer, async (req, res) => res.json(await insights.getAnalytics(req.company.id)));
router.get(p('/analytics/funnel'), viewer, async (req, res) => res.json(await insights.getFunnel(req.company.id)));
router.get(p('/analytics/sources'), viewer, async (req, res) => res.json(await insights.getSources(req.company.id)));
router.get(p('/payroll'), viewer, async (req, res) => res.json(await insights.getPayroll(req.company.id)));
router.get(p('/interview-results'), viewer, async (req, res) => res.json(await insights.listInterviewResults(req.company.id)));
router.get(p('/interview-results/:id'), viewer, async (req, res) => res.json(await insights.getInterviewResult(req.company.id, req.params.id)));

export default router;
