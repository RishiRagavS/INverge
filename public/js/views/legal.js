// Terms of Use and Privacy Notice. Fill CONTACT before public launch and have a lawyer review both pages.
import { html } from '../core.js';
const CONTACT = ''; // e.g. 'support@yourdomain.com'
const contactLine = CONTACT ? html`<p>Questions or requests: <a href="mailto:${CONTACT}">${CONTACT}</a>.</p>` : '';
const shellPage = (title, updated, body) => ({ title, main: html`<div class="legal"><a class="brand" href="#/"><span class="sq" aria-hidden="true"></span><span class="w">inverge<em>.</em></span></a>
  <div class="label" style="margin-top:22px">LEGAL // ${updated}</div><h1>${title}</h1>
  <div class="warn" style="margin:14px 0"><span class="three"><i></i><i></i><i></i></span><div><b>DEMO / MVP</b><span class="small">INverge is an early demonstration product. All sample profiles, companies and figures shown in demo mode are fictional.</span></div></div>
  ${body}<p class="small muted" style="margin-top:28px"><a href="#/terms">Terms of Use</a> · <a href="#/privacy">Privacy Notice</a> · <a href="#/">Home</a></p></div>` });

export function termsView() {
  return shellPage('Terms of Use', 'v0.1', html`
  <h2>1. What INverge is</h2><p>INverge is a networking and communication tool for startup founders, investors and mentors. It is <b>not</b> a broker, dealer, investment adviser, funding portal, crowdfunding platform, marketplace for securities or a regulated financial service. Nothing on INverge is an offer to sell, or a solicitation of an offer to buy, any security or financial product.</p>
  <h2>2. No advice</h2><p>Posts, profiles, match scores, learning guides, templates, mentor answers and any other content are for general information only. They are not legal, financial, tax, investment or professional advice. Seek independent professional advice before making any decision. Any investment, mentoring arrangement or other deal is made solely between the members involved, and you do your own due diligence.</p>
  <h2>3. Eligibility and accounts</h2><p>You must be at least 18 and able to enter a binding agreement. Give accurate information, keep your password secure, and do not share your account. Your role (Founder, Investor or Mentor) is fixed at sign-up.</p>
  <h2>4. Verification badges</h2><p>Basic, Gold and Elite badges show which checks a member has completed, for example email confirmation, a submitted document, a linked profile or administrator review. They are <b>not</b> a guarantee of identity, qualifications, accreditation, track record, honesty or the success of any deal. Never send money or sensitive information based on a badge alone.</p>
  <h2>5. Acceptable use</h2><p>Do not impersonate any person or organisation, upload forged or someone else's documents, post false or misleading claims, harass others, send spam, scrape the service, attempt to break its security, or use it for anything unlawful. Do not post content you have no right to share. We may remove content or suspend accounts that break these rules.</p>
  <h2>6. Your content</h2><p>You own what you post. You give INverge a limited licence to store and display it to other members as the service requires. You are responsible for your content, including claims about your company, funding, traction or experience.</p>
  <h2>7. Mentor sessions and messages</h2><p>Sessions, introductions and conversations are arrangements between members. INverge is not a party to them, does not supervise them, and does not guarantee outcomes, attendance or quality. Report concerns to us.</p>
  <h2>8. Third-party links</h2><p>Links to other sites, including LinkedIn, are not controlled by INverge. LinkedIn is a trademark of its owner and INverge is not affiliated with or endorsed by LinkedIn.</p>
  <h2>9. Availability and liability</h2><p>The service is provided “as is” during this MVP stage, without warranties of any kind, and may change, pause or lose data. To the fullest extent permitted by law, INverge and its operators are not liable for indirect or consequential loss, lost profits, or losses arising from dealings between members.</p>
  <h2>10. Changes, ending your account, and law</h2><p>We may update these terms and will show the new version here. You can stop using INverge at any time and ask us to delete your account. The governing law and courts will be stated here before public launch.</p>${contactLine}`);
}

export function privacyView() {
  return shellPage('Privacy Notice', 'v0.1', html`
  <h2>What we collect</h2><ul><li>Account details: name, email, role, country, city and a hashed password (we never store your password in readable form).</li><li>Profile content you choose to add: headline, bio, photo, startup or investment details, LinkedIn URL.</li><li>Verification documents you upload, such as a government ID or business proof. These are sensitive.</li><li>Activity: posts, comments, messages, connections, bookings, and basic profile-view counts.</li></ul>
  <h2>Why we use it</h2><p>To run your account, show your profile to other members, send one-time codes and notifications, review verification documents, keep the service secure and prevent abuse. We do not sell your data and do not run advertising or behavioural tracking.</p>
  <h2>Verification documents</h2><p>Uploaded identity documents are used only for verification. They are visible to you and to authorised administrators who review them, and are not shown on your public profile. Upload only what is needed, and cover any details that are not required. Pitch decks marked shareable are visible to verified members only.</p>
  <h2>Who processes data for us</h2><ul><li>Cloudflare, for hosting and the database.</li><li>Resend, for sending verification emails.</li><li>Google Fonts, which delivers typefaces and therefore receives your IP address when pages load.</li></ul>
  <h2>Cookies</h2><p>We use a single strictly necessary, HTTP-only session cookie to keep you logged in. No advertising or analytics cookies are used.</p>
  <h2>Retention and your choices</h2><p>We keep your data while your account is active. You can edit your profile at any time and ask us to export or delete your account and documents. Where local law gives you further rights (for example under India's DPDP Act or the GDPR), you may exercise them by contacting us.</p>
  <h2>Age and security</h2><p>INverge is for adults aged 18 and over. We use encryption in transit, hashed passwords and access controls, but no online service is perfectly secure.</p>
  <h2>Demo mode</h2><p>Sample accounts are fictional and use reserved example addresses. Do not enter real personal data in a demo environment you do not control.</p>${contactLine}`);
}
