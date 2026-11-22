import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errors.js';
import * as candidate from '../services/candidate.service.js';
import * as jobs from '../services/jobs.service.js';
import * as interviews from '../services/interview.service.js';
import * as hiring from '../services/employer-pipeline.service.js';
import { ensureCandidateId } from '../services/candidate.service.js';

const router = Router();
// Scoped by path so these checks do not run for other roles' routes mounted beside this router.
router.use(['/candidate', '/jobs', '/interview'], requireAuth, requireRole('candidate'));

const uid = (req) => req.auth.sub;
// `{/}` makes the trailing slash optional, matching the URLs the frontend calls.
const p = (route) => `${route}{/}`;

/* resume upload: PDF/DOC/DOCX up to 5 MB, stored outside the web root with a random name */
const RESUME_DIR = path.resolve('uploads/resumes');
fs.mkdirSync(RESUME_DIR, { recursive: true });
const ALLOWED = new Set([
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: RESUME_DIR,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(ALLOWED.has(file.mimetype) ? null : new HttpError(400, 'Only PDF, DOC or DOCX resumes are allowed.'), ALLOWED.has(file.mimetype)),
});

/* profile */
router.get(p('/candidate/profile'), async (req, res) => res.json(await candidate.getProfile(uid(req))));
router.patch(p('/candidate/profile'), async (req, res) => res.json(await candidate.updateProfile(uid(req), req.body)));
router.get(p('/candidate/profile/completeness'), async (req, res) => res.json(await candidate.getProfileCompleteness(uid(req))));
router.post(p('/candidate/resume/upload'), upload.single('resume'), async (req, res) =>
  res.status(201).json(await candidate.saveResume(uid(req), req.file)));
router.get(p('/candidate/resume/parsed'), async (req, res) => res.json(await candidate.getParsedResume(uid(req))));
router.put(p('/candidate/skills'), async (req, res) => res.json(await candidate.replaceSkills(uid(req), req.body)));
router.put(p('/candidate/preferences'), async (req, res) => res.json(await candidate.savePreferences(uid(req), req.body)));

/* dashboard & payments */
router.get(p('/candidate/dashboard'), async (req, res) => res.json(await candidate.getDashboard(uid(req))));
router.get(p('/candidate/payments'), async (req, res) => res.json(await candidate.getPayments(uid(req))));

/* jobs */
router.get(p('/jobs/search'), async (req, res) => res.json(await jobs.searchJobs(uid(req), req.query)));
router.get(p('/candidate/recommended-jobs'), async (req, res) => res.json(await jobs.recommendedJobs(uid(req))));
router.get(p('/candidate/saved-jobs'), async (req, res) => res.json(await jobs.listSavedJobs(uid(req))));
router.get(p('/jobs/:id'), async (req, res) => res.json(await jobs.getJob(uid(req), req.params.id)));
router.post(p('/jobs/:id/apply'), async (req, res) => res.status(201).json(await jobs.applyToJob(uid(req), req.params.id)));
router.post(p('/jobs/:id/save'), async (req, res) => res.status(201).json(await jobs.saveJob(uid(req), req.params.id)));
router.delete(p('/jobs/:id/save'), async (req, res) => res.json(await jobs.unsaveJob(uid(req), req.params.id)));

/* applications */
router.get(p('/candidate/applications'), async (req, res) => res.json(await candidate.listApplications(uid(req))));
router.get(p('/candidate/applications/:id'), async (req, res) => res.json(await candidate.getApplication(uid(req), req.params.id)));
router.delete(p('/candidate/applications/:id'), async (req, res) => res.json(await candidate.withdrawApplication(uid(req), req.params.id)));

/* employer invitations & offers */
const cid = (req) => ensureCandidateId(uid(req));
router.get(p('/candidate/interview-invitations'), async (req, res) => res.json(await hiring.listCandidateInvitations(await cid(req))));
router.post(p('/candidate/interview-invitations/:id/accept'), async (req, res) => res.json(await hiring.respondToInvitation(await cid(req), req.params.id, true)));
router.post(p('/candidate/interview-invitations/:id/decline'), async (req, res) => res.json(await hiring.respondToInvitation(await cid(req), req.params.id, false)));
router.get(p('/candidate/offers'), async (req, res) => res.json(await hiring.listCandidateOffers(await cid(req))));
router.post(p('/candidate/offers/:id/accept'), async (req, res) => res.json(await hiring.respondToOffer(await cid(req), req.params.id, true)));
router.post(p('/candidate/offers/:id/decline'), async (req, res) => res.json(await hiring.respondToOffer(await cid(req), req.params.id, false)));

/* interviews */
router.get(p('/candidate/interviews'), async (req, res) => res.json(await interviews.listInterviews(uid(req))));
router.post(p('/interview/start'), async (req, res) => res.status(201).json(await interviews.startInterview(uid(req), req.body)));
router.get(p('/interview/session/:id'), async (req, res) => res.json(await interviews.getSession(uid(req), req.params.id)));
router.post(p('/interview/session/:id/answer'), async (req, res) => res.status(201).json(await interviews.submitAnswer(uid(req), req.params.id, req.body)));
router.post(p('/interview/session/:id/end'), async (req, res) => res.json(await interviews.endInterview(uid(req), req.params.id)));
router.get(p('/interview/session/:id/results'), async (req, res) => res.json(await interviews.getResults(uid(req), req.params.id)));

export default router;
