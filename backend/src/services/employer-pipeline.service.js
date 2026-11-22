import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { audit, notify } from './audit.js';

// Employer-driven stage moves. "offer_received" only happens by sending an offer and "accepted"
// only when the candidate accepts it, so neither appears here.
const MOVES = {
  applied: ['in_review', 'shortlisted', 'rejected'],
  in_review: ['shortlisted', 'rejected'],
  shortlisted: ['in_review', 'interview_scheduled', 'interviewed', 'rejected'],
  interview_scheduled: ['interviewed', 'shortlisted', 'rejected'],
  interviewed: ['shortlisted', 'rejected'],
  offer_received: ['rejected'],
};
const STAGE_LABEL = {
  applied: 'Applied', in_review: 'Screened', shortlisted: 'Shortlisted', interview_scheduled: 'Interview Scheduled',
  interviewed: 'Interviewed', offer_received: 'Offer Sent', accepted: 'Hired', rejected: 'Rejected', withdrawn: 'Withdrawn',
};

const APP_SELECT = `
  SELECT a.id, a.status, a.match_score, a.source, a.applied_at, a.status_changed_at,
         j.id AS job_id, j.title AS job_title,
         p.id AS candidate_id, p.first_name, p.last_name, p.primary_role, p.experience_level, p.location,
         (SELECT ROUND(AVG(i.overall_score)) FROM interview_sessions i WHERE i.candidate_id = p.id AND i.overall_score IS NOT NULL) AS ai_score
  FROM applications a
  JOIN jobs j ON j.id = a.job_id
  JOIN candidate_profiles p ON p.id = a.candidate_id`;

const shape = (r) => ({
  id: r.id, status: r.status, stage: STAGE_LABEL[r.status], matchScore: r.match_score, source: r.source,
  appliedAt: r.applied_at, statusChangedAt: r.status_changed_at,
  job: { id: r.job_id, title: r.job_title },
  candidate: {
    id: r.candidate_id, name: [r.first_name, r.last_name].filter(Boolean).join(' ') || 'Candidate',
    role: r.primary_role, experience: r.experience_level, location: r.location, aiScore: r.ai_score == null ? null : +r.ai_score,
  },
});

/** Loads an application only if it belongs to the caller's company. */
async function ownedApplication(db, companyId, applicationId, lock = false) {
  const { rows } = await db.query(
    `SELECT a.*, j.title AS job_title, j.company_id, j.rate_to, j.commitment, p.user_id AS candidate_user_id
     FROM applications a JOIN jobs j ON j.id = a.job_id JOIN candidate_profiles p ON p.id = a.candidate_id
     WHERE a.id = $1 AND j.company_id = $2 ${lock ? 'FOR UPDATE OF a' : ''}`, [applicationId, companyId]);
  if (!rows[0]) throw new HttpError(404, 'Application not found.');
  return rows[0];
}

async function setStatus(client, app, to, actorId, note) {
  await client.query(`UPDATE applications SET status = $2, status_changed_at = NOW() WHERE id = $1`, [app.id, to]);
  await client.query(
    `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, note) VALUES ($1,$2,$3,$4,$5)`,
    [app.id, app.status, to, actorId, note ?? null]);
}

async function withTx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/* ── pipeline ────────────────────────────────────────────── */

export async function getPipeline(companyId, query) {
  const jobId = z.string().uuid().optional().parse(query.jobId);
  const { rows } = await pool.query(
    `${APP_SELECT} WHERE j.company_id = $1 AND j.deleted_at IS NULL ${jobId ? 'AND j.id = $2' : ''}
     ORDER BY a.status_changed_at DESC`, jobId ? [companyId, jobId] : [companyId]);
  const applications = rows.map(shape);
  const stages = Object.keys(STAGE_LABEL).map((status) => ({
    status, label: STAGE_LABEL[status], applications: applications.filter((a) => a.status === status),
  }));
  return { stages, total: applications.length };
}

export async function getApplication(companyId, applicationId) {
  const { rows } = await pool.query(`${APP_SELECT} WHERE a.id = $1 AND j.company_id = $2`, [applicationId, companyId]);
  if (!rows[0]) throw new HttpError(404, 'Application not found.');
  const [history, notes, offers] = await Promise.all([
    pool.query(`SELECT from_status, to_status, note, changed_at FROM application_status_history WHERE application_id = $1 ORDER BY changed_at`, [applicationId]),
    pool.query(`SELECT n.id, n.note, n.rating, n.created_at, u.name AS author FROM application_notes n LEFT JOIN users u ON u.id = n.author_id
                WHERE n.application_id = $1 ORDER BY n.created_at DESC`, [applicationId]),
    pool.query(`SELECT id, hourly_rate, start_date, expires_at, status, created_at FROM offers WHERE application_id = $1 ORDER BY created_at DESC`, [applicationId]),
  ]);
  return { ...shape(rows[0]), history: history.rows, notes: notes.rows, offers: offers.rows.map((o) => ({ ...o, hourly_rate: +o.hourly_rate })) };
}

export async function moveApplication(company, userId, applicationId, body) {
  const { status, note } = parse(z.object({
    status: z.enum(['in_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'rejected']),
    note: z.string().trim().max(300).optional(),
  }), body);
  return withTx(async (client) => {
    const app = await ownedApplication(client, company.id, applicationId, true);
    if (!(MOVES[app.status] ?? []).includes(status)) {
      throw new HttpError(409, `An application that is "${STAGE_LABEL[app.status]}" cannot move to "${STAGE_LABEL[status]}".`);
    }
    if (app.status === 'offer_received') {
      await client.query(`UPDATE offers SET status = 'withdrawn', responded_at = NOW() WHERE application_id = $1 AND status = 'sent'`, [app.id]);
    }
    await setStatus(client, app, status, userId, note);
    await audit({ companyId: company.id, actorId: userId, entityType: 'application', entityId: app.id, action: 'application.moved', meta: { from: app.status, to: status } }, client);
    if (status === 'shortlisted' || status === 'rejected') {
      await notify(app.candidate_user_id, 'application',
        status === 'shortlisted' ? 'You were shortlisted' : 'Application update',
        status === 'shortlisted' ? `${app.job_title}: you have been shortlisted.` : `${app.job_title}: the employer decided not to move forward.`, client);
    }
    return { id: app.id, status, stage: STAGE_LABEL[status] };
  });
}

/* ── notes ───────────────────────────────────────────────── */

export async function addNote(company, userId, applicationId, body) {
  const { note, rating } = parse(z.object({ note: z.string().trim().min(1).max(2000), rating: z.number().int().min(1).max(5).optional() }), body);
  await ownedApplication(pool, company.id, applicationId);
  const { rows } = await pool.query(
    `INSERT INTO application_notes (application_id, author_id, note, rating) VALUES ($1,$2,$3,$4) RETURNING id, note, rating, created_at`,
    [applicationId, userId, note, rating ?? null]);
  return rows[0];
}

/* ── interview invitations ───────────────────────────────── */

const inviteSchema = z.object({
  application_id: z.string().uuid().optional(),
  candidate_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  message: z.string().trim().max(500).optional(),
  scheduled_at: z.string().datetime().optional(),
}).refine((b) => b.application_id || (b.candidate_id && b.job_id), { message: 'Provide application_id, or candidate_id and job_id.' });

/** Finds the application for a candidate/job pair, creating a "sourced" one when the candidate never applied. */
async function resolveApplication(client, company, userId, b, status = 'shortlisted') {
  if (b.application_id) return ownedApplication(client, company.id, b.application_id, true);
  const job = (await client.query(`SELECT id, status FROM jobs WHERE id = $1 AND company_id = $2 AND deleted_at IS NULL`, [b.job_id, company.id])).rows[0];
  if (!job) throw new HttpError(404, 'Job not found.');
  const cand = (await client.query('SELECT id, user_id FROM candidate_profiles WHERE id = $1 AND deleted_at IS NULL', [b.candidate_id])).rows[0];
  if (!cand) throw new HttpError(404, 'Candidate not found.');
  const found = (await client.query('SELECT id FROM applications WHERE candidate_id = $1 AND job_id = $2', [b.candidate_id, b.job_id])).rows[0];
  if (found) return ownedApplication(client, company.id, found.id, true);
  const { rows } = await client.query(
    `INSERT INTO applications (candidate_id, job_id, status, source) VALUES ($1,$2,$3,'employer') RETURNING id`, [b.candidate_id, b.job_id, status]);
  await client.query(
    `INSERT INTO application_status_history (application_id, to_status, changed_by, note) VALUES ($1,$2,$3,'Sourced by employer')`, [rows[0].id, status, userId]);
  await audit({ companyId: company.id, actorId: userId, entityType: 'application', entityId: rows[0].id, action: 'application.sourced' }, client);
  await notify(cand.user_id, 'application', 'An employer is interested in you', `${company.name ?? 'An employer'} shortlisted you for a role.`, client);
  return ownedApplication(client, company.id, rows[0].id, true);
}

export async function shortlist(company, userId, body) {
  const b = parse(z.object({ candidate_id: z.string().uuid(), job_id: z.string().uuid() }), body);
  return withTx(async (client) => {
    const app = await resolveApplication(client, company, userId, b);
    if (app.status === 'shortlisted') return { id: app.id, status: 'shortlisted', stage: STAGE_LABEL.shortlisted };
    if (!(MOVES[app.status] ?? []).includes('shortlisted')) throw new HttpError(409, `An application that is "${STAGE_LABEL[app.status]}" cannot be shortlisted.`);
    await setStatus(client, app, 'shortlisted', userId);
    await audit({ companyId: company.id, actorId: userId, entityType: 'application', entityId: app.id, action: 'application.shortlisted' }, client);
    await notify(app.candidate_user_id, 'application', 'You were shortlisted', `${app.job_title}: you have been shortlisted.`, client);
    return { id: app.id, status: 'shortlisted', stage: STAGE_LABEL.shortlisted };
  });
}

export async function inviteToInterview(company, userId, body) {
  const b = parse(inviteSchema, body);
  return withTx(async (client) => {
    const app = await resolveApplication(client, company, userId, b);
    if (['rejected', 'withdrawn', 'accepted', 'offer_received'].includes(app.status)) {
      throw new HttpError(409, `You cannot invite a candidate whose application is "${STAGE_LABEL[app.status]}".`);
    }
    const open = await client.query(`SELECT 1 FROM interview_invitations WHERE application_id = $1 AND status = 'pending' AND expires_at > NOW()`, [app.id]);
    if (open.rowCount) throw new HttpError(409, 'An interview invitation is already pending for this candidate.');
    await client.query(`UPDATE interview_invitations SET status = 'expired' WHERE application_id = $1 AND status = 'pending'`, [app.id]);
    const { rows } = await client.query(
      `INSERT INTO interview_invitations (application_id, candidate_id, job_id, invited_by, message, scheduled_at)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, status, expires_at, scheduled_at`,
      [app.id, app.candidate_id, app.job_id, userId, b.message ?? null, b.scheduled_at ?? null]);
    if (app.status === 'applied' || app.status === 'in_review') await setStatus(client, app, 'shortlisted', userId, 'Invited to interview');
    await audit({ companyId: company.id, actorId: userId, entityType: 'application', entityId: app.id, action: 'interview.invited' }, client);
    await notify(app.candidate_user_id, 'interview', 'Interview invitation', `${app.job_title}: you have been invited to interview.`, client);
    return rows[0];
  });
}

/* ── offers ──────────────────────────────────────────────── */

const offerSchema = z.object({
  application_id: z.string().uuid().optional(),
  candidate_id: z.string().uuid().optional(),
  job_id: z.string().uuid().optional(),
  rate: z.number().positive().max(10000),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expires_in_days: z.number().int().min(1).max(60).default(7),
  message: z.string().trim().max(1000).optional(),
}).refine((b) => b.application_id || (b.candidate_id && b.job_id), { message: 'Provide application_id, or candidate_id and job_id.' });

export async function sendOffer(company, userId, body) {
  const b = parse(offerSchema, body);
  if (!['owner', 'admin'].includes(company.role) && company.role !== 'recruiter') throw new HttpError(403, 'You cannot send offers.');
  return withTx(async (client) => {
    const app = await resolveApplication(client, company, userId, b);
    if (!['shortlisted', 'interview_scheduled', 'interviewed'].includes(app.status)) {
      throw new HttpError(409, `An offer cannot be sent while the application is "${STAGE_LABEL[app.status]}". Shortlist the candidate first.`);
    }
    const { rows } = await client.query(
      `INSERT INTO offers (application_id, sent_by, hourly_rate, commitment, start_date, expires_at, message)
       VALUES ($1,$2,$3,$4,$5, NOW() + ($6 || ' days')::interval, $7) RETURNING id, hourly_rate, start_date, expires_at, status`,
      [app.id, userId, b.rate, app.commitment, b.start_date, b.expires_in_days, b.message ?? null]);
    await setStatus(client, app, 'offer_received', userId, `Offer sent at $${b.rate}/hr`);
    await audit({ companyId: company.id, actorId: userId, entityType: 'offer', entityId: rows[0].id, action: 'offer.sent', meta: { applicationId: app.id, rate: b.rate } }, client);
    await notify(app.candidate_user_id, 'offer', 'You received an offer', `${app.job_title} at $${b.rate}/hr`, client);
    return { ...rows[0], hourly_rate: +rows[0].hourly_rate };
  });
}

/* ── candidate responses (used by the candidate routes) ──── */

export async function respondToInvitation(candidateId, invitationId, accept) {
  return withTx(async (client) => {
    const inv = (await client.query(
      `SELECT i.*, j.title, j.company_id, j.employer_id FROM interview_invitations i JOIN jobs j ON j.id = i.job_id
       WHERE i.id = $1 AND i.candidate_id = $2 FOR UPDATE OF i`, [invitationId, candidateId])).rows[0];
    if (!inv) throw new HttpError(404, 'Invitation not found.');
    if (inv.status !== 'pending') throw new HttpError(409, `This invitation was already ${inv.status}.`);
    if (inv.expires_at < new Date()) {
      await client.query(`UPDATE interview_invitations SET status = 'expired' WHERE id = $1`, [invitationId]);
      throw new HttpError(409, 'This invitation has expired.');
    }
    await client.query(`UPDATE interview_invitations SET status = $2, responded_at = NOW() WHERE id = $1`, [invitationId, accept ? 'accepted' : 'declined']);
    if (accept) {
      const app = (await client.query('SELECT * FROM applications WHERE id = $1 FOR UPDATE', [inv.application_id])).rows[0];
      await client.query(
        `INSERT INTO interview_sessions (candidate_id, job_id, application_id, status, scheduled_at) VALUES ($1,$2,$3,'scheduled',$4)`,
        [candidateId, inv.job_id, inv.application_id, inv.scheduled_at ?? new Date()]);
      if (['applied', 'in_review', 'shortlisted'].includes(app.status)) await setStatus(client, app, 'interview_scheduled', null, 'Candidate accepted the interview');
    }
    if (inv.invited_by) await notify(inv.invited_by, 'interview', accept ? 'Interview accepted' : 'Interview declined', inv.title, client);
    await audit({ companyId: inv.company_id, actorId: null, entityType: 'application', entityId: inv.application_id, action: accept ? 'interview.accepted' : 'interview.declined' }, client);
    return { id: invitationId, status: accept ? 'accepted' : 'declined' };
  });
}

export async function respondToOffer(candidateId, offerId, accept) {
  return withTx(async (client) => {
    const offer = (await client.query(
      `SELECT o.*, a.status AS app_status, a.candidate_id, a.job_id, j.title, j.company_id, j.employer_id
       FROM offers o JOIN applications a ON a.id = o.application_id JOIN jobs j ON j.id = a.job_id
       WHERE o.id = $1 AND a.candidate_id = $2 FOR UPDATE OF o`, [offerId, candidateId])).rows[0];
    if (!offer) throw new HttpError(404, 'Offer not found.');
    if (offer.status !== 'sent') throw new HttpError(409, `This offer was already ${offer.status}.`);
    if (offer.expires_at < new Date()) {
      await client.query(`UPDATE offers SET status = 'expired', responded_at = NOW() WHERE id = $1`, [offerId]);
      throw new HttpError(409, 'This offer has expired.');
    }
    const app = { id: offer.application_id, status: offer.app_status };
    await client.query(`UPDATE offers SET status = $2, responded_at = NOW() WHERE id = $1`, [offerId, accept ? 'accepted' : 'declined']);
    let contractId = null;
    if (accept) {
      await setStatus(client, app, 'accepted', null, 'Candidate accepted the offer');
      const c = await client.query(
        `INSERT INTO contracts (application_id, candidate_id, job_id, employer_id, hourly_rate, start_date, status)
         VALUES ($1,$2,$3,$4,$5,$6, CASE WHEN $6::date <= CURRENT_DATE THEN 'active' ELSE 'pending' END) RETURNING id`,
        [offer.application_id, offer.candidate_id, offer.job_id, offer.sent_by ?? offer.employer_id, offer.hourly_rate, offer.start_date]);
      contractId = c.rows[0].id;
    } else {
      await setStatus(client, app, 'withdrawn', null, 'Candidate declined the offer');
      await client.query(`UPDATE applications SET withdrawn_at = NOW() WHERE id = $1`, [app.id]);
    }
    if (offer.sent_by) await notify(offer.sent_by, 'offer', accept ? 'Offer accepted' : 'Offer declined', offer.title, client);
    await audit({ companyId: offer.company_id, actorId: null, entityType: 'offer', entityId: offerId, action: accept ? 'offer.accepted' : 'offer.declined', meta: { contractId } }, client);
    return { id: offerId, status: accept ? 'accepted' : 'declined', contractId };
  });
}

export async function listCandidateInvitations(candidateId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.status, i.message, i.scheduled_at, i.expires_at, i.created_at, j.id AS job_id, j.title, j.company_name
     FROM interview_invitations i JOIN jobs j ON j.id = i.job_id
     WHERE i.candidate_id = $1 ORDER BY i.created_at DESC`, [candidateId]);
  return rows;
}

export async function listCandidateOffers(candidateId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.status, o.hourly_rate, o.commitment, o.start_date, o.expires_at, o.message, o.created_at,
            a.id AS application_id, j.title, j.company_name
     FROM offers o JOIN applications a ON a.id = o.application_id JOIN jobs j ON j.id = a.job_id
     WHERE a.candidate_id = $1 ORDER BY o.created_at DESC`, [candidateId]);
  return rows.map((r) => ({ ...r, hourly_rate: +r.hourly_rate }));
}
