"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  Send,
  ArrowRight,
  Sparkles,
  ChevronRight,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────
//  Demo document list (sidebar)
// ─────────────────────────────────────────────
const DEMO_DOCS = [
  { name: "Employee_Handbook_2026.pdf", pages: 34, type: "PDF" },
  { name: "Mutual_NDA_Template.docx", pages: 8, type: "DOCX" },
  { name: "IT_Security_Policy.pdf", pages: 12, type: "PDF" },
];

// ─────────────────────────────────────────────
//  Pre-scripted Q&A
// ─────────────────────────────────────────────
type DemoCitation = { docName: string; section: string };
type DemoAnswer = { text: string; citations: DemoCitation[] };

const QA_PAIRS: { keywords: string[]; answer: DemoAnswer }[] = [
  {
    keywords: ["handbook", "overview", "about handbook", "summary", "employee handbook"],
    answer: {
      text: `The Employee Handbook 2026 is your complete reference for Lumxia's policies, expectations, and benefits. It covers:\n\n• **Onboarding & Orientation** — first-week checklist, system access provisioning, team introductions\n• **Leave & Time-Off Policy** — 15 days PTO (accrued), 12 paid public holidays, 5 sick days, 3 days personal leave\n• **Remote Work Guidelines** — async-first culture, core hours 10am–3pm in your local timezone, camera optional\n• **Code of Conduct** — respect, confidentiality, conflict resolution via HR within 5 business days\n• **Performance Reviews** — bi-annual (April & October), structured feedback + growth plan\n\nThe handbook is reviewed and updated each January. Employees acknowledge receipt on their first day.`,
      citations: [
        { docName: "Employee_Handbook_2026.pdf", section: "Section 1 — Welcome & Overview" },
        { docName: "Employee_Handbook_2026.pdf", section: "Section 5 — Benefits Summary" },
      ],
    },
  },
  {
    keywords: ["pto", "vacation", "paid time off", "annual leave", "time off", "holiday", "days off"],
    answer: {
      text: `**PTO & Leave Policy (2026)**\n\nFull-time employees accrue **15 days of PTO per year** (1.25 days per month). Accrued PTO rolls over up to 5 days into the next calendar year. Unused PTO beyond that is forfeited at December 31.\n\n**Public Holidays:** 12 paid holidays per year. If a holiday falls on a weekend, the nearest weekday is observed.\n\n**Sick Leave:** 5 days per year, non-accruing, non-transferable.\n\n**Personal Leave:** 3 days per year for personal matters. Manager notification required but no reason needed.\n\n**Bereavement:** Up to 5 days for immediate family, 2 days for extended family.\n\nAll leave requests must be submitted via the HR portal at least 5 business days in advance (except medical emergencies).`,
      citations: [
        { docName: "Employee_Handbook_2026.pdf", section: "Section 4.2 — Time Off Policy" },
        { docName: "Employee_Handbook_2026.pdf", section: "Section 4.5 — Bereavement Leave" },
      ],
    },
  },
  {
    keywords: ["remote", "work from home", "wfh", "hybrid", "remote work", "working remotely"],
    answer: {
      text: `**Remote Work Policy**\n\nLumxia operates as an **async-first** organisation. Remote work is fully supported for all roles unless otherwise specified in your employment contract.\n\n**Core Hours:** Employees should be reachable and responsive during **10am–3pm in their local timezone** on business days.\n\n**Equipment:** The company provides a laptop and $500 home-office stipend upon joining. Annual refresh: $200.\n\n**Communication Norms:**\n• Slack for async messages — respond within 4 business hours during core hours\n• Video calls: camera optional. Meeting-free Fridays are encouraged.\n• Status updates required at start and end of each remote day.\n\n**Security:** All remote work must use the company VPN. Home networks must be password-protected. Public Wi-Fi requires VPN at all times.`,
      citations: [
        { docName: "Employee_Handbook_2026.pdf", section: "Section 7 — Remote Work Guidelines" },
        { docName: "IT_Security_Policy.pdf", section: "Section 3.1 — Remote Access Requirements" },
      ],
    },
  },
  {
    keywords: ["onboarding", "first day", "new hire", "new employee", "start", "joining"],
    answer: {
      text: `**New Employee Onboarding Checklist**\n\n**Before Day 1 (HR completes):**\n• Employment contract signed\n• Laptop shipped or ready\n• Accounts provisioned (email, Slack, Zoom, GitHub)\n• Buddy assigned\n\n**Day 1:**\n✓ IT orientation & security briefing (9am)\n✓ HR welcome session (10am)\n✓ Meet your team & buddy lunch\n✓ Review and sign Employee Handbook acknowledgement\n✓ Complete mandatory security training (Module 1)\n\n**Week 1:**\n✓ Product deep-dive with your manager\n✓ Complete security training Modules 2–4\n✓ First 1-on-1 with manager (Day 3)\n✓ Access all required systems and test permissions\n\n**30-Day Milestone:** First formal check-in with manager. Goals aligned for 90-day period.`,
      citations: [
        { docName: "Employee_Handbook_2026.pdf", section: "Section 2 — Onboarding Process" },
        { docName: "IT_Security_Policy.pdf", section: "Section 2 — Access Provisioning" },
      ],
    },
  },
  {
    keywords: ["nda", "non-disclosure", "confidentiality agreement", "nda template", "mutual nda", "non disclosure"],
    answer: {
      text: `**Mutual NDA — Key Terms Summary**\n\n**Parties:** Both parties share and receive confidential information (mutual obligations).\n\n**Definition of Confidential Information:** Any non-public information disclosed in any form — written, oral, electronic — that is marked confidential or would reasonably be understood to be confidential given the context.\n\n**Obligations:**\n• Maintain strict confidentiality of the other party's information\n• Use only for the stated Purpose of the agreement\n• Disclose only to employees with a need-to-know basis\n• Apply at minimum the same protections as your own proprietary information (no less than reasonable care)\n\n**Term:** Obligations survive for **3 years** after the date of disclosure or termination of the agreement, whichever is later.\n\n**Exclusions:** See next section for what is NOT covered.`,
      citations: [
        { docName: "Mutual_NDA_Template.docx", section: "Clause 1 — Definitions" },
        { docName: "Mutual_NDA_Template.docx", section: "Clause 3 — Obligations of Receiving Party" },
      ],
    },
  },
  {
    keywords: ["nda exclusion", "excluded", "not confidential", "carve out", "carveout", "exception", "exclusions"],
    answer: {
      text: `**NDA Exclusions — What is NOT Confidential**\n\nThe following categories of information are explicitly excluded from confidentiality obligations under the Mutual NDA:\n\n1. **Publicly available information** — information already in the public domain at the time of disclosure (or that becomes public through no fault of the receiving party)\n2. **Prior knowledge** — information the receiving party already possessed before disclosure, as evidenced by prior written records\n3. **Independent development** — information independently developed by the receiving party without use of or reference to the disclosing party's information\n4. **Third-party disclosure** — information received from a third party who has a lawful right to disclose it\n5. **Legal compulsion** — disclosure required by law, court order, or regulatory authority (with prompt prior written notice to the disclosing party where permitted)\n\n**Important:** The burden of proving an exclusion applies rests with the receiving party.`,
      citations: [
        { docName: "Mutual_NDA_Template.docx", section: "Clause 4 — Exclusions from Confidential Information" },
      ],
    },
  },
  {
    keywords: ["breach", "violation", "remedies", "injunction", "damages", "nda breach"],
    answer: {
      text: `**Remedies for NDA Breach**\n\nThe NDA template includes the following remedies provisions:\n\n**Injunctive Relief:** The parties acknowledge that breach of confidentiality obligations would cause irreparable harm for which monetary damages would be inadequate. The non-breaching party is entitled to seek injunctive relief without posting bond and without proving actual damages.\n\n**Damages:** In addition to injunctive relief, the breaching party is liable for:\n• Direct damages caused by the breach\n• Reasonable attorney's fees and litigation costs if the non-breaching party prevails\n\n**Governing Law:** Disputes shall be governed by the laws of the state specified in the signature block, with exclusive jurisdiction in the courts of that state.\n\n**No Waiver:** Failure to enforce any provision does not waive the right to enforce it later.`,
      citations: [
        { docName: "Mutual_NDA_Template.docx", section: "Clause 7 — Remedies" },
        { docName: "Mutual_NDA_Template.docx", section: "Clause 9 — Governing Law" },
      ],
    },
  },
  {
    keywords: ["mfa", "two factor", "2fa", "multi-factor", "authentication", "password", "password policy"],
    answer: {
      text: `**Password & MFA Policy**\n\n**Password Requirements:**\n• Minimum 14 characters\n• Must include: uppercase, lowercase, number, and special character\n• No reuse of last 12 passwords\n• Maximum password age: 90 days (enforced by IdP)\n• Breached password detection enabled via HaveIBeenPwned API integration\n\n**Multi-Factor Authentication (MFA):**\n• MFA is **mandatory** for all accounts with access to company systems\n• Acceptable factors: TOTP authenticator app (preferred), hardware security key (YubiKey), SMS (permitted but discouraged)\n• MFA must be enrolled within 24 hours of account creation\n• Recovery codes must be stored in the company password manager (1Password)\n\n**Password Manager:**\n• All employees provisioned with 1Password Business\n• Passwords for shared accounts must be stored in shared vaults, not personal email`,
      citations: [
        { docName: "IT_Security_Policy.pdf", section: "Section 4 — Password & Authentication Standards" },
        { docName: "IT_Security_Policy.pdf", section: "Section 4.3 — Multi-Factor Authentication" },
      ],
    },
  },
  {
    keywords: ["incident", "data breach", "security incident", "report incident", "incident response", "compromise"],
    answer: {
      text: `**Security Incident Response Procedure**\n\n**Step 1 — Detect & Report (0–1 hour)**\nAny employee who suspects or observes a security incident must report immediately to security@company.com and notify their manager. Do not attempt to investigate independently.\n\n**Step 2 — Triage (1–4 hours)**\nThe Security team classifies severity:\n• **P1 (Critical):** Active breach, data exfiltration in progress, ransomware\n• **P2 (High):** Confirmed unauthorised access, credentials compromised\n• **P3 (Medium):** Suspicious activity, policy violation\n\n**Step 3 — Contain & Eradicate**\n• P1/P2: Affected systems isolated within 2 hours of classification\n• Credentials reset for all potentially compromised accounts\n• Forensic snapshot taken before remediation begins\n\n**Step 4 — Notify**\n• Affected users notified within 72 hours (GDPR requirement)\n• Regulatory notification if required by applicable data protection law\n\n**Step 5 — Post-Incident Review**\nWithin 5 business days, a root-cause analysis and corrective action plan is filed.`,
      citations: [
        { docName: "IT_Security_Policy.pdf", section: "Section 8 — Incident Response" },
        { docName: "IT_Security_Policy.pdf", section: "Section 8.4 — Notification Obligations" },
      ],
    },
  },
  {
    keywords: ["access", "provisioning", "account", "permissions", "offboarding", "termination", "revoke"],
    answer: {
      text: `**Access Provisioning & De-provisioning**\n\n**New Employee Access:**\n• IT provisions accounts within 24 hours of signed offer letter confirmation\n• Access follows the principle of least privilege — only systems required for the role\n• All access logged in the Access Control Register\n• Manager must submit an Access Request Form specifying systems and permission level\n\n**Access Reviews:**\n• Quarterly access reviews for all systems with elevated privileges\n• Annual review for standard user accounts\n• Dormant accounts (no login for 60 days) are automatically suspended\n\n**Offboarding / Termination:**\n• All access revoked within **1 hour** of HR issuing termination notice\n• Corporate device retrieved on or before last working day\n• Personal device MDM profile removed within 24 hours\n• Email forwarding may be enabled for up to 30 days (manager discretion)\n• Former employees may not retain copies of any company data`,
      citations: [
        { docName: "IT_Security_Policy.pdf", section: "Section 2 — Access Control" },
        { docName: "IT_Security_Policy.pdf", section: "Section 2.5 — Offboarding Procedures" },
      ],
    },
  },
  {
    keywords: ["what is lumxia", "what does lumxia do", "tell me about", "explain", "how does"],
    answer: {
      text: `**About This Demo**\n\nYou're exploring Lumxia's AI-powered document knowledge system. In this demo, three sample documents have been pre-loaded:\n\n📄 **Employee_Handbook_2026.pdf** — company policies, PTO, remote work guidelines, onboarding process\n\n📄 **Mutual_NDA_Template.docx** — confidentiality obligations, exclusions, breach remedies, governing law\n\n📄 **IT_Security_Policy.pdf** — password policy, MFA requirements, access provisioning, incident response\n\n**Try asking about:**\n• "What is our PTO policy?"\n• "What are the NDA exclusions?"\n• "What happens during a security incident?"\n• "Walk me through the onboarding checklist"\n\nIn a real Lumxia workspace, answers come directly from your own uploaded documents with full source citations.`,
      citations: [],
    },
  },
];

const FALLBACK: DemoAnswer = {
  text: `I can only answer questions about the three sample documents loaded in this demo:\n\n• **Employee_Handbook_2026.pdf** — PTO, onboarding, remote work, code of conduct\n• **Mutual_NDA_Template.docx** — confidentiality terms, exclusions, breach remedies\n• **IT_Security_Policy.pdf** — passwords, MFA, access control, incident response\n\nTry one of the suggested questions above, or ask something specific about one of these documents.`,
  citations: [],
};

function matchQuery(input: string): DemoAnswer {
  const lower = input.toLowerCase();
  let best: { answer: DemoAnswer; score: number } | null = null;
  for (const qa of QA_PAIRS) {
    const score = qa.keywords.filter((k) => lower.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) {
      best = { answer: qa.answer, score };
    }
  }
  return best?.answer ?? FALLBACK;
}

// ─────────────────────────────────────────────
//  Suggested questions
// ─────────────────────────────────────────────
const SUGGESTED = [
  "What's our PTO policy?",
  "Walk me through the onboarding checklist",
  "What are the NDA exclusions?",
  "Explain the MFA requirements",
  "How do we respond to a security incident?",
];

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
type Message = {
  role: "user" | "assistant";
  text: string;
  fullText?: string;
  citations?: DemoCitation[];
  streaming?: boolean;
};

const G = "linear-gradient(135deg, #7C8CFF 0%, #9B8CFF 50%, #C084FC 100%)";
const GLOW = "0 8px 32px rgba(124,140,255,0.35)";

function Logo({ size = 32 }: { size?: number }) {
  const dot = size * 0.3;
  return (
    <div style={{ width: size, height: size, borderRadius: "28%", background: G, boxShadow: GLOW, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <div style={{ width: dot, height: dot, borderRadius: "50%", background: "rgba(255,255,255,0.95)", boxShadow: "0 0 8px 4px rgba(255,255,255,0.45)" }} />
    </div>
  );
}

export default function DemoPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => () => { if (streamInterval.current) clearInterval(streamInterval.current); }, []);

  function handleSend(text?: string) {
    const query = (text ?? input).trim();
    if (!query || streaming) return;
    setInput("");

    const userMsg: Message = { role: "user", text: query };
    const answer = matchQuery(query);

    const assistantMsg: Message = {
      role: "assistant",
      text: "",
      fullText: answer.text,
      citations: answer.citations,
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    let idx = 0;
    streamInterval.current = setInterval(() => {
      idx += 2; // 2 chars per tick at 12ms = ~166 chars/sec
      const slice = answer.text.slice(0, idx);
      setMessages((prev) =>
        prev.map((m, i) =>
          i === prev.length - 1 ? { ...m, text: slice, streaming: idx < answer.text.length } : m
        )
      );
      if (idx >= answer.text.length) {
        clearInterval(streamInterval.current!);
        streamInterval.current = null;
        setStreaming(false);
      }
    }, 12);
  }

  function renderText(text: string) {
    // Render **bold** inline and newlines as <br/>
    return text.split("\n").map((line, li) => {
      const parts = line.split(/\*\*([^*]+)\*\*/g);
      return (
        <span key={li}>
          {li > 0 && <br />}
          {parts.map((p, pi) => (pi % 2 === 1 ? <strong key={pi}>{p}</strong> : <span key={pi}>{p}</span>))}
        </span>
      );
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#0B0F1A] text-[#F9FAFB] overflow-hidden">

      {/* Ambient */}
      <div className="fixed inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(124,140,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,140,255,0.04) 1px, transparent 1px)", backgroundSize: "64px 64px" }} />

      {/* TOP BANNER */}
      {!bannerDismissed && (
        <div className="relative z-20 flex items-center justify-center gap-3 px-4 py-2.5 text-xs" style={{ background: "linear-gradient(90deg, rgba(251,191,36,0.12), rgba(251,191,36,0.08))", borderBottom: "1px solid rgba(251,191,36,0.18)" }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="text-amber-200/80">
            You&apos;re in <strong className="text-amber-300">Demo Mode</strong> — responses are pre-scripted using sample documents. No account needed.
          </span>
          <Link href="/login" className="ml-2 shrink-0">
            <Button size="sm" className="h-6 px-3 text-[11px] border-0 rounded-lg" style={{ background: G, color: "#fff" }}>
              Sign up free <ArrowRight className="ml-1 w-3 h-3" />
            </Button>
          </Link>
          <button onClick={() => setBannerDismissed(true)} className="ml-1 shrink-0 p-1 opacity-40 hover:opacity-70 transition-opacity">
            <X className="w-3.5 h-3.5 text-amber-300" />
          </button>
        </div>
      )}

      {/* NAV */}
      <nav className="relative z-10 flex items-center justify-between px-5 md:px-8 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="text-[16px] font-bold tracking-tight">Lumxia</span>
          <span className="text-[10px] text-amber-400/70 font-semibold uppercase tracking-widest ml-1 px-1.5 py-0.5 rounded" style={{ background: "rgba(251,191,36,0.10)", border: "1px solid rgba(251,191,36,0.2)" }}>Demo</span>
        </Link>
        <Link href="/login">
          <Button size="sm" className="text-white text-xs h-8 px-4 border-0 rounded-lg gap-1.5" style={{ background: G, boxShadow: "0 2px 12px rgba(124,140,255,0.3)" }}>
            Start Free <ArrowRight className="w-3 h-3" />
          </Button>
        </Link>
      </nav>

      {/* MAIN */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/5 bg-[#0D1220]/60 backdrop-blur-sm">
          <div className="px-5 pt-6 pb-4 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold mb-3">Sample Documents</p>
            <div className="space-y-2">
              {DEMO_DOCS.map((doc) => (
                <div key={doc.name} className="flex items-start gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(31,41,55,0.5)" }}>
                  <FileText className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#9B8CFF" }} />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[#E5E7EB] leading-tight truncate">{doc.name}</p>
                    <p className="text-[10px] text-[#6B7280] mt-0.5">{doc.pages} pages · {doc.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="px-5 pt-5 pb-4">
            <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold mb-3">Try asking</p>
            <div className="space-y-1.5">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  disabled={streaming}
                  className="w-full text-left text-xs text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-40"
                >
                  <ChevronRight className="w-3 h-3 shrink-0 text-[#7C8CFF]" />
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto p-5 border-t border-white/5">
            <div className="p-4 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(124,140,255,0.12), rgba(192,132,252,0.08))", border: "1px solid rgba(124,140,255,0.15)" }}>
              <p className="text-xs font-semibold text-[#F9FAFB] mb-1">Use your own docs</p>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed mb-3">Upload your documents and get AI answers from your actual content.</p>
              <Link href="/login">
                <Button size="sm" className="w-full h-7 text-[11px] border-0 rounded-lg" style={{ background: G, color: "#fff" }}>
                  Start Free
                </Button>
              </Link>
            </div>
          </div>
        </aside>

        {/* CHAT PANE */}
        <div className="flex flex-col flex-1 overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-5">

            {/* Welcome state */}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "rgba(124,140,255,0.12)", border: "1px solid rgba(124,140,255,0.2)" }}>
                  <MessageSquare className="w-6 h-6" style={{ color: "#9B8CFF" }} />
                </div>
                <div>
                  <p className="text-base font-semibold text-[#F9FAFB] mb-1">Ask anything about the sample documents</p>
                  <p className="text-sm text-[#6B7280]">Try one of the suggested questions, or type your own below</p>
                </div>
                {/* Mobile suggested chips */}
                <div className="flex flex-wrap justify-center gap-2 mt-2 md:hidden">
                  {SUGGESTED.slice(0, 3).map((q) => (
                    <button key={q} onClick={() => handleSend(q)} disabled={streaming} className="text-xs px-3 py-1.5 rounded-full border border-white/10 hover:border-white/20 hover:bg-white/5 text-[#9CA3AF] hover:text-[#F9FAFB] transition-colors">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="flex items-start gap-3 max-w-2xl w-full">
                    <div className="mt-1 shrink-0"><Logo size={28} /></div>
                    <div className="flex flex-col gap-2 min-w-0">
                      <div className="rounded-2xl rounded-tl-sm px-5 py-4 text-sm leading-relaxed" style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <p className="whitespace-pre-line">{renderText(msg.text)}{msg.streaming && <span className="inline-block w-1 h-3.5 ml-0.5 rounded-sm animate-pulse" style={{ background: "#9B8CFF", verticalAlign: "text-bottom" }} />}</p>
                      </div>
                      {!msg.streaming && msg.citations && msg.citations.length > 0 && (
                        <div className="space-y-1.5 px-1">
                          <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold">Sources</p>
                          {msg.citations.map((c, ci) => (
                            <div key={ci} className="flex items-center gap-2 text-[11px] text-[#9CA3AF] rounded-lg px-3 py-1.5" style={{ background: "rgba(124,140,255,0.07)", border: "1px solid rgba(124,140,255,0.12)" }}>
                              <FileText className="w-3 h-3 shrink-0" style={{ color: "#7C8CFF" }} />
                              <span className="font-medium text-[#C4B5FD]">{c.docName}</span>
                              <span className="opacity-50">·</span>
                              <span>{c.section}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="max-w-lg rounded-2xl rounded-tr-sm px-5 py-3 text-sm" style={{ background: "rgba(124,140,255,0.14)", border: "1px solid rgba(124,140,255,0.2)" }}>
                    {msg.text}
                  </div>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div className="px-4 pb-5 pt-3 border-t border-white/5">
            <form
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={streaming}
                placeholder="Ask a question about the sample documents…"
                className="flex-1 px-4 py-3 rounded-xl text-sm text-[#F9FAFB] placeholder-[#6B7280] outline-none disabled:opacity-50"
                style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <Button
                type="submit"
                disabled={!input.trim() || streaming}
                className="h-11 w-11 p-0 shrink-0 border-0 rounded-xl disabled:opacity-30"
                style={{ background: G }}
              >
                <Send className="w-4 h-4 text-white" />
              </Button>
            </form>
            <p className="text-center text-[10px] text-[#4B5563] mt-2">Demo mode · Answers are pre-scripted from sample documents</p>
          </div>
        </div>
      </div>
    </div>
  );
}
