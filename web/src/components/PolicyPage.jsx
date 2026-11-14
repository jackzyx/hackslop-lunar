import { projectRepository } from '@/lib/sources.js';
import { routeUrl } from '@/lib/routes.js';

export const policyTitles = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  accessibility: 'Accessibility Statement',
};

const UPDATED = ['2026-11-14', '14 November 2026'];
const issues = `${projectRepository}/issues`;
const Ext = ({ href, children }) => <a href={href} target="_blank" rel="noreferrer">{children}</a>;

// Each page is a summary plus [id, heading, body] sections; the contents list is built from them.
export default function PolicyPage({ page, onRoute }) {
  const { summary, sections } = pages[page](onRoute);
  return (
    <main className="policy-page" id={`${page}-main`} tabIndex={-1} aria-labelledby="policy-title">
      <h1 id="policy-title">{policyTitles[page]}</h1>
      <p className="policy-date">Last updated <time dateTime={UPDATED[0]}>{UPDATED[1]}</time></p>
      <aside className="policy-summary" aria-label="Summary"><h2>In short</h2><ul>{summary.map((s, i) => <li key={i}>{s}</li>)}</ul></aside>
      <nav className="policy-toc" aria-label="On this page"><h2>On this page</h2>
        <ol>{sections.map(([id, title]) => <li key={id}><a href={`#${id}`}>{title}</a></li>)}</ol>
      </nav>
      {sections.map(([id, title, body]) => <section key={id} id={id} aria-labelledby={`${id}-h`}><h2 id={`${id}-h`}>{title}</h2>{body}</section>)}
      <p className="policy-other">Also read: {Object.keys(policyTitles).filter((p) => p !== page).map((p, i) => <span key={p}>{i > 0 && ' · '}<a href={routeUrl(p)} onClick={onRoute}>{policyTitles[p]}</a></span>)}</p>
    </main>
  );
}

const pages = {
  privacy: (onRoute) => ({
    summary: [
      'Sun Shade has no accounts, sign-up, forms that send data, cookies, analytics, advertising or tracking.',
      'Everything you do in the planner (sites, dates, launch slip, custom sites) is calculated in your own browser.',
      'Custom landing sites you add, and whether you have seen the intro, are saved only in your browser’s local storage, on your device, and never sent to us.',
      'The server that hosts a copy of the site sees ordinary web request data, as with any website.',
    ],
    sections: [
      ['who', 'Who we are', <>
        <p>Sun Shade is a free, open-source educational tool built by the Sun Shade team, a team of three at HackAthlone 2026, the NASA International Space Apps Challenge local event held at the Technological University of the Shannon (TUS), Athlone, Ireland, 13–15 November 2026. In this policy “we”, “us” and “the team” mean the Sun Shade team.</p>
        <p>Sun Shade is not operated by NASA, the Space Apps Challenge organisers or TUS, and they are not responsible for it. This policy covers the Sun Shade website and planner, including copies run offline from the project folder.</p>
      </>],
      ['processed', 'What the planner processes, and where', <>
        <p>When you use the planner, you choose two landing sites, a planned landing date and a launch slip, and you may add custom landing sites by clicking or right-clicking the map. All of these choices, and every number derived from them (sunlight hours, Earth-contact hours, dark gaps, best landing days, horizon masks for custom sites), are calculated by JavaScript running in your browser from data files downloaded with the page.</p>
        <p>None of these choices are sent to us or to any other server. They are not added to the page address, so they do not appear in server logs or in links you share.</p>
      </>],
      ['not-collected', 'What we do not collect', <>
        <ul>
          <li>No names, email addresses or other contact details: there are no accounts, sign-up or contact forms.</li>
          <li>No cookies of any kind, first-party or third-party.</li>
          <li>No analytics, telemetry, session recording, heat maps or error-reporting services.</li>
          <li>No advertising, advertising identifiers or social-media trackers.</li>
          <li>No precise location from your device. The only “locations” in the app are places on the Moon.</li>
          <li>No third-party fonts, scripts or content delivery networks. Fonts and libraries are bundled with the site and served from the same place as the page.</li>
        </ul>
      </>],
      ['storage', 'Storage on your device', <>
        <p>The planner stores at most two small items in your browser’s local storage:</p>
        <div className="policy-table" role="region" aria-label="Browser storage used by Sun Shade" tabIndex={0}>
          <table>
            <thead><tr><th>Name</th><th>Contents</th><th>Purpose</th><th>Kept until</th></tr></thead>
            <tbody><tr><td><code>sun-shade-intro-seen</code></td><td>The value “1”</td><td>Show the opening animation on your first visit only</td><td>You clear this site’s data in your browser</td></tr>
            <tr><td><code>sun-shade-custom-sites</code></td><td>For up to six custom sites: the name you gave it and its lunar latitude and longitude</td><td>Restore your custom sites when you come back</td><td>You remove the site in the planner, or clear this site’s data in your browser</td></tr></tbody>
          </table>
        </div>
        <p>These items stay on your device. We cannot see them, and they are not sent with any request. Neither identifies you or tracks you across sites, so they need no consent banner. Do not put personal information in custom site names; they are not shared, but anyone using the same browser profile can see them.</p>
        <p>Your browser may also keep ordinary cached copies of the site’s files (the page, scripts, terrain and lunar position data) so later visits load faster. These are standard browser caches, not tracking. You can delete both by clearing this site’s data in your browser settings or using a private window.</p>
      </>],
      ['requests', 'Network requests the site makes', <>
        <p>Loading Sun Shade downloads its own files from the same address as the page: the application code, styles and fonts, the lunar position table, the terrain height maps of the south pole and the imagery used in the intro and About page. The site makes no requests to any other domain while you use it.</p>
        <p>Links to other websites (for example NASA, GitHub, journal articles and news reports in the Data &amp; sources list) are only followed if you click them, and they open the other site in a new tab.</p>
      </>],
      ['hosting', 'Hosting and server logs', <>
        <p>When you visit a hosted copy of Sun Shade, the hosting service necessarily receives technical information to deliver the files: your IP address, the date and time, the files requested, your browser’s user-agent string and the referring page. This happens with every website. Sun Shade does not add anything to these requests.</p>
        <p>The hosting provider decides whether to log this information and for how long, under its own privacy policy. For a copy published on GitHub Pages, see the <Ext href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub General Privacy Statement</Ext>. The team does not receive or analyse these logs.</p>
        <p>If you run Sun Shade offline from the project folder (<code>python serve.py</code>), the server runs on your own computer, listens only on <code>127.0.0.1</code> and nothing leaves your machine.</p>
      </>],
      ['external', 'External links and the source code', <>
        <p>The footer and About page link to the project’s code on GitHub and to the data, imagery and publications we used. Those sites have their own privacy policies and may use cookies. We are not responsible for how they handle information.</p>
        <p>If you choose to open an issue or contribute on GitHub, what you post is public and handled by GitHub under its terms.</p>
      </>],
      ['basis', 'Legal basis', <>
        <p>Because the planner does not collect personal data, there is almost nothing for us to justify. Where data protection law applies, the hosting provider’s handling of request data is normally based on legitimate interests (Article 6(1)(f) GDPR): delivering the site securely and reliably. The two local-storage items exist only to provide features of the site you are using (your custom sites, and not replaying the intro), under the “strictly necessary” exemption in the Irish ePrivacy Regulations (S.I. No. 336 of 2011).</p>
      </>],
      ['children', 'Children', <>
        <p>Sun Shade is suitable for classroom use and does not knowingly collect personal data from anyone, including children. There is nothing to sign up for and no way to submit personal information through the planner.</p>
      </>],
      ['rights', 'Your rights', <>
        <p>If data protection law such as the GDPR applies, you may have the right to access, correct or delete personal data about you, to restrict or object to its use, and to receive a portable copy. As we hold no personal data about you, a request to us will usually confirm that. Data on your device is under your control: clear this site’s data in your browser to delete it.</p>
        <p>For data held by a hosting provider, contact that provider. You also have the right to complain to a supervisory authority. In Ireland that is the <Ext href="https://www.dataprotection.ie/en/contact/how-contact-us">Data Protection Commission</Ext>.</p>
      </>],
      ['security', 'Security', <>
        <p>All files are static, so there is no database or user account to breach. Serve the site over HTTPS where possible. The code is public, so anyone can check what it does. Please report security problems through the project’s <Ext href={issues}>GitHub issues</Ext> without including sensitive details, and we will arrange a private channel if needed.</p>
      </>],
      ['changes', 'Changes to this policy', <>
        <p>If Sun Shade starts handling information differently, we will update this page and the “Last updated” date before the change takes effect. Earlier versions are kept in the project’s Git history.</p>
      </>],
      ['contact', 'Contact', <>
        <p>Questions about this policy: open an issue on the project’s <Ext href={issues}>GitHub repository</Ext>. See also the <a href={routeUrl('terms')} onClick={onRoute}>Terms of Service</a>.</p>
      </>],
    ],
  }),

  terms: (onRoute) => ({
    summary: [
      'Sun Shade is a free educational and screening tool, not a mission-planning or safety system.',
      'Its numbers are geometric estimates with known limits. Do not base real landing or mission decisions on them.',
      'The code is open source under the MIT licence. NASA and other data and imagery keep their own terms.',
      'The tool is provided “as is”, without warranties, to the extent the law allows. Your statutory rights are not affected.',
    ],
    sections: [
      ['agreement', 'About these terms', <>
        <p>These terms apply to your use of the Sun Shade website and planner, including copies run offline. By using Sun Shade you agree to them. If you do not agree, please do not use the tool. “We”, “us” and “the team” mean the Sun Shade team, who built Sun Shade at HackAthlone 2026, the NASA International Space Apps Challenge local event in Athlone, Ireland.</p>
      </>],
      ['service', 'What Sun Shade is', <>
        <p>Sun Shade shows, for landing sites near the lunar south pole and a chosen landing date, how many hours of sunlight and Earth line of sight a site gets in the 30 days after landing, how a launch slip changes those numbers, and which landing days in the following year score best. It draws the real terrain and its shadows on a map of the region.</p>
        <p>It was built in a weekend as a hackathon entry. It is intended for learning, outreach and early screening of options, not for operational use.</p>
      </>],
      ['not-operational', 'Not for operational or safety-critical use', <>
        <p>Sun Shade must not be used as the basis for any real launch, landing, mission, power, thermal, communications or safety decision. Such decisions need independent, validated engineering analysis using authoritative data and tools. Nothing on the site is advice from NASA, a space agency or a mission team.</p>
      </>],
      ['limits', 'Model limits and accuracy', <>
        <p>The results are estimates produced by a simplified model. Known limits, also listed in the planner’s “Not modelled” tab, include:</p>
        <ul>
          <li><b>Sunlight</b> is the visible fraction of the Sun’s disc above the local skyline. It is not electrical power and ignores panel orientation, dust and shadowing by the lander itself.</li>
          <li><b>Earth contact</b> is geometric line of sight to Earth’s centre. It is not a radio-link budget and ignores antennas, relays, ground-station schedules and Earth’s rotation.</li>
          <li><b>Terrain:</b> curated sites use horizons computed from 80 m LOLA terrain. Custom sites use the 500 m map terrain in your browser, which misses smaller relief and can overstate sunlight on narrow ridges and peaks by more than 100 hours in a 30-day window. The Validation tab shows this comparison.</li>
          <li><b>Time:</b> landings are assumed at 00:00 UTC, results are hourly, and the position table covers 1 January 2025 to 31 December 2030.</li>
          <li><b>Not modelled:</b> landing hazards, slopes, rocks, thermal conditions, illumination of the lander’s own structure, and any mission-specific constraints.</li>
        </ul>
        <p>The positions of the Sun and Earth come from NASA/JPL ephemerides and are checked against JPL Horizons, as reported in the Validation tab. Agreement there does not validate every other part of the model. We do not guarantee that results are complete, accurate or fit for any purpose.</p>
      </>],
      ['custom', 'Custom landing sites and best days', <>
        <p>You can add custom sites within 160 km of the pole and ask for the best landing days for any site. These features are screening aids built on the same simplified model, with the lower-fidelity terrain described above for custom sites. A custom site’s coordinates are not a vetted landing location. Treat “best day” rankings as relative comparisons, not predictions.</p>
      </>],
      ['use', 'Acceptable use', <>
        <p>You may use Sun Shade for any lawful purpose, including teaching, research and public presentations. You agree not to:</p>
        <ul>
          <li>present Sun Shade’s output as official NASA, space-agency or mission data, or as validated engineering results;</li>
          <li>remove or misrepresent the data credits, limits or validation information when you share screenshots or results;</li>
          <li>attempt to disrupt, overload or attack any server that hosts the site;</li>
          <li>use the site in a way that breaks any law or infringes anyone’s rights.</li>
        </ul>
        <p>When you share results, we ask that you credit “Sun Shade (HackAthlone 2026)” and mention that the numbers are model estimates.</p>
      </>],
      ['ip', 'Code, data, imagery and names', <>
        <p>Sun Shade’s source code is released under the <Ext href={`${projectRepository}/blob/main/LICENSE`}>MIT licence</Ext>. You may use, copy, modify and distribute it under that licence, which includes its own disclaimer.</p>
        <p>The lunar terrain, ephemeris data and imagery come from NASA, NASA/JPL, NASA/GSFC, Arizona State University and others, as listed with credits in <a href={`${routeUrl('about')}#about-sources`} onClick={onRoute}>Data &amp; sources</a>. These materials remain subject to their owners’ terms and guidelines. Fonts and software libraries are used under their open-source licences, also listed there.</p>
        <p>Use of NASA data does not imply endorsement. Sun Shade is not a NASA product, and NASA, the Space Apps Challenge, TUS and the organisations named on this site do not endorse it. Their names and logos belong to them. No AI-generated imagery is used on this site.</p>
      </>],
      ['content', 'Your content', <>
        <p>The only content you create in Sun Shade is the names and positions of custom sites. They stay in your browser, as described in the <a href={routeUrl('privacy')} onClick={onRoute}>Privacy Policy</a>, and we claim no rights in them.</p>
      </>],
      ['links', 'Links to other websites', <>
        <p>Sun Shade links to other websites for sources and context. We do not control them and are not responsible for their content, availability or privacy practices.</p>
      </>],
      ['availability', 'Availability and changes', <>
        <p>Sun Shade is offered free of charge. We may change, update or stop offering the site, its features or its data at any time, without notice. We do not guarantee that it will be available, uninterrupted or free of errors.</p>
      </>],
      ['warranty', 'No warranty', <>
        <p>To the fullest extent permitted by law, Sun Shade is provided “as is” and “as available”, without warranties of any kind, express or implied, including warranties of accuracy, merchantability, fitness for a particular purpose and non-infringement.</p>
      </>],
      ['liability', 'Limitation of liability', <>
        <p>To the fullest extent permitted by law, the team is not liable for any loss or damage arising from your use of, or reliance on, Sun Shade or its results, including indirect or consequential loss, loss of data or loss of opportunity. Nothing in these terms limits liability that cannot be limited by law, such as liability for death or personal injury caused by negligence or for fraud, and nothing affects your statutory rights as a consumer.</p>
      </>],
      ['law', 'Governing law', <>
        <p>These terms are governed by the laws of Ireland. If you live in another country, you also keep any protection that the mandatory laws of your country of residence give you. Disputes may be brought before the courts of Ireland or of your country of residence where the law allows.</p>
      </>],
      ['changes', 'Changes to these terms', <>
        <p>We may update these terms. The “Last updated” date shows when they last changed, and earlier versions are in the project’s Git history. Continuing to use Sun Shade after a change means you accept the updated terms.</p>
      </>],
      ['contact', 'Contact', <>
        <p>Questions about these terms: open an issue on the project’s <Ext href={issues}>GitHub repository</Ext>.</p>
      </>],
    ],
  }),

  accessibility: (onRoute) => ({
    summary: [
      'We aim for Sun Shade to meet WCAG 2.2 level AA. It has not been independently audited.',
      'Every number in the planner is available as text. The map and charts explain the numbers but are not the only way to read them.',
      'The intro can be skipped, motion respects your “reduce motion” setting, and About-page animations can be paused.',
      'Placing a custom site needs a pointer (mouse, trackpad or touch). This is a known limit.',
    ],
    sections: [
      ['commitment', 'Our commitment', <>
        <p>We want Sun Shade to be usable by everyone, including people who use screen readers, keyboards, magnification or reduced motion. This statement covers the Sun Shade website and planner.</p>
      </>],
      ['status', 'Conformance status', <>
        <p>Sun Shade aims to conform to the <Ext href="https://www.w3.org/TR/WCAG22/">Web Content Accessibility Guidelines (WCAG) 2.2</Ext> at level AA. It was built during a weekend hackathon and has been checked by the team with keyboard navigation, browser zoom, reduced-motion settings and phone-sized screens, but not audited by a third party. We consider it partially conformant: the known gaps are listed below.</p>
      </>],
      ['features', 'What we have done', <>
        <ul>
          <li><b>Keyboard:</b> site pickers, the landing-date picker, the launch-slip slider, the tabs and all buttons work from the keyboard, with visible focus outlines. The slider moves in one-day steps with the arrow keys.</li>
          <li><b>Screen readers:</b> pages use headings and landmarks; site cards give their key figures as plain sentences (for example “369 hours of sunlight”); the map has a text description; results tables are real tables.</li>
          <li><b>Motion:</b> the opening animation can be skipped and is not shown at all if your system asks for reduced motion. Other animations follow the same setting, and the About page has a “Pause animations” control in the footer.</li>
          <li><b>Colour:</b> the shadow map uses light and dark, not colour, to show sunlit and shadowed ground. Verdicts are written in words, not shown by colour alone. Text is set in high contrast on a dark background.</li>
          <li><b>Zoom and small screens:</b> the layout reflows on phone-sized screens without sideways scrolling of the page, and text can be enlarged with browser zoom. Wide tables and the tab bar scroll within their own box.</li>
          <li><b>Plain language:</b> numbers come with their units and a one-line explanation of what they mean and what they do not mean.</li>
        </ul>
      </>],
      ['limits', 'Known limitations', <>
        <ul>
          <li><b>Custom sites:</b> adding a custom site means clicking or right-clicking a point on the map, which needs a pointer. Curated sites, all comparisons and the best-days table remain fully usable from the keyboard.</li>
          <li><b>Map and charts:</b> the shadow map, skyline panoramas and timelines are visual. The figures they illustrate are given as text in the site cards and tables, but the shapes of shadows and skylines are not described in detail.</li>
          <li><b>Panning and zooming the map</b> by dragging or scrolling needs a pointer. The zoom buttons and the “Close-up / Whole region” button work from the keyboard.</li>
          <li><b>The opening animation</b> includes a moving caption that screen readers may not announce. The same information appears on the planner.</li>
        </ul>
      </>],
      ['compat', 'Compatibility', <>
        <p>Sun Shade is designed for recent versions of Chrome, Edge, Firefox and Safari on desktop and mobile. The shadow map uses WebGL where available and falls back to a slower renderer otherwise. JavaScript is required.</p>
      </>],
      ['feedback', 'Feedback and contact', <>
        <p>If you find an accessibility barrier, please tell us through the project’s <Ext href={issues}>GitHub issues</Ext>. Say which page and feature you were using and what assistive technology, if any. We will try to fix it or provide the information another way.</p>
        <p>See also the <a href={routeUrl('privacy')} onClick={onRoute}>Privacy Policy</a> and <a href={routeUrl('terms')} onClick={onRoute}>Terms of Service</a>.</p>
      </>],
    ],
  }),
};
