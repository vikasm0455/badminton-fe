import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy · RallyUp",
  description: "How RallyUp collects, uses, and protects your information.",
};

// NOTE (for the owner — delete before publishing if you like):
// Fill the three placeholders below, then this page is store-ready at
// https://badmintonrallyup.com/privacy — use that URL in App Store Connect
// (App Privacy) and Google Play (Data safety + Store listing).
const EFFECTIVE_DATE = "[EFFECTIVE DATE — e.g. July 18, 2026]";
const CONTACT_EMAIL = "[CONTACT EMAIL — e.g. support@badmintonrallyup.com]";
const JURISDICTION = "[YOUR COUNTRY / STATE]";

export default function PrivacyPage() {
  return (
    <main className="px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">Effective {EFFECTIVE_DATE}</p>
      <h1 className="mt-1 text-2xl font-bold">RallyUp Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted">
        RallyUp (&quot;RallyUp&quot;, &quot;we&quot;, &quot;us&quot;) helps badminton groups coordinate sessions —
        polls, court reservations, and shared court logins. This policy explains what we collect,
        why, and the choices you have. It covers the RallyUp website, the iOS app, and the Android app.
      </p>

      <Section title="Information we collect">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <b>Account details.</b> Your email address and display name. We sign you in with a one-time
            code sent to your email — we never ask for or store a password.
          </li>
          <li>
            <b>Group activity.</b> The groups you create or join, poll votes, attendance, and court
            reservations you log. This is visible to members of the relevant group.
          </li>
          <li>
            <b>Shared court logins.</b> When you post a court login (a name and access code for a shared
            court kiosk), it is stored and shown only to the groups you choose. These clear automatically
            at the end of each day.
          </li>
          <li>
            <b>Photos you submit.</b> If you photograph a kiosk screen, note, or status board, we upload
            the image to read the login text from it (OCR). The extracted text and the image are attached
            to your post and clear with it.
          </li>
          <li>
            <b>Private calorie logs.</b> Any calories you log are strictly private to your account. They
            are never shown to your group or to any administrator, and are not used for anything else.
          </li>
          <li>
            <b>Device tokens.</b> If you enable notifications, we store a push token for your device so we
            can deliver reminders (e.g. a new poll tonight).
          </li>
          <li>
            <b>Basic technical data.</b> We keep aggregate, non-identifying counts (such as how many
            requests come from web vs. the apps) to keep the service healthy. We do not use advertising
            identifiers or third-party analytics/tracking SDKs.
          </li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>To provide the core features: sign-in, groups, polls, reservations, and shared logins.</li>
          <li>To send the notifications you opt into.</li>
          <li>To read login text from photos you choose to submit.</li>
          <li>To keep the service secure and working (e.g. detecting abuse, fixing errors).</li>
        </ul>
        <p className="mt-2 text-sm">
          We do <b>not</b> sell your personal information, show you ads, or track you across other apps
          or websites.
        </p>
      </Section>

      <Section title="Who can see what">
        <p className="text-sm">
          Polls, reservations, and shared logins are visible to members of the group they belong to.
          A court login you post is visible only to the specific groups you select. Owners of a login can
          see which group is currently using it; other groups only see that it is in use. Your email and
          your private calorie logs are never shown to other members.
        </p>
      </Section>

      <Section title="Service providers">
        <p className="text-sm">
          We use a small number of providers to run RallyUp. They process data only to provide their
          service to us:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>Apple Push Notification service — delivering notifications to iOS devices.</li>
          <li>Google Firebase Cloud Messaging — delivering notifications to Android devices.</li>
          <li>Cloudflare — DNS, security, and content delivery for our domain.</li>
          <li>Our email delivery provider — sending your one-time sign-in and invitation emails.</li>
          <li>Our server hosting provider — running the RallyUp backend and database.</li>
        </ul>
      </Section>

      <Section title="Data retention">
        <p className="text-sm">
          Shared court logins, their photos, and daily polls clear automatically at the end of each day.
          Your account details, group memberships, and your private calorie history are kept until you
          delete them or delete your account. Aggregate technical counts contain no personal information.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            <b>Delete your account.</b> You can delete your account and its associated data at any time
            from the app (More → account settings) or by contacting us. Deletion is permanent.
          </li>
          <li>
            <b>Notifications.</b> You control notifications from your device settings at any time.
          </li>
          <li>
            <b>Access and correction.</b> You can update your display name in the app, and you may contact
            us to request a copy or correction of your information.
          </li>
        </ul>
        <p className="mt-2 text-sm">
          Depending on where you live (for example, the EEA/UK or California), you may have additional
          rights over your personal information. Contact us to exercise them.
        </p>
      </Section>

      <Section title="Children">
        <p className="text-sm">
          RallyUp is not directed to children under 13, and we do not knowingly collect their personal
          information. If you believe a child has provided us information, contact us and we will remove it.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p className="text-sm">
          We may update this policy from time to time. We will change the effective date above and, for
          material changes, notify you in the app.
        </p>
      </Section>

      <Section title="Contact">
        <p className="text-sm">
          Questions about this policy or your data? Email us at{" "}
          <a className="text-brand underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. RallyUp
          is operated from {JURISDICTION}.
        </p>
      </Section>

      <p className="mt-10 text-sm">
        <Link className="text-brand underline" href="/terms">Terms of Service</Link>
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 text-muted">{children}</div>
    </section>
  );
}
