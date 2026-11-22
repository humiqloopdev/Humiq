import { z } from 'zod';
import { pool } from '../db.js';
import { HttpError, parse } from '../middleware/errors.js';
import { ensureCandidateId, refreshProfileScore } from './candidate.service.js';
import { getGroup } from './settings.service.js';

// Fixed question bank for now; swap for an AI question generator later.
const QUESTION_BANK = [
  ['technical_depth', 'Walk me through the most technically challenging system you have built. What were the key decisions?'],
  ['problem_solving', 'Describe a production bug that was hard to diagnose. How did you find the root cause?'],
  ['system_design', 'How would you design a service that must handle ten times its current traffic?'],
  ['communication', 'Explain a complex technical concept to a non-technical stakeholder, as you would in a meeting.'],
  ['technical_depth', 'What trade-offs do you consider when choosing between SQL and NoSQL storage?'],
  ['problem_solving', 'Tell me about a time you had to make a decision with incomplete information. What did you do?'],
  ['system_design', 'How would you design a notification system that must never lose a message?'],
  ['communication', 'Describe a disagreement with a teammate about a technical approach. How was it resolved?'],
  ['technical_depth', 'Which part of your preferred stack do you understand most deeply, and how did you learn it?'],
  ['problem_solving', 'How do you decide when a piece of code is ready to ship?'],
];

// How many of the bank questions a new interview gets is an admin setting (interview.questionsPerRole).
const questionsFor = async () => QUESTION_BANK.slice(0, (await getGroup('interview')).questionsPerRole);

async function ownedSession(candidateId, sessionId) {
  const { rows } = await pool.query('SELECT * FROM interview_sessions WHERE id = $1 AND candidate_id = $2', [sessionId, candidateId]);
  if (!rows[0]) throw new HttpError(404, 'Interview session not found.');
  return rows[0];
}

export async function startInterview(userId, body) {
  const { job_id: jobId } = parse(z.object({ job_id: z.string().uuid().optional() }), body);
  const candidateId = await ensureCandidateId(userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Resume an unfinished session for the same job instead of creating a duplicate.
    const open = await client.query(
      `SELECT id, status FROM interview_sessions
       WHERE candidate_id = $1 AND job_id IS NOT DISTINCT FROM $2 AND status IN ('in_progress','scheduled')
       ORDER BY (status = 'in_progress') DESC, created_at DESC LIMIT 1 FOR UPDATE`,
      [candidateId, jobId ?? null]);
    if (open.rows[0]) {
      const { id, status } = open.rows[0];
      if (status === 'scheduled') {
        await client.query(`UPDATE interview_sessions SET status = 'in_progress', started_at = NOW() WHERE id = $1`, [id]);
      }
      const hasQuestions = await client.query('SELECT 1 FROM interview_questions WHERE session_id = $1 LIMIT 1', [id]);
      if (!hasQuestions.rowCount) {
        for (const [i, [category, text]] of (await questionsFor()).entries()) {
          await client.query(
            'INSERT INTO interview_questions (session_id, position, category, question_text) VALUES ($1,$2,$3,$4)',
            [id, i + 1, category, text]);
        }
      }
      await client.query('COMMIT');
      return getSession(userId, id);
    }

    let applicationId = null;
    if (jobId) {
      const app = await client.query('SELECT id FROM applications WHERE candidate_id = $1 AND job_id = $2', [candidateId, jobId]);
      applicationId = app.rows[0]?.id ?? null;
    }
    const prev = await client.query(
      'SELECT id FROM interview_sessions WHERE candidate_id = $1 AND job_id IS NOT DISTINCT FROM $2 ORDER BY created_at DESC LIMIT 1',
      [candidateId, jobId ?? null]);
    const { rows } = await client.query(
      `INSERT INTO interview_sessions (candidate_id, job_id, application_id, retake_of, status, started_at)
       VALUES ($1,$2,$3,$4,'in_progress',NOW()) RETURNING id, status, started_at`,
      [candidateId, jobId ?? null, applicationId, prev.rows[0]?.id ?? null]);
    for (const [i, [category, text]] of (await questionsFor()).entries()) {
      await client.query(
        'INSERT INTO interview_questions (session_id, position, category, question_text) VALUES ($1,$2,$3,$4)',
        [rows[0].id, i + 1, category, text]);
    }
    await client.query('COMMIT');
    return getSession(userId, rows[0].id);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function getSession(userId, sessionId) {
  const candidateId = await ensureCandidateId(userId);
  const session = await ownedSession(candidateId, sessionId);
  const q = await pool.query(
    `SELECT q.id, q.position, q.category, q.question_text, a.transcript, a.answered_at
     FROM interview_questions q LEFT JOIN interview_answers a ON a.question_id = q.id
     WHERE q.session_id = $1 ORDER BY q.position`, [sessionId]);
  return { ...session, questions: q.rows };
}

export async function submitAnswer(userId, sessionId, body) {
  const { question_id: questionId, transcript } = parse(
    z.object({ question_id: z.string().uuid(), transcript: z.string().trim().min(1).max(10000) }), body);
  const candidateId = await ensureCandidateId(userId);
  const session = await ownedSession(candidateId, sessionId);
  if (session.status !== 'in_progress') throw new HttpError(409, 'This interview is not in progress.');
  const q = await pool.query('SELECT 1 FROM interview_questions WHERE id = $1 AND session_id = $2', [questionId, sessionId]);
  if (!q.rowCount) throw new HttpError(404, 'Question not found in this session.');
  await pool.query(
    `INSERT INTO interview_answers (question_id, transcript) VALUES ($1,$2)
     ON CONFLICT (question_id) DO UPDATE SET transcript = EXCLUDED.transcript, answered_at = NOW()`,
    [questionId, transcript]);
  return { questionId, saved: true };
}

export async function endInterview(userId, sessionId) {
  const candidateId = await ensureCandidateId(userId);
  const session = await ownedSession(candidateId, sessionId);
  if (session.status !== 'in_progress') throw new HttpError(409, 'This interview is not in progress.');
  const counts = await pool.query(
    `SELECT COUNT(q.id) AS total, COUNT(a.id) AS answered FROM interview_questions q
     LEFT JOIN interview_answers a ON a.question_id = q.id WHERE q.session_id = $1`, [sessionId]);
  const answered = +counts.rows[0].answered;
  // Scoring is a placeholder: sessions stay "pending" until an AI scorer writes interview_scores.
  const status = answered === 0 ? 'abandoned' : 'completed';
  await pool.query('UPDATE interview_sessions SET status = $2, completed_at = NOW() WHERE id = $1', [sessionId, status]);
  await refreshProfileScore(candidateId);
  return { id: sessionId, status, answered, total: +counts.rows[0].total, scoringStatus: 'pending' };
}

export async function getResults(userId, sessionId) {
  const candidateId = await ensureCandidateId(userId);
  const s = await ownedSession(candidateId, sessionId);
  const scores = await pool.query('SELECT category, score, feedback FROM interview_scores WHERE session_id = $1 ORDER BY category', [sessionId]);
  return {
    id: s.id, status: s.status, scoringStatus: s.scoring_status,
    overallScore: s.overall_score === null ? null : +s.overall_score,
    scores: scores.rows.map((r) => ({ ...r, score: +r.score })),
  };
}

export async function listInterviews(userId) {
  const candidateId = await ensureCandidateId(userId);
  const { rows } = await pool.query(
    `SELECT i.id, i.status, i.overall_score, i.scoring_status, i.scheduled_at, i.started_at, i.completed_at,
            j.id AS job_id, j.title, j.company_name
     FROM interview_sessions i LEFT JOIN jobs j ON j.id = i.job_id
     WHERE i.candidate_id = $1 ORDER BY COALESCE(i.completed_at, i.started_at, i.scheduled_at, i.created_at) DESC`, [candidateId]);
  return rows.map((r) => ({ ...r, overall_score: r.overall_score === null ? null : +r.overall_score }));
}
