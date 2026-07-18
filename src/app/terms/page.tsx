import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service · RallyUp",
  description: "The terms for using RallyUp.",
};

// NOTE (for the owner): fill the placeholders, then this is store-ready at
// https://badmintonrallyup.com/terms. Apple applies its standard EULA by
// default, so a Terms page is recommended but optional for the App Store;
// Google Play does not require one. Consider a lawyer's review before public
// launch if you want the liability terms to be enforceable in your region.
const EFFECTIVE_DATE = "[EFFECTIVE DATE — e.g. July 18, 2026]";
const CONTACT_EMAIL = "[CONTACT EMAIL — e.g. support@badmintonrallyup.com]";
const JURISDICTION = "[YOUR COUNTRY / STATE]";

export default function TermsPage() {
  return (
    <main className="px-6 py-10">
      <p className="text-xs uppercase tracking-wide text-muted">Effective {EFFECTIVE_DATE}</p>
      <h1 className="mt-1 text-2xl font-bold">RallyUp Terms of Service</h1>
      <p className="mt-3 text-sm text-muted">
        These terms are an agreement between you and RallyUp (&quot;RallyUp&quot;, &quot;we&quot;,
        &quot;us&quot;). By creating an account or using RallyUp, you agree to them. If you do not agree,
        please do not use RallyUp.
      </p>

      <Section title="Who can use RallyUp">
        <p className="text-sm">
          You must be at least 13 years old and able to form a binding agreement. You are responsible for
          activity under your account and for keeping access to your email secure, since sign-in uses a
          one-time code sent to it.
        </p>
      </Section>

      <Section title="What RallyUp is for">
        <p className="text-sm">
          RallyUp helps groups coordinate badminton sessions: proposing times, voting, logging courts, and
          sharing court logins within a group. You agree to use it only for lawful, good-faith coordination
          within groups you belong to.
        </p>
      </Section>

      <Section title="Your content and shared logins">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li>
            You keep ownership of what you post. You grant us permission to store and display it to the
            group members you choose, so the app can work.
          </li>
          <li>
            When you share a court login, you confirm you are allowed to share it with those group members.
            Do not post credentials or content you do not have the right to share.
          </li>
          <li>
            You are responsible for the accuracy of what you post (for example, that a court is actually
            free before you log it).
          </li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <p className="text-sm">You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          <li>use RallyUp for anything unlawful, or to harass or harm others;</li>
          <li>access groups, logins, or data you are not authorized to access;</li>
          <li>attempt to break, overload, reverse-engineer, or disrupt the service;</li>
          <li>upload malware or content that infringes someone else&apos;s rights.</li>
        </ul>
      </Section>

      <Section title="Accounts and termination">
        <p className="text-sm">
          You can delete your account at any time from the app. We may suspend or terminate an account that
          violates these terms or that we reasonably believe creates risk or legal exposure. Some provisions
          (such as disclaimers and limitation of liability) survive termination.
        </p>
      </Section>

      <Section title="Service &quot;as is&quot;">
        <p className="text-sm">
          RallyUp is provided on an &quot;as is&quot; and &quot;as available&quot; basis, without warranties
          of any kind, to the fullest extent permitted by law. We do not guarantee that a court shown as free
          is actually available, that notifications always arrive, or that the service is uninterrupted or
          error-free.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p className="text-sm">
          To the fullest extent permitted by law, RallyUp and its operator will not be liable for indirect,
          incidental, or consequential damages, or for lost data or opportunities, arising from your use of
          the service. This is a free, community-oriented tool provided in good faith.
        </p>
      </Section>

      <Section title="Changes">
        <p className="text-sm">
          We may update these terms. We will update the effective date and, for material changes, notify you
          in the app. Continued use after a change means you accept the updated terms.
        </p>
      </Section>

      <Section title="Governing law and contact">
        <p className="text-sm">
          These terms are governed by the laws of {JURISDICTION}, without regard to conflict-of-laws rules.
          Questions? Email{" "}
          <a className="text-brand underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
        </p>
      </Section>

      <p className="mt-10 text-sm">
        <Link className="text-brand underline" href="/privacy">Privacy Policy</Link>
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
