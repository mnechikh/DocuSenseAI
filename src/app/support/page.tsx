import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support & Help | Lumxia",
  description: "Learn how to use Lumxia — upload documents, ask questions, manage your team, and more.",
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

function StepBadge({ n }: { n: number }) {
  return (
    <div
      className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white"
      style={{ background: LUMXIA_GRADIENT }}
    >
      {n}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      {children}
    </div>
  );
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-2xl font-bold text-white mb-6">{title}</h2>
      {children}
    </section>
  );
}

function FAQ({ q, a }: { q: string; a: React.ReactNode }) {
  return (
    <div className="border-b border-white/10 pb-5">
      <p className="font-medium text-white/90 mb-2">{q}</p>
      <div className="text-white/55 text-[15px] leading-relaxed">{a}</div>
    </div>
  );
}

export default function SupportPage() {
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
          <Link href="/privacy" className="hover:text-white/70 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-white/70 transition-colors">Terms</Link>
          <Link href="/login" className="hover:text-white/70 transition-colors">Sign in</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-14 text-center">
          <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: "#9B8CFF" }}>Help Center</p>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How to use Lumxia</h1>
          <p className="text-white/45 text-lg max-w-xl mx-auto">
            Everything you need to get your team up and running — from signing up to querying your documents with AI.
          </p>
        </div>

        {/* Quick nav */}
        <div className="flex flex-wrap gap-3 mb-16 justify-center">
          {[
            ["#getting-started", "Getting Started"],
            ["#documents", "Uploading Documents"],
            ["#chat", "AI Chat"],
            ["#team", "Managing Your Team"],
            ["#billing", "Plans & Billing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="px-4 py-2 rounded-full text-sm border border-white/10 text-white/50 hover:text-white hover:border-white/25 transition-all"
            >
              {label}
            </a>
          ))}
        </div>

        <div className="space-y-16">

          {/* ── Getting Started ── */}
          <Section title="Getting Started" id="getting-started">
            <div className="space-y-4">
              {[
                {
                  title: "Create your account",
                  body: "Go to lumxia.com and click Get started. Enter your name, email, and a password — or sign in instantly with Google. Your workspace is created automatically and activated right away on the free tier.",
                },
                {
                  title: "Explore your dashboard",
                  body: "After signing in you land on the Dashboard. The left sidebar gives you access to Documents, Chat, Users, and Billing. The top of the dashboard shows your plan and workspace details.",
                },
                {
                  title: "Upgrade when you're ready",
                  body: "The free plan lets you explore the platform. When you're ready for unlimited documents, AI queries, or API access, click Upgrade in the sidebar or visit the Billing page.",
                },
              ].map((step, i) => (
                <Card key={i}>
                  <div className="flex gap-4 items-start">
                    <StepBadge n={i + 1} />
                    <div>
                      <p className="font-semibold text-white/90 mb-1">{step.title}</p>
                      <p className="text-white/50 text-[15px] leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── Documents ── */}
          <Section title="Uploading Documents" id="documents">
            <p className="text-white/50 mb-6 text-[15px]">
              Lumxia turns your documents into a searchable AI knowledge base. Supported formats include PDF, Word (.docx), plain text, and more.
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "Go to Documents",
                  body: "Click Documents in the left sidebar. You'll see all documents uploaded to your workspace.",
                },
                {
                  title: "Upload a file",
                  body: "Click the Upload button in the top right. Select a file from your computer. Lumxia will automatically extract and index the content using AI — this usually takes a few seconds.",
                },
                {
                  title: "Wait for processing",
                  body: "A status indicator shows whether a document is Processing or Ready. Only Ready documents can be queried in the AI Chat. Large documents may take longer.",
                },
                {
                  title: "Manage your documents",
                  body: "You can view document details, see when it was uploaded, and delete documents you no longer need. Deleted documents are removed from the AI knowledge base immediately.",
                },
              ].map((step, i) => (
                <Card key={i}>
                  <div className="flex gap-4 items-start">
                    <StepBadge n={i + 1} />
                    <div>
                      <p className="font-semibold text-white/90 mb-1">{step.title}</p>
                      <p className="text-white/50 text-[15px] leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── Chat ── */}
          <Section title="AI Chat" id="chat">
            <p className="text-white/50 mb-6 text-[15px]">
              The Chat page lets you ask questions in plain English and get answers drawn from your uploaded documents — powered by Google Gemini.
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "Open Chat",
                  body: "Click Chat in the left sidebar. You'll see a message input at the bottom of the screen.",
                },
                {
                  title: "Ask a question",
                  body: 'Type any question related to your documents and press Enter or click Send. For example: "What are the payment terms in the vendor contract?" or "Summarize the Q3 report."',
                },
                {
                  title: "Review the answer",
                  body: "Lumxia searches your document knowledge base and returns an AI-generated answer. Answers are grounded in your actual document content — not generic internet knowledge.",
                },
                {
                  title: "Ask follow-ups",
                  body: "You can continue the conversation with follow-up questions in the same session. The AI maintains context across the conversation.",
                },
              ].map((step, i) => (
                <Card key={i}>
                  <div className="flex gap-4 items-start">
                    <StepBadge n={i + 1} />
                    <div>
                      <p className="font-semibold text-white/90 mb-1">{step.title}</p>
                      <p className="text-white/50 text-[15px] leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-[#9B8CFF]/20 bg-[#9B8CFF]/5 px-5 py-4 text-sm text-white/50">
              <strong className="text-white/80">Tip:</strong> The more documents you upload, the more accurate and comprehensive the AI answers become. Group related documents together in the same workspace for best results.
            </div>
          </Section>

          {/* ── Team ── */}
          <Section title="Managing Your Team" id="team">
            <p className="text-white/50 mb-6 text-[15px]">
              Lumxia supports multi-user workspaces. As the workspace owner (Admin), you can invite team members and control their access.
            </p>
            <div className="grid md:grid-cols-2 gap-4">
              {[
                {
                  title: "Roles",
                  body: "Admin — full access to all features including user management and billing.\nMember — can upload documents and use AI Chat but cannot manage users or billing.",
                },
                {
                  title: "Inviting users",
                  body: "Go to Users in the sidebar. Click Invite User, enter their email address and assign a role. They will receive an invite and can sign up or log in to join your workspace.",
                },
                {
                  title: "Removing users",
                  body: "In the Users page, click the menu next to a user and select Remove. They will immediately lose access to your workspace and its documents.",
                },
                {
                  title: "Workspace isolation",
                  body: "Each workspace is fully isolated. Team members can only see and query documents within your workspace — not documents from other organizations.",
                },
              ].map((item, i) => (
                <Card key={i}>
                  <p className="font-semibold text-white/90 mb-2">{item.title}</p>
                  <p className="text-white/50 text-[15px] leading-relaxed whitespace-pre-line">{item.body}</p>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── Billing ── */}
          <Section title="Plans & Billing" id="billing">
            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                {
                  name: "Free",
                  price: "$0/mo",
                  features: ["Core document upload", "AI Chat", "Up to 3 users", "Community support"],
                },
                {
                  name: "Starter",
                  price: "From $29/mo",
                  features: ["Everything in Free", "Higher document limits", "More AI queries/mo", "Email support"],
                  highlight: true,
                },
                {
                  name: "Pro",
                  price: "From $79/mo",
                  features: ["Everything in Starter", "REST API access", "API key management", "Priority support"],
                },
              ].map((plan) => (
                <Card key={plan.name}>
                  <div
                    className="text-xs font-bold uppercase tracking-widest mb-1"
                    style={{ color: plan.highlight ? "#9B8CFF" : undefined }}
                  >
                    {plan.name}
                  </div>
                  <div className="text-2xl font-bold text-white mb-4">{plan.price}</div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-white/50">
                        <span className="mt-0.5 text-[#9B8CFF]">✓</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>

            <div className="space-y-4">
              {[
                {
                  title: "Upgrading your plan",
                  body: "Go to Billing in the sidebar and click Upgrade. You'll be taken to a secure Stripe checkout page. Enter your card details — Lumxia never stores raw card numbers.",
                },
                {
                  title: "Managing your subscription",
                  body: "From the Billing page, click Manage Subscription to open the Stripe billing portal. There you can update your payment method, view invoices, and cancel.",
                },
                {
                  title: "Cancelling",
                  body: "You can cancel at any time from the billing portal. Your plan remains active until the end of the current billing period — you won't be charged again after that.",
                },
              ].map((step, i) => (
                <Card key={i}>
                  <div className="flex gap-4 items-start">
                    <StepBadge n={i + 1} />
                    <div>
                      <p className="font-semibold text-white/90 mb-1">{step.title}</p>
                      <p className="text-white/50 text-[15px] leading-relaxed">{step.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </Section>

          {/* ── FAQ ── */}
          <Section title="Frequently Asked Questions" id="faq">
            <div className="space-y-5">
              <FAQ
                q="What file types can I upload?"
                a="PDF, Word (.docx), plain text (.txt), and Markdown (.md) are fully supported. Support for additional formats is coming soon."
              />
              <FAQ
                q="Is my data private and secure?"
                a={<>Your documents are stored securely in Google Cloud Storage and are isolated to your workspace. We never share your content with other organizations or use it to train AI models without your consent. See our <Link href="/privacy" className="underline hover:text-white transition-colors">Privacy Policy</Link> for full details.</>}
              />
              <FAQ
                q="How accurate are the AI answers?"
                a="Lumxia grounds its answers in your actual documents using semantic search. Accuracy depends on the quality and completeness of your uploaded content. Always verify critical information independently — AI systems can make mistakes."
              />
              <FAQ
                q="Can I use Lumxia via API?"
                a="Yes — REST API access is available on the Pro plan. Once subscribed, visit API Keys in the sidebar to generate your keys and view the API documentation."
              />
              <FAQ
                q="What happens to my documents if I cancel?"
                a="Your documents remain accessible until the end of your billing period. After cancellation, your account moves to the free tier limits. You can export or delete your data at any time from the Documents page."
              />
              <FAQ
                q="How do I reset my password?"
                a='On the login page, click "Forgot password?" and enter your email. You\'ll receive a reset link within a few minutes. Check your spam folder if it doesn\'t arrive.'
              />
              <FAQ
                q="I have a question that isn't answered here."
                a={<>Email us at <a href="mailto:support@lumxia.com" className="underline hover:text-white transition-colors">support@lumxia.com</a> and we'll get back to you as soon as possible.</>}
              />
            </div>
          </Section>

          {/* ── Contact CTA ── */}
          <div
            className="rounded-2xl p-8 text-center"
            style={{ background: "linear-gradient(135deg, rgba(124,140,255,0.12) 0%, rgba(192,132,252,0.08) 100%)", border: "1px solid rgba(124,140,255,0.2)" }}
          >
            <h3 className="text-xl font-bold mb-2">Still need help?</h3>
            <p className="text-white/50 mb-6 text-[15px]">Our support team typically responds within one business day.</p>
            <a
              href="mailto:support@lumxia.com"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: LUMXIA_GRADIENT, boxShadow: "0 4px 16px rgba(124,140,255,0.3)" }}
            >
              Email support@lumxia.com
            </a>
          </div>

        </div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/30">
          <p>© {new Date().getFullYear()} Lumxia. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-white/60 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white/60 transition-colors">Terms of Service</Link>
            <Link href="/" className="hover:text-white/60 transition-colors">Home</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
