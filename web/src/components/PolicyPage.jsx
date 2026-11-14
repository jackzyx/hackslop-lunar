import { projectRepository } from '@/lib/sources.js';
import { routeUrl } from '@/lib/routes.js';

export const policyTitles = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

export default function PolicyPage({ page, onRoute }) {
  return (
    <main className="policy-page" id={`${page}-main`} tabIndex={-1} aria-labelledby="policy-title">
      <h1 id="policy-title">{policyTitles[page]}</h1>
      <p className="policy-date">Updated <time dateTime="2026-11-14">14 November 2026</time></p>
      {page === 'privacy' ? <PrivacyPolicy /> : <TermsOfService onRoute={onRoute} />}
    </main>
  );
}

function PrivacyPolicy() {
  return (
    <>
      <h2>What the planner uses</h2>
      <p>Sun Shade is a project by the HackAthlone 2026 Sun Shade team. The planner has no accounts or forms that submit personal information. Your selected landing sites, date, and launch delay are processed in your browser. The planner itself uses no cookies, advertising, or analytics.</p>

      <h2>Browser storage</h2>
      <p>The app may cache the lunar position dataset on your device to avoid downloading it on every visit. Your browser may also cache other site files. You can remove these copies by clearing the site’s data in your browser settings.</p>

      <h2>Hosting and external links</h2>
      <p>When you use a hosted copy, its server receives your IP address and standard request information to deliver the site. The hosting operator determines whether it logs that information and how long it keeps it. External sites such as GitHub have their own privacy policies.</p>

      <h2>Privacy questions and rights</h2>
      <p>For questions about information handled by a hosted copy, contact its operator. If data protection law applies, you may have rights to access, correct, delete, or restrict the use of personal data, object to its use, or receive a portable copy. You can also contact the <a href="https://www.dataprotection.ie/en/contact/how-contact-us">Irish Data Protection Commission</a>.</p>
    </>
  );
}

function TermsOfService({ onRoute }) {
  return (
    <>
      <h2>Using Sun Shade</h2>
      <p>Sun Shade is an educational tool for exploring sunlight and Earth visibility at the lunar south pole. Use it to compare scenarios. Any operational landing or mission decision requires independent engineering analysis.</p>

      <h2>Model limits</h2>
      <p>The estimates depend on the model, input data, and terrain resolution. Sunlight estimates describe visibility of the Sun. Earth visibility estimates describe line of sight. Power, thermal conditions, radio performance, and landing hazards require separate assessments.</p>

      <h2>Code, data, and imagery</h2>
      <p>The project source code is available under the <a href={`${projectRepository}/blob/main/LICENSE`}>MIT licence</a>. Third-party data and imagery are subject to their own terms. See <a href={`${routeUrl('about')}#about-sources`} onClick={onRoute}>Data &amp; sources</a> for attribution.</p>

      <h2>Availability and rights</h2>
      <p>The team may change the tool, its datasets, or its availability. The team does not guarantee uninterrupted access or error-free results. Your statutory rights still apply.</p>
    </>
  );
}
