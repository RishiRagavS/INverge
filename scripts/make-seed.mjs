// Generates seed.sql with demo members, posts, Q&A, mentor slots and learning content.
// Run:  node scripts/make-seed.mjs   (then: npm run db:seed)
// All demo accounts share one random password saved in demo-password.txt (demo only — never seed a production database you care about)
import { writeFileSync } from 'node:fs';
import { hashPassword } from '../src/lib.js';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';

// Demo password: DEMO_PASSWORD env var, else the one saved in demo-password.txt (git-ignored), else a new random one.
const PWFILE = new URL('../demo-password.txt', import.meta.url);
const gen = () => { const A = 'abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRTUVWXY2346789'; const c = [...randomBytes(16)].map((x) => A[x % A.length]); return [c.slice(0, 4), c.slice(4, 8), c.slice(8, 12), c.slice(12)].map((g) => g.join('')).join('-') + '#7'; };
const PASSWORD = process.env.DEMO_PASSWORD || (existsSync(PWFILE) ? readFileSync(PWFILE, 'utf8').trim() : gen());
if (!existsSync(PWFILE)) writeFileSync(PWFILE, PASSWORD + '\n');
const q = (s) => (s == null ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`);
const NOW = '(CAST(strftime(\'%s\',\'now\') AS INTEGER)*1000)';
const ago = (hours) => `(${NOW} - ${Math.round(hours * 3600000)})`;
const dayAt = (days, hour) => `((CAST(strftime('%s','now','start of day') AS INTEGER) + ${days * 86400 + hour * 3600})*1000)`;

// A tiny valid PDF used as placeholder for seeded documents.
const pdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 66>>stream\nBT /F1 14 Tf 20 60 Td (INverge demo document - placeholder) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF').toString('base64');

const users = [
  // founders
  { n: 'Alpha Founder', r: 'founder', c: 'India', ci: 'Bengaluru', h: 'Building AI triage for rural clinics', b: 'Second-time founder. Alpha Startup helps primary-health clinics in underserved regions prioritise patients with an offline-first triage assistant. Previously led product at a digital-health scale-up.', ind: 'HealthTech,AI / ML', st: 'Seed', sn: 'Alpha Startup', fg: 1500000, tr: '12 clinics live · 40k patient visits · 18% MoM growth', t: 3 },
  { n: 'Bravo Founder', r: 'founder', c: 'Germany', ci: 'Berlin', h: 'Making city power grids smarter, one sensor at a time', b: 'Electrical engineer turned founder. Bravo Startup builds low-cost IoT sensors that help municipal utilities detect transformer failures before blackouts happen.', ind: 'Climate / CleanTech,Hardware / IoT', st: 'Pre-seed', sn: 'Bravo Startup', fg: 600000, tr: '3 pilot cities · 2 LOIs from regional utilities', t: 2 },
  { n: 'Charlie Founder', r: 'founder', c: 'Ghana', ci: 'Accra', h: 'Cross-border payments for African SMEs', b: 'Ex-bank product manager building Charlie Startup: instant, low-fee settlement between African markets for small exporters.', ind: 'Fintech', st: 'Seed', sn: 'Charlie Startup', fg: 2000000, tr: '$1.2M monthly volume · 600 SMEs onboarded', t: 2 },
  { n: 'Delta Founder', r: 'founder', c: 'Mexico', ci: 'Mexico City', h: 'Interactive classrooms for Spanish-speaking teachers', b: 'Former teacher creating Delta Startup, a lesson-building tool that turns curriculum goals into interactive classroom activities.', ind: 'EdTech,Consumer', st: 'Pre-seed', sn: 'Delta Startup', fg: 300000, tr: '1,800 teachers on the waitlist · prototype in 14 schools', t: 1 },
  // investors
  { n: 'Alpha Investor', r: 'investor', c: 'India', ci: 'Mumbai', h: 'Partner at Alpha Demo Fund · backing health & fintech founders', b: 'We write first cheques into founders solving large, under-served problems across South Asia and Africa. 40+ companies, 6 exits.', ind: 'HealthTech,Fintech,AI / ML', stg: 'Pre-seed,Seed', it: 'Venture Capitalist', tmin: 250000, tmax: 1500000, pf: '40+ companies including 3 unicorn-track health platforms.', t: 3 },
  { n: 'Bravo Investor', r: 'investor', c: 'United Kingdom', ci: 'London', h: 'Angel investor · ex-SaaS operator', b: 'Operator-turned-angel. I back technical founders early and like to help with go-to-market and first enterprise sales.', ind: 'SaaS,Fintech,AI / ML', stg: 'Pre-seed,Seed', it: 'Angel Investor', tmin: 25000, tmax: 150000, pf: '22 angel investments, 4 follow-on rounds.', t: 2 },
  { n: 'Charlie Investor', r: 'investor', c: 'Singapore', ci: 'Singapore', h: 'Principal at Bravo Demo Ventures · deep tech & climate', b: 'Meridian invests in hardware-enabled and deep-tech companies across Asia-Pacific and Europe.', ind: 'Climate / CleanTech,DeepTech,Hardware / IoT', stg: 'Seed,Series A', it: 'Venture Capitalist', tmin: 500000, tmax: 3000000, pf: 'Portfolio spans grid tech, battery materials and industrial robotics.', t: 2 },
  { n: 'Delta Investor', r: 'investor', c: 'Nigeria', ci: 'Lagos', h: 'Lead, Charlie Demo Angels · fintech, agri & education', b: 'Leading a 60-member angel syndicate backing African founders at the earliest stages.', ind: 'Fintech,AgriTech,EdTech', stg: 'Pre-seed,Seed', it: 'Angel Group', tmin: 50000, tmax: 400000, pf: '31 syndicate deals since 2021.', t: 1 },
  // mentors
  { n: 'Alpha Mentor', r: 'mentor', c: 'India', ci: 'Hyderabad', h: 'Two-time founder & former CTO · product, tech & fundraising', b: 'I help technical founders go from prototype to product-market fit, and prepare for their first institutional round.', ind: 'AI / ML,SaaS,HealthTech', stg: 'Idea,Pre-seed,Seed', ex: 'Tech,Product,Fundraising', yrs: 15, t: 3 },
  { n: 'Bravo Mentor', r: 'mentor', c: 'Netherlands', ci: 'Amsterdam', h: 'Growth operator · marketing, sales & positioning', b: 'Built go-to-market engines at three European scale-ups. I coach founders on positioning, pricing and their first 100 customers.', ind: 'Consumer,E-commerce,SaaS', stg: 'Pre-seed,Seed,Series A', ex: 'Marketing,Sales,Strategy', yrs: 12, t: 2 },
  { n: 'Charlie Mentor', r: 'mentor', c: 'United States', ci: 'New York', h: 'Fintech CFO & fundraising coach', b: 'Former CFO of two fintech companies and advisor to 30+ early-stage startups on financial models, cap tables and investor readiness.', ind: 'Fintech,Web3', stg: 'Seed,Series A', ex: 'Finance,Fundraising,Legal', yrs: 18, t: 3 },
  { n: 'Delta Mentor', r: 'mentor', c: 'South Africa', ci: 'Cape Town', h: 'Operations & talent for scaling teams', b: 'I help founders build the operating rhythm, hiring plans and culture needed to grow from 5 to 50 people.', ind: 'AgriTech,Climate / CleanTech,Fintech', stg: 'Seed,Series A,Series B+', ex: 'Operations,Talent / HR,Strategy', yrs: 10, t: 1 },
  // unverified demo member (browse-only)
  { n: 'Echo Founder', r: 'founder', c: 'Portugal', ci: 'Lisbon', h: 'Exploring ideas in logistics tech', b: 'Just joined INverge — verification pending.', ind: 'Mobility', st: 'Idea', sn: 'Untitled project', fg: 100000, tr: '', t: 0 },
];

const out = [];
const hash = await hashPassword(PASSWORD, 15000);
users.forEach((u, i) => {
  const email = u.n.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '') + '@inverge.test';
  u.id = i + 1; u.email = email;
  out.push(`INSERT INTO users (id,email,password_hash,role,name,country,city,headline,bio,linkedin_url,email_verified,trust_level,onboarding_step,industries,stages,startup_name,funding_goal,traction,investor_type,ticket_min,ticket_max,portfolio,expertise,years_exp,created_at,last_seen) VALUES (${[
    u.id, q(email), q(hash), q(u.r), q(u.n), q(u.c), q(u.ci), q(u.h), q(u.b), q('https://www.linkedin.com/'), 1, u.t, 6, q(u.ind), q(u.st || u.stg || ''),
    u.sn ? q(u.sn) : 'NULL', u.fg ?? 'NULL', u.tr ? q(u.tr) : 'NULL', u.it ? q(u.it) : 'NULL', u.tmin ?? 'NULL', u.tmax ?? 'NULL', u.pf ? q(u.pf) : 'NULL', q(u.ex || ''), u.yrs ?? 'NULL', ago(24 * (60 - i * 3)), ago(i * 2),
  ].join(',')});`);
});

// Documents (placeholder PDF) matching each trust level.
let fid = 0;
const doc = (u, kind, status) => {
  const id = `seedfile${++fid}`;
  out.push(`INSERT INTO files (id,owner_id,kind,name,mime,size,data,created_at) VALUES ('${id}',${u.id},'doc',${q(kind + '.pdf')},'application/pdf',${Buffer.from(pdf, 'base64').length},'${pdf}',${ago(500)});`);
  out.push(`INSERT INTO documents (user_id,kind,file_id,status,is_public,created_at) VALUES (${u.id},${q(kind)},'${id}',${q(status)},${kind === 'pitch_deck' ? 1 : 0},${ago(480)});`);
};
users.forEach((u) => {
  const proof = { founder: 'registration', investor: 'investment_proof', mentor: 'resume' }[u.r];
  if (u.t >= 1) doc(u, 'gov_id', u.t >= 2 ? 'approved' : 'pending');
  if (u.t >= 2) doc(u, proof, 'approved');
  if (u.r === 'founder' && u.t >= 1) doc(u, 'pitch_deck', 'pending');
});

// Connections (requester, addressee, status)
const conns = [[1, 5, 'accepted'], [1, 10, 'accepted'], [1, 11, 'accepted'], [1, 9, 'accepted'], [5, 3, 'accepted'], [5, 9, 'accepted'], [5, 6, 'accepted'], [9, 2, 'accepted'], [9, 11, 'accepted'], [11, 3, 'accepted'], [11, 6, 'accepted'], [11, 5, 'accepted'], [2, 7, 'accepted'], [2, 10, 'accepted'], [3, 8, 'accepted'], [12, 3, 'accepted'], [12, 8, 'accepted'], [4, 9, 'pending'], [8, 3, 'pending'], [7, 1, 'pending']];
conns.forEach(([a, b, s], i) => out.push(`INSERT INTO connections (requester_id,addressee_id,status,created_at) VALUES (${a},${b},'${s}',${ago(300 - i * 10)});`));

// Posts [user, type, body, hoursAgo, reactionUserIds, comments[[user, text]]]
const posts = [
  [1, 'funding', 'Alpha Startup is opening a $1.5M seed round. 12 clinics live, 40k patient visits, and an 18% MoM growth rate. Looking for health-focused investors who understand last-mile care. Our deck is on my profile for verified investors.', 3, [6, 7, 8, 10, 11, 12, 2, 3], [[5, 'Impressive traction on clinic activation. Would love to see your retention data — sending a message.'], [10, 'Happy to help with your seed narrative. The offline-first angle is your strongest story.'], [9, 'Strong team and a clear wedge. Happy to help with your technical diligence story.']]],
  [5, 'call', 'Alpha Demo Fund is actively looking for pre-seed and seed founders in HealthTech and Fintech across South Asia and Africa. Cheque size $250K–$1.5M. Share a short pitch with traction numbers and we will respond within a week.', 7, [1, 3, 4, 2, 12], [[3, 'Is cross-border payments infrastructure in scope?'], [5, 'Absolutely — especially if you have real volume. Send a pitch via Alignment.'], [1, 'Thanks Alpha Investor — sending a pitch your way shortly.']]],
  [10, 'insight', 'Three questions I ask every founder before their first fundraise: 1) What do you know about your customers that investors do not? 2) What milestone will this round fund? 3) What happens if you raise half? Clear answers beat polished slides.', 11, [1, 2, 3, 4, 5, 6, 7, 12], [[2, 'Number 3 is a great forcing function. Working on it now.'], [1, 'Great list. Saving this for our seed prep.']]],
  [2, 'update', 'Bravo Startup just finished pilot #3: our sensors flagged a failing transformer 11 days before it would have caused an outage. We are now in talks with two regional utilities. Huge thanks to everyone who introduced us.', 20, [7, 10, 11, 1, 12], [[7, 'That is a strong proof point. Let us talk — Meridian is looking at grid tech.']]],
  [3, 'funding', 'Charlie Startup is raising a $2M seed to expand settlement corridors from West Africa to East Africa. We process $1.2M a month for 600 SMEs. Looking for fintech investors with African market experience.', 26, [6, 8, 11, 12], [[5, 'Charlie Startup looks interesting — let us talk about corridors and unit economics.'], [11, 'Happy to review your FX and settlement cost model before you raise.']]],
  [11, 'insight', 'Cap table hygiene tip: model your next two rounds BEFORE you sign a SAFE. Founders are often surprised how much dilution stacks up across notes. A 20-minute spreadsheet exercise saves months of regret.', 30, [1, 2, 3, 4, 6, 7, 8], [[4, 'Is there a template you recommend?'], [11, 'Yes — see the Learning Hub for a simple dilution model outline.'], [1, 'Bookmarked. This is exactly what we are modelling this month.']]],
  [7, 'call', 'Bravo Demo Ventures is reviewing seed and Series A deals in grid technology, battery materials and industrial automation. If you are building hardware with software leverage, we would like to hear from you.', 40, [2, 1], []],
  [4, 'update', 'Delta Startup reached 1,800 teachers on the waitlist this week — all organic, from teacher WhatsApp groups. Now looking for a mentor in marketing and community building.', 48, [10, 9, 12], [[10, 'Community-led growth is a great fit for your audience. Book a slot with me in the Mentor’s Room.'], [9, 'Congratulations — organic traction like that is a strong signal.']]],
  [9, 'learning', 'Prototype to product-market fit checklist: weekly user interviews, one core metric, a retention curve that flattens, and a paying customer who would be upset if you disappeared. If you cannot tick three of four, keep building.', 55, [1, 2, 3, 4, 6, 10], []],
  [12, 'update', 'Just wrapped a two-day operations workshop with four early-stage teams. The most common gap: no weekly operating rhythm. A simple Monday priorities / Friday review loop changed everything for them.', 70, [1, 3, 7, 8], []],
  [8, 'call', 'Charlie Demo Angels is opening a new syndicate round for early-stage fintech and agri-tech founders. Cheques from $50K. Verified founders welcome to pitch through INverge.', 80, [3, 4, 6], []],
  [1, 'update', 'Milestone: Alpha Startup crossed 40,000 patient visits assisted. A nurse in a clinic with no internet told us the offline mode saved her an hour a day. That is why we build.', 100, [6, 10, 11, 12, 2, 3, 4], [[9, 'Offline-first is genuinely hard. Well done to the whole team.']]],
  [5, 'learning', 'What I look for in a first meeting: a founder who can explain the problem in one sentence, name three real customers, and tell me what they would do with the money in 18 months.', 120, [1, 2, 3, 4, 10, 11], []],
  [10, 'learning', 'New in the Learning Hub: a guide to your first 100 customers. Spoiler — it is mostly conversations, not campaigns.', 140, [1, 4, 2], []],
];
posts.forEach(([u, type, body, h, likes, comments], i) => {
  const pid = i + 1;
  out.push(`INSERT INTO posts (id,user_id,type,body,created_at) VALUES (${pid},${u},${q(type)},${q(body)},${ago(h)});`);
  likes.forEach((l) => out.push(`INSERT OR IGNORE INTO post_reactions (post_id,user_id) VALUES (${pid},${l});`));
  comments.forEach(([cu, text], j) => out.push(`INSERT INTO comments (post_id,user_id,body,created_at) VALUES (${pid},${cu},${q(text)},${ago(h - 0.5 - j * 0.3)});`));
});

// Mentor slots, completed sessions and reviews
const mentors = users.filter((u) => u.r === 'mentor');
let slot = 0, booking = 0;
mentors.forEach((m, mi) => {
  [1, 2, 3, 5, 6, 8].forEach((d, k) => { slot++; out.push(`INSERT INTO mentor_slots (id,mentor_id,starts_at,duration_min,status) VALUES (${slot},${m.id},${dayAt(d + mi % 2, 9 + ((k + mi) % 6) * 2)},${[30, 45, 60][k % 3]},'open');`); });
});
const past = [[9, 1, 5, 'Great session — clear, honest advice on our seed narrative.'], [9, 2, 5, 'Helped me think through hardware vs software roadmap.'], [9, 4, 4, 'Very practical. Would book again.'], [10, 4, 5, 'Gave me a concrete plan for our first 100 customers.'], [10, 1, 4, 'Sharp positioning feedback.'], [11, 3, 5, 'Fixed our financial model in 45 minutes.'], [11, 1, 5, 'Walked through our cap table scenarios clearly.'], [11, 2, 5, 'Exactly the fundraising prep we needed.']];
past.forEach(([mentor, mentee, rating, text], i) => {
  slot++; booking++;
  out.push(`INSERT INTO mentor_slots (id,mentor_id,starts_at,duration_min,status) VALUES (${slot},${mentor},${dayAt(-(3 + i * 2), 10)},30,'booked');`);
  out.push(`INSERT INTO bookings (id,slot_id,mentor_id,mentee_id,topic,status,created_at) VALUES (${booking},${slot},${mentor},${mentee},'Early-stage strategy session','completed',${ago(24 * (5 + i * 2))});`);
  out.push(`INSERT INTO reviews (booking_id,mentor_id,reviewer_id,rating,body,created_at) VALUES (${booking},${mentor},${mentee},${rating},${q(text)},${ago(24 * (3 + i * 2))});`);
});

// Q&A
const qa = [
  [4, 'How do I find my first 100 users with almost no budget?', 'We are a pre-seed edtech tool for teachers. Paid ads feel wasteful. What has worked for you?', 'Marketing', 30, [[10, 'Go where your users already talk. For teachers that is WhatsApp and Telegram groups, local teacher communities and school WhatsApp parents groups. Offer to build one free resource for the group, then ask for feedback — not signups. Track which conversations turn into repeat usage and double down on that channel only.'], [9, 'Also record every user interview. Your first 100 users are your best source of product insight, not just distribution.']]],
  [2, 'When is the right time to start talking to seed investors?', 'We have 3 pilots and no revenue yet. Are we too early?', 'Fundraising', 52, [[11, 'Start relationships 3–6 months before you need the money. Share short updates monthly. Formally raise when you can show a repeatable pattern: pilots converting to paid contracts is that pattern for hardware. Pilots alone, without a path to revenue, usually read as pre-seed.']]],
  [3, 'How should we think about SAFE vs priced round at seed?', 'We are raising $2M. Investors are split on instruments.', 'Finance', 90, [[11, 'SAFEs are faster and cheaper, but they defer the valuation conversation and can stack dilution. A priced round gives clarity and governance but costs more in legal time. Above ~$1.5M many institutional investors prefer priced. Model both scenarios on your cap table and talk to a startup lawyer before choosing.']]],
  [1, 'How do you structure the first technical hires after seed?', 'We are a team of 4 and plan to hire 6 over 12 months.', 'Talent / HR', 110, []],
];
qa.forEach(([u, title, body, tag, h, answers], i) => {
  const id = i + 1;
  out.push(`INSERT INTO questions (id,user_id,title,body,tag,created_at) VALUES (${id},${u},${q(title)},${q(body)},${q(tag)},${ago(h)});`);
  answers.forEach(([au, text], j) => out.push(`INSERT INTO answers (question_id,user_id,body,created_at) VALUES (${id},${au},${q(text)},${ago(h - 2 - j)});`));
});

// Learning Hub
const R = [
  ['guide', 'The 10-slide pitch deck, explained', 'What each slide must answer, in the order investors expect.', 'Founder guide', 'Fundraising', `## The goal
A pitch deck is not your whole story. It earns the first meeting. Aim for 10 slides and under 10 minutes.

## The ten slides
- Problem: who hurts, how often, and what it costs them today.
- Solution: what you built, in one sentence and one screenshot.
- Why now: the shift that makes this possible this year.
- Market: a bottom-up estimate (customers × price), not a top-down percentage.
- Product: three core features tied to the problem.
- Traction: the two or three numbers that prove momentum.
- Business model: how you make money and your unit economics so far.
- Competition: honest alternatives, including "do nothing".
- Team: why you are the people to solve this.
- The ask: how much, what it funds, and the milestone it reaches.

## Common mistakes
- Hiding the ask on the last slide.
- Vanity metrics instead of retention or revenue.
- More than 30 words on a slide.`],
  ['template', 'Founder one-pager template', 'A single page you can send before any intro call.', 'Template', 'Strategy', `## Header
Company name · one-line description · website · founder names and contacts.

## Problem and solution
Two sentences each. Name the customer in the first sentence.

## Traction
- Users or customers: 
- Revenue or pilots: 
- Growth rate (monthly): 

## Market and model
Who pays, how much, and how often.

## Team
Two lines per founder: past relevant wins.

## The ask
Amount, instrument, use of funds, and the 18-month milestone.`],
  ['template', 'Monthly investor update email', 'Keep investors close with a five-minute monthly update.', 'Template', 'Fundraising', `## Subject line
[Company] — [Month] update: [headline metric]

## Body structure
- Headline: one sentence on the most important change this month.
- Metrics: three numbers vs last month.
- Wins: up to three.
- Challenges: up to three, honestly stated.
- Asks: specific help you want (intros, hires, advice).
- Cash and runway: balance and months of runway.

## Tips
Send on the same day every month. Short beats long. Asks drive replies.`],
  ['guide', 'How investors read a deck in three minutes', 'Understand the skim so your deck survives it.', 'Investor view', 'Fundraising', `## The first pass
Most investors scan for: team credibility, a real problem, evidence of pull from customers, and a reason this is big enough to matter.

## What gets a second look
- A sharp one-line description on the first slide.
- Traction shown as a chart with dates.
- A clear, realistic use of funds.

## What gets a pass
- Vague markets and "no competition" claims.
- Unclear ask or no stated milestone.

Treat the deck as the ticket to a conversation, not the conversation itself.`],
  ['guide', 'Preparing for your first mentor session', 'Walk in with a question, leave with a next step.', 'Mentoring', 'Strategy', `## Before
- Write your single most important question.
- Share two lines of context with the mentor in advance.
- Bring one metric that shows where you are today.

## During
Ask for opinions you can test, not instructions. Take notes on commitments.

## After
Within 24 hours, send a short summary of what you will try and when you will report back. Mentors remember founders who follow up.`],
  ['guide', 'A plain-language guide to term sheet basics', 'The handful of terms that shape your outcome. Not legal advice.', 'Founder guide', 'Legal', `## Why it matters
A term sheet sets valuation and the rules of your relationship with investors. Read it with a startup lawyer.

## Terms worth understanding
- Valuation and option pool: pre-money value and how much equity is reserved for hires.
- Liquidation preference: who gets paid first on an exit, and how much.
- Board composition: who controls major decisions.
- Pro-rata rights: investors' right to participate in future rounds.
- Vesting: founder equity earned over time.

This guide is educational and is not legal advice.`],
  ['video', 'Sample video resource', 'Placeholder entry for a learning video (demo content).', null, 'Strategy'],
];
R.forEach(([type, title, summary, label, tag, body], i) => {
  out.push(`INSERT INTO resources (type,title,summary,body,url,author_id,author_name,tags,created_at) VALUES (${q(type)},${q(title)},${q(summary)},${q(body || '')},${type === 'video' ? q('https://example.com/') : 'NULL'},NULL,${q(label || 'INverge Team')},${q(tag)},${ago(24 * (30 - i))});`);
});
out.push(`INSERT INTO resources (type,title,summary,body,url,author_id,author_name,tags,created_at) VALUES ('community','Dilution model outline for a SAFE round','A simple spreadsheet outline to model how SAFEs convert at your priced round.','Columns: investor, amount, valuation cap, discount, conversion price, shares issued. Add rows per SAFE, then model the priced round to see post-money ownership for founders, pool and investors. Re-run with 2–3 scenarios before you sign anything.',NULL,11,'Charlie Mentor','Finance,Fundraising',${ago(60)});`);

// Sample conversation
const msgs = [
  [5, 1, 'pitch', 'Hi Alpha Founder — Alpha Investor from Alpha Demo Fund. Your Alpha Startup update caught my eye. Could you share more on clinic retention and your offline sync approach?', 30, 1],
  [1, 5, 'text', 'Thanks Alpha Investor! Retention is 91% at 90 days across the 12 live clinics. Happy to walk you through the sync design on a call.', 28, 1],
  [5, 1, 'meeting', 'Would Thursday work for a 30-minute call?', 4, 0],
];
msgs.forEach(([s, r, k, b, h, rd]) => out.push(`INSERT INTO messages (sender_id,recipient_id,kind,body,meta,created_at,read_at) VALUES (${s},${r},${q(k)},${q(b)},${k === 'meeting' ? q(JSON.stringify({ when: Date.now() + 3 * 86400000, duration: 30 })) : 'NULL'},${ago(h)},${rd ? ago(h - 1) : 'NULL'});`));

writeFileSync(new URL('../seed.sql', import.meta.url), '-- Demo data (fictional). Password is NOT stored here; see demo-password.txt\n' + out.join('\n') + '\n');
console.log(`seed.sql written: ${users.length} users, ${posts.length} posts, ${out.length} statements`);
console.log('Demo logins (password is in demo-password.txt):', users.map((u) => u.email).join(', '));
