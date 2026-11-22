// Sample data for the Employer module. Run with: npm run seed:employer  (run "npm run seed" first; safe to re-run)
//
// Logins created (all fake):  EMPLOYER (existing, owner of Acme Corp) · RECRUITER / recruiter123 (recruiter)
//   VIEWER / viewer123 (viewer) · NIMBUS / nimbus123 (owner of a second company, for tenant-isolation checks)
//   plus 8 demo candidates (CAND1..CAND8, password candidate123).
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const SKILLS = ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'AWS', 'Docker', 'GraphQL', 'Python', 'Kubernetes', 'Redis', 'PyTorch', 'Figma'];

const DEMO = [
  ['Ananya', 'Pillai', 'Senior Full-stack Engineer', 'Senior', 8, 'Chennai', ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'AWS'], 94],
  ['Rahul', 'Kumar', 'Full-stack Engineer', 'Mid', 6, 'Bangalore', ['React', 'Node.js', 'AWS', 'Docker'], 88],
  ['Priya', 'Meena', 'Frontend Engineer', 'Mid', 5, 'Hyderabad', ['React', 'TypeScript', 'GraphQL'], 84],
  ['Vikram', 'Reddy', 'AI / ML Engineer', 'Senior', 7, 'Pune', ['Python', 'PyTorch', 'AWS'], 91],
  ['Divya', 'Thomas', 'Backend Engineer', 'Mid', 4, 'Mumbai', ['Node.js', 'PostgreSQL', 'Redis', 'Docker'], 79],
  ['Karthik', 'Mohan', 'DevOps Engineer', 'Senior', 9, 'Chennai', ['AWS', 'Kubernetes', 'Docker'], 86],
  ['Lavanya', 'Joshi', 'Product Designer', 'Mid', 5, 'Delhi', ['Figma', 'React'], null],
  ['Nikhil', 'Bose', 'Junior Developer', 'Junior', 2, 'Kolkata', ['React', 'Node.js'], null],
];

const q = (db, text, params) => db.query(text, params);

async function main() {
  if ((await pool.query(`SELECT 1 FROM companies WHERE name = 'Acme Corp'`)).rowCount) {
    console.log('Employer sample data already present - nothing to do.');
    return pool.end();
  }
  const owner = (await pool.query(`SELECT id FROM users WHERE username = 'EMPLOYER'`)).rows[0];
  const arjun = (await pool.query(`SELECT p.id, p.user_id FROM candidate_profiles p JOIN users u ON u.id = p.user_id WHERE u.username = 'CANDIDATE'`)).rows[0];
  if (!owner || !arjun) throw new Error('Run "npm run setup-db" and "npm run seed" first.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const hash = (pw) => bcrypt.hashSync(pw, 10);
    const addUser = async (name, username, email, pw, role) =>
      (await q(client, `INSERT INTO users (name, username, email, password_hash, role) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [name, username, email, hash(pw), role])).rows[0].id;

    /* companies and team */
    const acme = (await q(client, `INSERT INTO companies (name, website, industry, headquarters, size, description, plan, trial_ends_at, billing_email)
      VALUES ('Acme Corp','https://acme.example','Software','Bengaluru, India','51-200','Acme builds developer tools used by thousands of teams.','pro', NOW() + INTERVAL '14 days','billing@acmecorp.com') RETURNING id`)).rows[0].id;
    const nimbus = (await q(client, `INSERT INTO companies (name, website, industry, headquarters, size, description, plan, billing_email)
      VALUES ('Nimbus Labs','https://nimbus.example','Cloud','Pune, India','11-50','Nimbus Labs runs cloud infrastructure for startups.','starter','billing@nimbuslabs.com') RETURNING id`)).rows[0].id;
    const nimbusUser = await addUser('Nimbus Admin', 'NIMBUS', 'nimbus@nimbuslabs.com', 'nimbus123', 'employer');
    const recruiter = await addUser('Rhea Recruiter', 'RECRUITER', 'recruiter@acmecorp.com', 'recruiter123', 'employer');
    const viewer = await addUser('Vik Viewer', 'VIEWER', 'viewer@acmecorp.com', 'viewer123', 'employer');
    for (const [c, u, r] of [[acme, owner.id, 'owner'], [acme, recruiter, 'recruiter'], [acme, viewer, 'viewer'], [nimbus, nimbusUser, 'owner']]) {
      await q(client, 'INSERT INTO company_members (company_id, user_id, role) VALUES ($1,$2,$3)', [c, u, r]);
    }

    /* skills + jobs */
    const skill = {};
    for (const s of SKILLS) skill[s] = (await q(client, `INSERT INTO skills (name) VALUES ($1) ON CONFLICT ((LOWER(name))) DO UPDATE SET name = skills.name RETURNING id`, [s])).rows[0].id;
    await q(client, `UPDATE jobs SET company_id = $1, employer_id = $2 WHERE company_name = 'Acme Corp'`, [acme, owner.id]);
    await q(client, `UPDATE jobs SET company_id = $1, employer_id = $2 WHERE company_name = 'Nimbus Labs'`, [nimbus, nimbusUser]);
    const newJob = async (title, status, from, to, skills, level = 'Senior') => {
      const id = (await q(client, `INSERT INTO jobs (employer_id, company_id, company_name, title, description, role_type, commitment, rate_from, rate_to, location, experience_level, status, posted_at)
        VALUES ($1,$2,'Acme Corp',$3,$4,$3,'Contract',$5,$6,'Remote',$7,$8, NOW() - INTERVAL '12 days') RETURNING id`,
        [owner.id, acme, title, `${title} at Acme Corp. You will own projects end to end.`, from, to, level, status])).rows[0].id;
      for (const s of skills) await q(client, 'INSERT INTO job_skills (job_id, skill_id) VALUES ($1,$2)', [id, skill[s]]);
      return id;
    };
    const mlJob = await newJob('AI / ML Engineer', 'active', 70, 110, ['Python', 'PyTorch', 'AWS']);
    const devopsJob = await newJob('DevOps Engineer', 'paused', 60, 90, ['AWS', 'Kubernetes', 'Docker']);
    await newJob('Product Designer', 'draft', 50, 80, ['Figma'], 'Mid');
    const acmeJobs = (await q(client, `SELECT id, title FROM jobs WHERE company_id = $1`, [acme])).rows;
    const jobId = (t) => acmeJobs.find((j) => j.title === t).id;
    const reactJob = jobId('Senior React Developer');
    const nodeJob = jobId('Node.js Backend Engineer');

    /* demo candidates */
    const cand = [];
    for (const [i, [first, last, role, level, years, city, skills, score]] of DEMO.entries()) {
      const uid = await addUser(`${first} ${last}`, `CAND${i + 1}`, `${first}.${last}@example.com`.toLowerCase(), 'candidate123', 'candidate');
      const pid = (await q(client, `INSERT INTO candidate_profiles (user_id, first_name, last_name, phone, headline, primary_role, experience_level, years_experience, location, timezone, availability, onboarding_step, onboarding_completed)
        VALUES ($1,$2,$3,'+91 90000 0000',$4,$5,$6,$7,$8,'Asia/Kolkata','Immediately',6,TRUE) RETURNING id`, [uid, first, last, `${role} with ${years} years of experience`, role, level, years, city])).rows[0].id;
      for (const s of skills) await q(client, `INSERT INTO candidate_skills (candidate_id, skill_id, proficiency) VALUES ($1,$2,'advanced')`, [pid, skill[s]]);
      await q(client, `INSERT INTO candidate_preferences (candidate_id, commitment, min_rate, preferred_rate, timezone, availability) VALUES ($1,'Contract',$2,$3,'Asia/Kolkata','Immediately')`, [pid, 40 + years * 4, 55 + years * 5]);
      if (score) {
        const s = (await q(client, `INSERT INTO interview_sessions (candidate_id, status, overall_score, scoring_status, started_at, completed_at) VALUES ($1,'completed',$2,'scored', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days' + INTERVAL '30 minutes') RETURNING id`, [pid, score])).rows[0].id;
        for (const [cat, delta] of [['technical_depth', 2], ['problem_solving', -1], ['system_design', -3], ['communication', 2]]) {
          await q(client, 'INSERT INTO interview_scores (session_id, category, score) VALUES ($1,$2,$3)', [s, cat, Math.min(100, score + delta)]);
        }
      }
      cand.push({ id: pid, userId: uid });
    }

    /* applications: [candidate index, job, final status, days ago applied, source] */
    const flow = ['applied', 'in_review', 'shortlisted', 'interview_scheduled', 'interviewed', 'offer_received', 'accepted'];
    const apps = [
      [0, reactJob, 'interviewed', 11, 'direct'], [1, reactJob, 'shortlisted', 9, 'referral'], [2, reactJob, 'in_review', 6, 'direct'],
      [4, reactJob, 'applied', 1, 'job_board'], [7, reactJob, 'rejected', 8, 'job_board'],
      [1, nodeJob, 'interview_scheduled', 10, 'direct'], [4, nodeJob, 'accepted', 25, 'direct'], [5, nodeJob, 'in_review', 4, 'referral'],
      [3, mlJob, 'shortlisted', 7, 'ai_search'], [6, mlJob, 'rejected', 5, 'direct'], [0, mlJob, 'applied', 2, 'direct'],
      [5, devopsJob, 'offer_received', 14, 'direct'],
    ];
    const appId = {};
    for (const [ci, job, status, days, source] of apps) {
      const id = (await q(client, `INSERT INTO applications (candidate_id, job_id, status, match_score, source, applied_at, status_changed_at)
        VALUES ($1,$2,$3,$4,$5, NOW() - ($6 || ' days')::interval, NOW() - ($6 || ' days')::interval + INTERVAL '2 days') RETURNING id`,
        [cand[ci].id, job, status, 60 + ((ci * 7 + days) % 40), source, days])).rows[0].id;
      appId[`${ci}:${job}`] = id;
      const path = status === 'rejected' ? ['applied', 'in_review', 'rejected'] : flow.slice(0, flow.indexOf(status) + 1);
      for (const [k, to] of path.entries()) {
        await q(client, `INSERT INTO application_status_history (application_id, from_status, to_status, changed_by, changed_at)
          VALUES ($1,$2,$3,$4, NOW() - ($5 || ' days')::interval + ($6 || ' days')::interval * $7)`,
          [id, k ? path[k - 1] : null, to, k ? owner.id : cand[ci].userId, days, Math.max(0.3, Math.min(2, (days - 1) / path.length)), k]);
      }
    }
    await q(client, `INSERT INTO application_notes (application_id, author_id, note, rating) VALUES ($1,$2,'Strong system design answers. Would hire.',5), ($1,$3,'Good communication.',4)`,
      [appId[`0:${reactJob}`], owner.id, recruiter]);

    /* offers, invitations, contract + payroll for Acme */
    await q(client, `INSERT INTO offers (application_id, sent_by, hourly_rate, commitment, start_date, expires_at, message) VALUES ($1,$2,95,'Contract', CURRENT_DATE + 14, NOW() + INTERVAL '5 days','We would love to have you on the team.')`, [appId[`5:${devopsJob}`], owner.id]);
    const arjunNode = (await q(client, `SELECT id FROM applications WHERE candidate_id = $1 AND job_id = $2`, [arjun.id, nodeJob])).rows[0];
    if (arjunNode) {
      await q(client, `INSERT INTO interview_invitations (application_id, candidate_id, job_id, invited_by, message) VALUES ($1,$2,$3,$4,'Please take the next interview round.')`, [arjunNode.id, arjun.id, nodeJob, owner.id]);
    }
    // The existing sample offer to Arjun (DataWorks) needs an offer record so he can respond to it.
    const dw = (await q(client, `SELECT a.id FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.candidate_id = $1 AND a.status = 'offer_received' AND j.company_name = 'DataWorks'`, [arjun.id])).rows[0];
    if (dw) await q(client, `INSERT INTO offers (application_id, hourly_rate, commitment, start_date, expires_at, message) VALUES ($1,60,'Part-time', CURRENT_DATE + 21, NOW() + INTERVAL '6 days','Offer from DataWorks.')`, [dw.id]);

    const contract = (await q(client, `INSERT INTO contracts (application_id, candidate_id, job_id, employer_id, hourly_rate, start_date, status)
      VALUES ($1,$2,$3,$4,70, CURRENT_DATE - 75,'active') RETURNING id`, [appId[`4:${nodeJob}`], cand[4].id, nodeJob, owner.id])).rows[0].id;
    for (const [n, status] of [[3, 'paid'], [2, 'paid'], [1, 'processing']]) {
      const gross = 70 * 150, fee = gross * 0.1;
      await q(client, `INSERT INTO payments (contract_id, candidate_id, invoice_number, period_start, period_end, hours, gross_amount, fee_amount, net_amount, status, paid_at)
        VALUES ($1,$2,$3, date_trunc('month', CURRENT_DATE) - ($4 || ' months')::interval,
                date_trunc('month', CURRENT_DATE) - ($4 || ' months')::interval + INTERVAL '1 month' - INTERVAL '1 day',
                150,$5,$6,$7,$8::text, CASE WHEN $8::text = 'paid' THEN NOW() - ($4 || ' months')::interval + INTERVAL '5 days' END)`,
        [contract, cand[4].id, `ACME-${new Date().getFullYear()}-00${n}`, n, gross, fee, gross - fee, status]);
    }

    /* talent pool bookmarks and job views */
    await q(client, `INSERT INTO saved_candidates (company_id, candidate_id, saved_by, note) VALUES ($1,$2,$3,'Great fit for the next ML role'), ($1,$4,$3,NULL)`, [acme, cand[3].id, owner.id, cand[0].id]);
    for (const [job, n] of [[reactJob, 60], [nodeJob, 35], [mlJob, 22], [devopsJob, 8]]) {
      await q(client, `INSERT INTO job_views (job_id, candidate_id, viewed_at) SELECT $1, $2, NOW() - (g || ' hours')::interval FROM generate_series(1, $3) g`, [job, cand[0].id, n]);
    }
    await q(client, `INSERT INTO notifications (user_id, type, title, body) VALUES ($1,'application','New applicant','Rahul Kumar applied to Senior React Developer'), ($1,'interview','Interview completed','Ananya Pillai finished an AI interview')`, [owner.id]);

    await client.query('COMMIT');
    console.log('Employer sample data created (Acme Corp, Nimbus Labs, 8 demo candidates).');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((e) => { console.error('Seed failed:', e.message); process.exit(1); });
