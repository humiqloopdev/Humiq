import { pool } from '../db.js';
import { HttpError } from '../middleware/errors.js';

const num = (v) => (v == null ? null : +v);

export async function getDashboard(companyId) {
  const [stats, activity, topJobs] = await Promise.all([
    pool.query(
      `SELECT
         (SELECT COUNT(*) FROM jobs WHERE company_id = $1 AND status = 'active' AND deleted_at IS NULL) AS open_roles,
         (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1
            AND a.status NOT IN ('rejected','withdrawn','accepted')) AS active_pipeline,
         (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1 AND a.status = 'offer_received') AS offers_extended,
         (SELECT COUNT(*) FROM interview_sessions i JOIN jobs j ON j.id = i.job_id WHERE j.company_id = $1
            AND COALESCE(i.completed_at, i.scheduled_at, i.started_at) >= date_trunc('week', NOW())) AS interviews_this_week,
         (SELECT COUNT(*) FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1) AS total_applicants`, [companyId]),
    pool.query(
      `SELECT h.to_status, h.changed_at, a.id AS application_id, j.title,
              TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS candidate
       FROM application_status_history h JOIN applications a ON a.id = h.application_id
       JOIN jobs j ON j.id = a.job_id JOIN candidate_profiles p ON p.id = a.candidate_id
       WHERE j.company_id = $1 ORDER BY h.changed_at DESC LIMIT 8`, [companyId]),
    pool.query(
      `SELECT j.id, j.title, j.status, COUNT(a.id) AS applicants FROM jobs j LEFT JOIN applications a ON a.job_id = j.id
       WHERE j.company_id = $1 AND j.deleted_at IS NULL GROUP BY j.id ORDER BY COUNT(a.id) DESC, j.created_at DESC LIMIT 5`, [companyId]),
  ]);
  const s = stats.rows[0];
  return {
    openRoles: +s.open_roles, activePipeline: +s.active_pipeline, offersExtended: +s.offers_extended,
    interviewsThisWeek: +s.interviews_this_week, totalApplicants: +s.total_applicants,
    recentActivity: activity.rows, topJobs: topJobs.rows.map((r) => ({ ...r, applicants: +r.applicants })),
  };
}

// Each funnel stage counts every application that reached it, using the status history so that a candidate who was
// later rejected still counts for the stages they passed.
const FUNNEL = [
  ['Applied', null],
  ['Screened', ['in_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_received', 'accepted']],
  ['Shortlisted', ['shortlisted', 'interview_scheduled', 'interviewed', 'offer_received', 'accepted']],
  ['Interviewed', ['interviewed', 'offer_received', 'accepted']],
  ['Offer Sent', ['offer_received', 'accepted']],
  ['Hired', ['accepted']],
];

export async function getFunnel(companyId) {
  const applied = (await pool.query(
    'SELECT COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id WHERE j.company_id = $1', [companyId])).rows[0].n;
  const counts = [+applied];
  for (const [, statuses] of FUNNEL.slice(1)) {
    const { rows } = await pool.query(
      `SELECT COUNT(DISTINCT h.application_id) AS n FROM application_status_history h
       JOIN applications a ON a.id = h.application_id JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = $1 AND h.to_status = ANY($2)`, [companyId, statuses]);
    counts.push(+rows[0].n);
  }
  return FUNNEL.map(([label], i) => ({ label, count: counts[i] }));
}

export async function getSources(companyId) {
  const { rows } = await pool.query(
    `SELECT a.source, COUNT(*) AS n FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE j.company_id = $1 GROUP BY a.source ORDER BY n DESC`, [companyId]);
  const total = rows.reduce((s, r) => s + +r.n, 0) || 1;
  return rows.map((r) => ({ source: r.source, count: +r.n, percent: Math.round((100 * +r.n) / total) }));
}

export async function getAnalytics(companyId) {
  const [funnel, sources, kpi, weekly, views] = await Promise.all([
    getFunnel(companyId),
    getSources(companyId),
    pool.query(
      `SELECT
         (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (h.changed_at - a.applied_at)) / 86400)::numeric, 1)
            FROM applications a JOIN jobs j ON j.id = a.job_id
            JOIN application_status_history h ON h.application_id = a.id AND h.to_status = 'accepted'
            WHERE j.company_id = $1) AS avg_days_to_hire,
         (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (h.changed_at - a.applied_at)) / 86400)::numeric, 1)
            FROM applications a JOIN jobs j ON j.id = a.job_id
            JOIN application_status_history h ON h.application_id = a.id AND h.to_status = 'shortlisted'
            WHERE j.company_id = $1) AS avg_days_to_shortlist,
         (SELECT ROUND(AVG(i.overall_score)) FROM interview_sessions i JOIN jobs j ON j.id = i.job_id
            WHERE j.company_id = $1 AND i.overall_score IS NOT NULL) AS avg_ai_score,
         (SELECT COALESCE(SUM(p.gross_amount),0) FROM payments p JOIN contracts c ON c.id = p.contract_id
            JOIN jobs j ON j.id = c.job_id WHERE j.company_id = $1 AND p.period_end >= date_trunc('year', CURRENT_DATE)) AS spend_ytd`, [companyId]),
    pool.query(
      `SELECT to_char(date_trunc('week', a.applied_at), 'Mon DD') AS week, COUNT(*) AS applicants
       FROM applications a JOIN jobs j ON j.id = a.job_id
       WHERE j.company_id = $1 AND a.applied_at >= NOW() - INTERVAL '8 weeks'
       GROUP BY date_trunc('week', a.applied_at) ORDER BY date_trunc('week', a.applied_at)`, [companyId]),
    pool.query(`SELECT COUNT(*) AS n FROM job_views v JOIN jobs j ON j.id = v.job_id WHERE j.company_id = $1`, [companyId]),
  ]);
  const k = kpi.rows[0];
  const applied = funnel[0].count || 0;
  return {
    funnel, sources,
    avgDaysToHire: num(k.avg_days_to_hire), avgDaysToShortlist: num(k.avg_days_to_shortlist),
    avgAiScore: num(k.avg_ai_score), spendYtd: +k.spend_ytd, jobViews: +views.rows[0].n,
    hireRate: applied ? Math.round((100 * funnel[5].count) / applied) : 0,
    weeklyApplicants: weekly.rows.map((r) => ({ week: r.week, applicants: +r.applicants })),
  };
}

export async function getPayroll(companyId) {
  const [rows, contracts] = await Promise.all([
    pool.query(
      `SELECT p.id, p.invoice_number, p.period_start, p.period_end, p.hours, p.gross_amount, p.fee_amount, p.net_amount,
              p.status, p.paid_at, j.title AS role, TRIM(CONCAT(cp.first_name, ' ', cp.last_name)) AS contractor, c.hourly_rate
       FROM payments p JOIN contracts c ON c.id = p.contract_id JOIN jobs j ON j.id = c.job_id
       JOIN candidate_profiles cp ON cp.id = p.candidate_id
       WHERE j.company_id = $1 ORDER BY p.period_end DESC, p.created_at DESC`, [companyId]),
    pool.query(
      `SELECT COUNT(*) FILTER (WHERE c.status = 'active') AS active FROM contracts c JOIN jobs j ON j.id = c.job_id WHERE j.company_id = $1`, [companyId]),
  ]);
  const payments = rows.rows.map((r) => ({ ...r, hours: +r.hours, hourly_rate: +r.hourly_rate, gross_amount: +r.gross_amount, fee_amount: +r.fee_amount, net_amount: +r.net_amount }));
  const sum = (list, key) => list.reduce((s, r) => s + r[key], 0);
  return {
    summary: {
      totalPayroll: sum(payments, 'gross_amount'), platformFees: sum(payments, 'fee_amount'),
      netDisbursed: sum(payments.filter((p) => p.status === 'paid'), 'net_amount'),
      pendingPayments: sum(payments.filter((p) => p.status !== 'paid'), 'net_amount'),
      activeContractors: +contracts.rows[0].active,
    },
    payments,
  };
}

export async function listInterviewResults(companyId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.status, i.overall_score, i.scoring_status, i.completed_at, i.scheduled_at,
            j.id AS job_id, j.title AS job_title, p.id AS candidate_id, TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS candidate
     FROM interview_sessions i JOIN jobs j ON j.id = i.job_id JOIN candidate_profiles p ON p.id = i.candidate_id
     WHERE j.company_id = $1 ORDER BY COALESCE(i.completed_at, i.scheduled_at, i.created_at) DESC`, [companyId]);
  return rows.map((r) => ({ ...r, overall_score: num(r.overall_score) }));
}

export async function getInterviewResult(companyId, sessionId) {
  const s = (await pool.query(
    `SELECT i.*, j.title AS job_title, TRIM(CONCAT(p.first_name, ' ', p.last_name)) AS candidate
     FROM interview_sessions i JOIN jobs j ON j.id = i.job_id JOIN candidate_profiles p ON p.id = i.candidate_id
     WHERE i.id = $1 AND j.company_id = $2`, [sessionId, companyId])).rows[0];
  if (!s) throw new HttpError(404, 'Interview not found.');
  const [scores, answers] = await Promise.all([
    pool.query('SELECT category, score, feedback FROM interview_scores WHERE session_id = $1 ORDER BY category', [sessionId]),
    pool.query(
      `SELECT q.position, q.category, q.question_text, a.transcript FROM interview_questions q
       LEFT JOIN interview_answers a ON a.question_id = q.id WHERE q.session_id = $1 ORDER BY q.position`, [sessionId]),
  ]);
  return {
    id: s.id, status: s.status, scoringStatus: s.scoring_status, overallScore: num(s.overall_score),
    jobTitle: s.job_title, candidate: s.candidate, completedAt: s.completed_at,
    scores: scores.rows.map((r) => ({ ...r, score: +r.score })), answers: answers.rows,
  };
}
