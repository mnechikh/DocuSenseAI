import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Lumxia",
  description: "The terms and conditions governing use of the Lumxia platform.",
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

export default function TermsPage() {
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
          <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy Policy</Link>
          <Link href="/login" className="hover:text-white/70 transition-colors">Sign in</Link>
        </div>
      </nav>

      {/* Content */}
      <main className="relative z-10 max-w-3xl mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#9B8CFF" }}>Legal</p>
          <h1 className="text-4xl font-bold mb-3">Terms of Service</h1>
          <p className="text-white/40 text-sm">Effective date: April 23, 2026 · Last updated: April 23, 2026</p>
        </div>

        <div className="space-y-10 text-white/70 leading-relaxed text-[15px]">

          <Section title="1. Acceptance of Terms">
            <p>
              These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you and IntelliAQ Consulting (&quot;Lumxia&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) governing your access to and use of the Lumxia platform at <strong className="text-white/90">lumxia.com</strong> and all associated services (collectively, the &quot;Service&quot;).
            </p>
            <p>
              By creating an account or using the Service, you confirm that you are at least 16 years old and have the legal capacity to enter into this agreement. If you are using the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Lumxia is an AI-powered document intelligence platform that allows teams to upload documents, extract structured information, and query their knowledge base using natural language. The Service includes:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Document upload and AI-powered processing</li>
              <li>Semantic search and AI question answering over your documents</li>
              <li>Multi-user workspace management with role-based access</li>
              <li>REST API access for programmatic integration (paid plans)</li>
              <li>Billing and subscription management via Stripe</li>
            </ul>
          </Section>

          <Section title="3. Account Registration">
            <p>
              To use the Service, you must create an account with a valid email address. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You agree to notify us immediately at <strong className="text-white/90">support@lumxia.com</strong> of any unauthorized use of your account.
            </p>
            <p>
              We reserve the right to suspend or terminate accounts that violate these Terms, provide false information, or engage in abusive or fraudulent activity.
            </p>
          </Section>

          <Section title="4. Subscription Plans and Billing">
            <p>
              Lumxia offers the following plans:
            </p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li><strong className="text-white/90">Free:</strong> Limited access to core features. No payment required.</li>
              <li><strong className="text-white/90">Starter:</strong> Monthly subscription billed via Stripe. Includes expanded document limits and AI queries.</li>
              <li><strong className="text-white/90">Pro:</strong> Monthly subscription billed via Stripe. Includes full API access, higher limits, and priority processing.</li>
            </ul>
            <p className="mt-4">
              Subscriptions renew automatically at the end of each billing period unless cancelled. You may cancel at any time from your Billing settings page. Cancellation takes effect at the end of the current paid period — no prorated refunds are provided for partial periods unless required by law.
            </p>
            <p>
              We reserve the right to change pricing with 30 days&apos; notice. Continued use after the notice period constitutes acceptance of the new pricing.
            </p>
          </Section>

          <Section title="5. Acceptable Use">
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc pl-5 space-y-2 mt-3">
              <li>Upload content that is illegal, defamatory, obscene, or infringes third-party intellectual property rights.</li>
              <li>Transmit malware, viruses, or any code designed to disrupt or damage systems.</li>
              <li>Attempt to gain unauthorized access to the Service, other accounts, or underlying infrastructure.</li>
              <li>Reverse-engineer, decompile, or extract source code from the Service.</li>
              <li>Use the Service to build a competing product or benchmark against competitors without our consent.</li>
              <li>Circumvent rate limits, quotas, or access controls.</li>
              <li>Use automated means to scrape, crawl, or harvest data from the Service beyond normal API usage.</li>
            </ul>
          </Section>

          <Section title="6. Your Content">
            <p>
              You retain full ownership of documents and data you upload to Lumxia (&quot;Your Content&quot;). By uploading content, you grant us a limited, non-exclusive license to process, store, and transmit Your Content solely to provide the Service to you.
            </p>
            <p>
              You are solely responsible for ensuring that Your Content does not violate any applicable laws or third-party rights. We do not review content proactively but reserve the right to remove content that violates these Terms.
            </p>
          </Section>

          <Section title="7. AI-Generated Content">
            <p>
              The Service uses artificial intelligence to process documents and generate responses. AI-generated output is provided for informational purposes only. We make no representations or warranties about the accuracy, completeness, or reliability of AI-generated content. You assume full responsibility for how you use AI output and should independently verify any critical information.
            </p>
          </Section>

          <Section title="8. Intellectual Property">
            <p>
              The Lumxia platform, including its software, design, branding, and documentation, is the exclusive property of IntelliAQ Consulting and is protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works based on the Service without our prior written consent.
            </p>
          </Section>

          <Section title="9. Privacy">
            <p>
              Your use of the Service is governed by our <Link href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</Link>, which is incorporated into these Terms by reference. By using the Service, you consent to the collection and use of your information as described therein.
            </p>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
            </p>
          </Section>

          <Section title="11. Limitation of Liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL LUMXIA OR INTELLIAQ CONSULTING BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED TO YOUR USE OF OR INABILITY TO USE THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
            </p>
            <p>
              OUR TOTAL CUMULATIVE LIABILITY FOR ANY CLAIMS ARISING UNDER THESE TERMS SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE 12 MONTHS PRECEDING THE CLAIM.
            </p>
          </Section>

          <Section title="12. Indemnification">
            <p>
              You agree to indemnify, defend, and hold harmless Lumxia, IntelliAQ Consulting, and their officers, directors, employees, and agents from any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of your use of the Service, Your Content, or your violation of these Terms.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may terminate your account at any time by contacting us or using the account deletion feature in your settings. We may suspend or terminate your access immediately and without notice if you breach these Terms or if we determine, in our sole discretion, that your use poses a risk to other users or the Service.
            </p>
            <p>
              Upon termination, your right to use the Service ceases. Sections 6, 8, 10, 11, 12, and 15 survive termination.
            </p>
          </Section>

          <Section title="14. Changes to Terms">
            <p>
              We may modify these Terms at any time. We will provide at least 14 days&apos; notice of material changes by posting the updated Terms on this page and updating the &quot;Last updated&quot; date. Your continued use of the Service after the effective date constitutes acceptance of the revised Terms.
            </p>
          </Section>

          <Section title="15. Governing Law">
            <p>
              These Terms are governed by the laws of the State of California, United States, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved exclusively in the state or federal courts located in California, and you consent to personal jurisdiction in those courts.
            </p>
          </Section>

          <Section title="16. Contact Us">
            <p>
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5 space-y-1 text-sm">
              <p className="text-white/90 font-medium">IntelliAQ Consulting / Lumxia</p>
              <p>Email: <a href="mailto:legal@lumxia.com" className="underline hover:text-white transition-colors">legal@lumxia.com</a></p>
              <p>Website: <a href="https://lumxia.com" className="underline hover:text-white transition-colors">lumxia.com</a></p>
            </div>
          </Section>

        </div>

        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <p>© {new Date().getFullYear()} Lumxia. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
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
