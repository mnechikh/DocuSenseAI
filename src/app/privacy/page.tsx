import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Lumxia",
  description: "How Lumxia collects, uses, and protects your data.",
};

const LUMXIA_GRADIENT = "linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)";
const LUMXIA_GLOW = "0 8px 32px rgba(124,140,255,0.35)";

function LumxiaLogo({ size = 32 }: { size?: number }) {
  const dot = size * 0.3;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "28%",
        background: LUMXIA_GRADIENT,
        boxShadow: LUMXIA_GLOW,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: dot,
          height: dot,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.95)",
          boxShadow: "0 0 8px 4px rgba(255,255,255,0.45)",
        }}
      />
    </div>
  );
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#F9FAFB]">
      {/* Background grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,140,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,140,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-16 py-5 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <LumxiaLogo size={32} />
          <span className="text-[17px] font-bold tracking-tight text-[#F9FAFB]">Lumxia</span>
        </Link>
        <div className="flex items-center gap-4 text-sm text-white/40">
          <Link href="/terms" className="hover:text-white/70 transition-colors">Terms of Service</Link>
          <Link href="/login" className="hover:text-white/70 transition-colors">Sign in</Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#9B8CFF" }}>Legal</p>
          <h1 className="text-4xl font-bold mb-3">Privacy Policy</h1>
          <p className="text-white/40 text-sm">Effective date: April 23, 2026 · Last updated: April 23, 2026</p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed text-[15px]">

          <Section title="1. Introduction">
            <p>
              Lumxia (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is operated by IntelliAQ Consulting. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform at <strong className="text-white/90">lumxia.com</strong> and any associated services (collectively, the &quot;Service&quot;).
            </p>
            <p>
              By accessing or using the Service, you agree to the collection and use of information as described in this policy. If you do not agree, please discontinue use of the Service.
            </p>
          </Section>

          <Section title="2. Information We Collect">
            <p>We collect the following categories of information:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white/90">Account information:</strong> Name, email address, and password (or OAuth provider token) when you register.</li>
              <li><strong className="text-white/90">Billing information:</strong> Payment details are processed by Stripe, Inc. We store only your Stripe customer ID and subscription status — never raw card numbers.</li>
              <li><strong className="text-white/90">Documents and content:</strong> Files and text you upload for AI analysis. These are stored in Google Cloud Storage and associated with your workspace tenant.</li>
              <li><strong className="text-white/90">Usage data:</strong> Log data, IP addresses, browser type, pages visited, and timestamps, collected automatically when you use the Service.</li>
              <li><strong className="text-white/90">AI query data:</strong> Queries you submit to the AI and the responses generated. These may be retained to improve service quality.</li>
            </ul>
          </Section>

          <Section title="3. How We Use Your Information">
            <ul className="list-disc pl-5 space-y-2">
              <li>To provide, maintain, and improve the Service.</li>
              <li>To process payments and manage subscriptions through Stripe.</li>
              <li>To respond to your inquiries and provide customer support.</li>
              <li>To send transactional emails (account creation, billing receipts, password resets).</li>
              <li>To detect, investigate, and prevent fraudulent or unauthorized activity.</li>
              <li>To comply with applicable legal obligations.</li>
            </ul>
            <p className="mt-4">We do not sell your personal information to third parties.</p>
          </Section>

          <Section title="4. AI Processing and Your Documents">
            <p>
              Documents you upload are processed by Google Gemini AI models to extract information and enable semantic search within your workspace. Your documents are isolated to your tenant and are not used to train third-party AI models without your explicit consent.
            </p>
            <p>
              AI-generated responses are produced by large language models and may not always be accurate. You remain responsible for verifying any information provided by the Service.
            </p>
          </Section>

          <Section title="5. Data Sharing and Third Parties">
            <p>We share data with the following third-party service providers as necessary to operate the Service:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white/90">Google Cloud Platform / Firebase:</strong> Infrastructure, authentication, database (Firestore), and cloud storage.</li>
              <li><strong className="text-white/90">Google Gemini AI:</strong> AI document processing and question answering.</li>
              <li><strong className="text-white/90">Stripe, Inc.:</strong> Payment processing and subscription management.</li>
            </ul>
            <p className="mt-4">
              We may also disclose information if required by law, court order, or governmental authority, or to protect the rights, safety, or property of Lumxia, our users, or the public.
            </p>
          </Section>

          <Section title="6. Data Retention">
            <p>
              We retain your account data for as long as your account is active. If you delete your account, we will delete your personal data and uploaded documents within 30 days, except where retention is required by law or for legitimate business purposes (e.g., billing records for up to 7 years).
            </p>
          </Section>

          <Section title="7. Security">
            <p>
              We implement industry-standard security measures including encryption in transit (TLS), access controls, and secrets management via Google Cloud Secret Manager. However, no method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.
            </p>
          </Section>

          <Section title="8. Your Rights">
            <p>Depending on your jurisdiction, you may have the right to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Access the personal data we hold about you.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your data (&quot;right to be forgotten&quot;).</li>
              <li>Object to or restrict certain processing activities.</li>
              <li>Data portability — receive your data in a machine-readable format.</li>
              <li>Withdraw consent at any time where processing is based on consent.</li>
            </ul>
            <p className="mt-4">To exercise these rights, contact us at <strong className="text-white/90">support@intellaqc.com</strong>.</p>
          </Section>

          <Section title="9. Cookies">
            <p>
              We use session cookies to maintain your authenticated state. We do not use tracking or advertising cookies. You can disable cookies in your browser settings, though this may affect Service functionality.
            </p>
          </Section>

          <Section title="10. Children&apos;s Privacy">
            <p>
              The Service is not directed to individuals under the age of 16. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us and we will delete it promptly.
            </p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting the new policy on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after changes constitutes acceptance of the updated policy.
            </p>
          </Section>

          <Section title="12. Contact Us">
            <p>
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 space-y-1 text-sm">
              <p className="text-white/90 font-medium">IntelliAQ Consulting / Lumxia</p>
              <p>Email: <a href="mailto:support@intellaqc.com" className="underline hover:text-white transition-colors">support@intellaqc.com</a></p>
              <p>Website: <a href="https://lumxia.com" className="underline hover:text-white transition-colors">lumxia.com</a></p>
            </div>
          </Section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <p>© {new Date().getFullYear()} Lumxia. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white/90 mb-4 pb-2 border-b border-white/10">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
