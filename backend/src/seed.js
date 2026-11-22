// Sample data for the CANDIDATE user. Run with: npm run seed  (safe to re-run; skips if already seeded)
import { pool } from './db.js';

const SKILLS = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL', 'Python', 'Kubernetes', 'Redis'];

const JOBS = [
  { title: 'Senior React Developer', company: 'Acme Corp', commitment: 'Full-time', from: 55, to: 80, skills: ['React', 'TypeScript', 'GraphQL'], level: 'Senior' },
  { title: 'Node.js Backend Engineer', company: 'Acme Corp', commitment: 'Contract', from: 50, to: 75, skills: ['Node.js', 'PostgreSQL', 'Redis'], level: 'Mid' },
  { title: 'Full Stack Engineer', company: 'Nimbus Labs', commitment: 'Full-time', from: 45, to: 70, skills: ['React', 'Node.js', 'PostgreSQL', 'Docker'], level: 'Mid' },
  { title: 'DevOps Engineer', company: 'CloudNine', commitment: 'Contract', from: 60, to: 90, skills: ['AWS', 'Kubernetes', 'Docker'], level: 'Senior' },
  { title: 'Python Data Engineer', company: 'DataWorks', commitment: 'Part-time', from: 40, to: 65, skills: ['Python', 'PostgreSQL', 'AWS'], level: 'Mid' },
  { title: 'Frontend Engineer', company: 'Pixel & Co', commitment: 'Full-time', from: 40, to: 60, skills: ['React', 'TypeScript'], level: 'Mid' },
  { title: 'Platform Engineer', company: 'Nimbus Labs', commitment: 'Contract', from: 55, to: 75, skills: ['Docker', 'AWS'], level: 'Senior' },
];

// [job index, status, days ago applied]
const APPLICATIONS = [
  [0, 'interview_scheduled', 9], [1, 'shortlisted', 7], [2, 'in_review', 5], [3, 'rejected', 14], [4, 'offer_received', 12],
];
const FLOW = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'offer_received'];

async function main() {
  const user = (await pool.query(`SELECT id, name FROM users WHERE username = 'CANDIDATE'`)).rows[0];
  const employer = (await pool.query(`SELECT id FROM users WHERE username = 'EMPLOYER'`)).rows[0];
  if (!user) throw new Error('Run "npm run setup-db" first (CANDIDATE user missing).');

  const profile = (await pool.query(
    `INSERT INTO candidate_profiles (user_id, first_name, last_name) VALUES ($1,'Arjun','Sharma')
     ON CONFLICT (user_id) DO UPDATE SET first_name = 'Arjun', last_name = 'Sharma' RETURNING id`, [user.id])).rows[0];
  const cid = profile.id;

  if ((await pool.query('SELECT 1 FROM applications WHERE candidate_id = $1', [cid])).rowCount) {
    console.log('Sample data already present - nothing to do.');
    return pool.end();
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE candidate_profiles SET phone='+91 98765 43210', headline='Full-stack engineer', primary_role='Full Stack Developer',
         experience_level='Senior', years_experience=7, location='Bengaluru, India', timezone='Asia/Kolkata',
         availability='Immediately', bio='Seven years building web platforms.', onboarding_step=6, onboarding_completed=TRUE
       WHERE id = $1`, [cid]);
    await client.query(
      `INSERT INTO candidate_preferences (candidate_id, commitment, min_rate, preferred_rate, timezone, availability)
       VALUES ($1,'Contract',45,65,'Asia/Kolkata','Immediately')`, [cid]);
    await client.query(
      `INSERT INTO candidate_certifications (candidate_id, name, issuer, issued_on)
       VALUES ($1,'AWS Certified Developer','Amazon Web Services','2025-03-01')`, [cid]);

    const skillId = {};
    for (const s of SKILLS) {
      skillId[s] = (await client.query(
        `INSERT INTO skills (name) VALUES ($1) ON CONFLICT ((LOWER(name))) DO UPDATE SET name = skills.name RETURNING id`, [s])).rows[0].id;
    }
    for (const s of ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker']) {
      await client.query(`INSERT INTO candidate_skills (candidate_id, skill_id, proficiency) VALUES ($1,$2,'advanced')`, [cid, skillId[s]]);
    }
    await client.query(
      `INSERT INTO candidate_resumes (candidate_id, file_name, file_path, mime_type, file_size, parse_status, parsed_data)
       VALUES ($1,'arjun_sharma_resume.pdf','uploads/resumes/sample.pdf','application/pdf',120000,'parsed',
               '{"skills":["React","TypeScript","Node.js"],"years":7}')`, [cid]);

    const jobIds = [];
    for (const [i, j] of JOBS.entries()) {
      const id = (await client.query(
        `INSERT INTO jobs (employer_id, title, company_name, description, role_type, commitment, rate_from, rate_to,
                           location, experience_level, posted_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Remote',$9, NOW() - ($10 || ' days')::interval) RETURNING id`,
        [employer?.id ?? null, j.title, j.company, `${j.title} at ${j.company}.`, j.title, j.commitment, j.from, j.to, j.level, i + 1])).rows[0].id;
      jobIds.push(id);
      for (const s of j.skills) await client.query('INSERT INTO job_skills (job_id, skill_id) VALUES ($1,$2)', [id, skillId[s]]);
    }

    await client.query('INSERT INTO saved_jobs (candidate_id, job_id) VALUES ($1,$2),($1,$3)', [cid, jobIds[5], jobIds[4]]);

    const appIds = [];
    for (const [ji, status, daysAgo] of APPLICATIONS) {
      const match = (await client.query(
        `SELECT COALESCE(ROUND(100.0 * COUNT(cs.skill_id) / NULLIF(COUNT(js.skill_id), 0)), 0)::int AS m
         FROM job_skills js LEFT JOIN candidate_skills cs ON cs.skill_id = js.skill_id AND cs.candidate_id = $1
         WHERE js.job_id = $2`, [cid, jobIds[ji]])).rows[0].m;
      const app = (await client.query(
        `INSERT INTO applications (candidate_id, job_id, status, match_score, applied_at, status_changed_at)
         VALUES ($1,$2,$3,$4, NOW() - ($5 || ' days')::interval, NOW() - ($5 || ' days')::interval + interval '2 days') RETURNING id`,
        [cid, jobIds[ji], status, match, daysAgo])).rows[0].id;
      appIds.push(app);
      // history: applied -> ... -> current status (rejected branches off after "in_review")
      const path = status === 'rejected' ? ['applied', 'in_review', 'rejected'] : FLOW.slice(0, FLOW.indexOf(status) + 1);
      for (const [k, to] of path.entries()) {
        await client.query(
          `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, changed_at)
           VALUES ($1,$2,$3,$4, NOW() - ($5 || ' days')::interval + ($6 || ' days')::interval)`,
          [app, k ? path[k - 1] : null, to, k ? employer?.id ?? null : user.id, daysAgo, k]);
      }
    }

    // One completed, scored interview + one scheduled
    const scored = (await client.query(
      `INSERT INTO interview_sessions (candidate_id, job_id, application_id, status, overall_score, scoring_status, started_at, completed_at)
       VALUES ($1,$2,$3,'completed',91,'scored', NOW() - interval '3 days', NOW() - interval '3 days' + interval '40 minutes') RETURNING id`,
      [cid, jobIds[0], appIds[0]])).rows[0].id;
    for (const [cat, score] of [['technical_depth', 93], ['problem_solving', 90], ['system_design', 88], ['communication', 93]]) {
      await client.query('INSERT INTO interview_scores (session_id, category, score) VALUES ($1,$2,$3)', [scored, cat, score]);
    }
    await client.query(
      `INSERT INTO interview_sessions (candidate_id, job_id, application_id, status, scheduled_at)
       VALUES ($1,$2,$3,'scheduled', NOW() + interval '2 days')`, [cid, jobIds[1], appIds[1]]);

    // A contract with payment history (from an earlier engagement)
    const oldApp = (await client.query(
      `INSERT INTO applications (candidate_id, job_id, status, match_score, applied_at) VALUES ($1,$2,'accepted',100, NOW() - interval '120 days') RETURNING id`,
      [cid, jobIds[6]])).rows[0].id;
    const contract = (await client.query(
      `INSERT INTO contracts (application_id, candidate_id, job_id, employer_id, hourly_rate, start_date, status)
       VALUES ($1,$2,$3,$4,60, CURRENT_DATE - 100, 'active') RETURNING id`, [oldApp, cid, jobIds[6], employer?.id ?? null])).rows[0].id;
    for (const [n, status] of [[3, 'paid'], [2, 'paid'], [1, 'processing']]) {
      const gross = 60 * 160;
      const fee = gross * 0.1;
      await client.query(
        `INSERT INTO payments (contract_id, candidate_id, invoice_number, period_start, period_end, hours, gross_amount, fee_amount, net_amount, status, paid_at)
         VALUES ($1,$2,$3, date_trunc('month', CURRENT_DATE) - ($4 || ' months')::interval,
                 date_trunc('month', CURRENT_DATE) - ($4 || ' months')::interval + interval '1 month' - interval '1 day',
                 160,$5,$6,$7,$8::text, CASE WHEN $8::text = 'paid' THEN NOW() - ($4 || ' months')::interval + interval '5 days' END)`,
        [contract, cid, `INV-${new Date().getFullYear()}-00${n}`, n, gross, fee, gross - fee, status]);
    }
    await client.query(
      `INSERT INTO payout_methods (candidate_id, method_type, label, account_last4, is_default) VALUES ($1,'bank','HDFC Bank','4821',TRUE)`, [cid]);

    for (const [type, title, body] of [
      ['offer', 'You received an offer', 'Python Data Engineer at DataWorks'],
      ['interview', 'Interview scheduled', 'Node.js Backend Engineer - in 2 days'],
      ['application', 'Application shortlisted', 'Node.js Backend Engineer at Acme Corp'],
    ]) {
      await client.query('INSERT INTO notifications (user_id, type, title, body) VALUES ($1,$2,$3,$4)', [user.id, type, title, body]);
    }
    await client.query('COMMIT');
    console.log('Sample data created for CANDIDATE.');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
