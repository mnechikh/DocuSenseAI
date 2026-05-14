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
  Zap,
  Globe,
  CheckCircle2,
  Loader2,
  Menu,
  Mic,
  MicOff,
  FileCode,
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
//  Connected APIs (sidebar)
// ─────────────────────────────────────────────
const CONNECTED_APIS = [
  { name: "Procurement API", status: "live", color: "#34D399" },
  { name: "HR Management System", status: "live", color: "#34D399" },
  { name: "Contract Database", status: "live", color: "#34D399" },
];

// ─────────────────────────────────────────────
//  Pre-scripted Q&A
// ─────────────────────────────────────────────
type DemoCitation = { docName: string; section: string };
type IntegrationRow = Record<string, string>;
type IntegrationResult = {
  actionName: string;
  endpoint: string;
  tableHeaders: string[];
  rows: IntegrationRow[];
  summary: string;
};
type WriteParam = { key: string; value: string };
type WriteAction = {
  actionName: string;
  method: "POST" | "PUT" | "PATCH";
  endpoint: string;
  proposedParams: WriteParam[];
  successRecord: Record<string, string>;
  summary: string;
};
type DemoAnswer = { text: string; citations: DemoCitation[]; integration?: IntegrationResult; writeAction?: WriteAction };

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

// ─────────────────────────────────────────────
//  Integration QA Pairs
// ─────────────────────────────────────────────
const INTEGRATION_PAIRS: { keywords: string[]; answer: DemoAnswer }[] = [
  {
    keywords: ["bids", "procurement", "rfp", "rfq", "tenders", "open bids", "list bids", "show bids", "active bids"],
    answer: {
      text: "Fetching active bids from the Procurement API…",
      citations: [],
      integration: {
        actionName: "List Active Bids",
        endpoint: "GET /api/bids?status=open&quarter=Q2-2026",
        tableHeaders: ["Title", "Agency", "Value", "Stage", "Deadline"],
        rows: [
          { Title: "VA Data Center RFI", Agency: "Veterans Affairs", Value: "$2.4M", Stage: "Drafting", Deadline: "Jun 3" },
          { Title: "Cybersecurity Audit RFP", Agency: "Dept of Defense", Value: "$890K", Stage: "Submitted", Deadline: "May 28" },
          { Title: "IT Services Contract", Agency: "GSA", Value: "$5.1M", Stage: "Drafting", Deadline: "Jun 15" },
          { Title: "Cloud Migration RFP", Agency: "HHS", Value: "$3.2M", Stage: "Under Review", Deadline: "Jun 8" },
          { Title: "Network Upgrade Bid", Agency: "Dept of Energy", Value: "$1.7M", Stage: "Submitted", Deadline: "Jun 20" },
        ],
        summary: "Found **47 active bids** this quarter — **31 in Drafting**, 12 Submitted, 4 Under Review. Combined pipeline value: **$13.3M**. Earliest deadline: May 28 (Cybersecurity Audit RFP).",
      },
    },
  },
  {
    keywords: ["open positions", "job openings", "vacancies", "headcount", "hiring", "jobs", "new hires", "open roles", "open reqs"],
    answer: {
      text: "Querying the HR Management System for open positions…",
      citations: [],
      integration: {
        actionName: "List Open Positions",
        endpoint: "GET /hr/positions?status=open",
        tableHeaders: ["Title", "Department", "Location", "Level", "Posted"],
        rows: [
          { Title: "Senior Backend Engineer", Department: "Engineering", Location: "Remote", Level: "L5", Posted: "May 10" },
          { Title: "Product Designer", Department: "Product", Location: "NYC", Level: "L4", Posted: "May 14" },
          { Title: "Enterprise AE", Department: "Sales", Location: "Austin", Level: "L6", Posted: "Apr 30" },
          { Title: "Data Analyst", Department: "Analytics", Location: "Remote", Level: "L3", Posted: "May 19" },
          { Title: "DevOps Engineer", Department: "Infrastructure", Location: "SF", Level: "L5", Posted: "May 21" },
        ],
        summary: "There are **12 open positions** across 6 departments. **Engineering** has the most openings (4), followed by Sales (3). 8 of the 12 are remote-eligible.",
      },
    },
  },
  {
    keywords: ["contracts", "active contracts", "list contracts", "show contracts", "vendors", "current vendors", "supplier contracts"],
    answer: {
      text: "Pulling active contracts from the Contract Database…",
      citations: [],
      integration: {
        actionName: "List Active Contracts",
        endpoint: "GET /contracts?status=active",
        tableHeaders: ["Vendor", "Type", "Value", "Owner", "Expires"],
        rows: [
          { Vendor: "Acme Cloud Services", Type: "SaaS", Value: "$240K/yr", Owner: "IT", Expires: "Dec 2026" },
          { Vendor: "DataBridge Corp", Type: "Integration", Value: "$85K/yr", Owner: "Engineering", Expires: "Sep 2026" },
          { Vendor: "SecureVault Inc", Type: "Security", Value: "$120K/yr", Owner: "InfoSec", Expires: "Mar 2027" },
          { Vendor: "TalentFlow HR", Type: "HR Platform", Value: "$45K/yr", Owner: "People Ops", Expires: "Jan 2027" },
          { Vendor: "AnalyticsPro", Type: "BI Tool", Value: "$36K/yr", Owner: "Analytics", Expires: "Nov 2026" },
        ],
        summary: "Found **23 active contracts** totalling approx **$1.8M/year**. **5 contracts expire within 6 months** — earliest: DataBridge Corp in Sep 2026. Recommend starting renewal conversations.",
      },
    },
  },
];

// ─────────────────────────────────────────────
//  Write / Action QA Pairs
// ─────────────────────────────────────────────
const WRITE_PAIRS: { keywords: string[]; answer: DemoAnswer }[] = [
  {
    keywords: ["submit a bid", "create a bid", "add a bid", "new bid", "file a bid", "draft a bid", "submit bid", "create bid"],
    answer: {
      text: "I'll submit a new bid to the Procurement API with these details:",
      citations: [],
      writeAction: {
        actionName: "Submit New Bid",
        method: "POST",
        endpoint: "POST /api/bids",
        proposedParams: [
          { key: "title", value: "AI Infrastructure Modernisation RFP" },
          { key: "agency", value: "Dept of Homeland Security" },
          { key: "value", value: "$1,200,000" },
          { key: "stage", value: "Drafting" },
          { key: "deadline", value: "2026-07-01" },
          { key: "owner", value: "Current User" },
        ],
        successRecord: {
          id: "BID-2847",
          title: "AI Infrastructure Modernisation RFP",
          agency: "Dept of Homeland Security",
          value: "$1,200,000",
          stage: "Drafting",
          created_at: "2026-05-12T14:32:07Z",
        },
        summary: "Bid **BID-2847** created successfully. It's now visible in the Procurement dashboard under Drafting. Deadline set for Jul 1, 2026.",
      },
    },
  },
  {
    keywords: ["add a job", "post a job", "create a position", "add a position", "new role", "open a role", "open a position", "new opening", "add an opening", "hire for", "create a role"],
    answer: {
      text: "I'll create a new job opening in the HR Management System:",
      citations: [],
      writeAction: {
        actionName: "Create Job Opening",
        method: "POST",
        endpoint: "POST /hr/positions",
        proposedParams: [
          { key: "title", value: "Senior AI Engineer" },
          { key: "department", value: "Engineering" },
          { key: "location", value: "Remote" },
          { key: "level", value: "L5" },
          { key: "status", value: "Open" },
          { key: "posted_by", value: "Current User" },
        ],
        successRecord: {
          id: "POS-0413",
          title: "Senior AI Engineer",
          department: "Engineering",
          location: "Remote",
          level: "L5",
          created_at: "2026-05-12T14:32:09Z",
        },
        summary: "Position **POS-0413** is now live in the HR system. It will appear on your careers page and internal job board within minutes.",
      },
    },
  },
  {
    keywords: ["log a contract", "add a contract", "create a contract", "new contract", "register a vendor", "add a vendor", "new vendor"],
    answer: {
      text: "I'll log a new vendor contract in the Contract Database:",
      citations: [],
      writeAction: {
        actionName: "Log Vendor Contract",
        method: "POST",
        endpoint: "POST /contracts",
        proposedParams: [
          { key: "vendor", value: "NexGen AI Solutions" },
          { key: "type", value: "SaaS" },
          { key: "value", value: "$95,000/yr" },
          { key: "owner", value: "Engineering" },
          { key: "expiry", value: "2027-05-12" },
          { key: "status", value: "Active" },
        ],
        successRecord: {
          id: "CON-1194",
          vendor: "NexGen AI Solutions",
          type: "SaaS",
          value: "$95,000/yr",
          owner: "Engineering",
          created_at: "2026-05-12T14:32:11Z",
        },
        summary: "Contract **CON-1194** logged successfully. NexGen AI Solutions is now tracked in the Contract Database with a May 2027 renewal date.",
      },
    },
  },
];

const FALLBACK: DemoAnswer = {
  text: `I can answer questions about documents, fetch live data, or take actions in connected systems.\n\n**Documents loaded:**\n• **Employee_Handbook_2026.pdf** — PTO, onboarding, remote work, code of conduct\n• **Mutual_NDA_Template.docx** — confidentiality terms, exclusions, breach remedies\n• **IT_Security_Policy.pdf** — passwords, MFA, access control, incident response\n\n**Connected APIs — try asking:**\n• "List all open procurement bids" or "Submit a new bid"\n• "Show open positions" or "Add a job opening"\n• "What active contracts do we have?" or "Log a new vendor contract"`,
  citations: [],
};

function matchQuery(input: string): DemoAnswer {
  const lower = input.toLowerCase();
  let best: { answer: DemoAnswer; score: number } | null = null;
  for (const qa of [...WRITE_PAIRS, ...QA_PAIRS, ...INTEGRATION_PAIRS]) {
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
  "List all open procurement bids",
  "Submit a new bid",
  "Show open positions in the HR system",
  "Add a job opening",
  "What active contracts do we have?",
  "Explain the MFA requirements",
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
  integration?: IntegrationResult;
  showIntegration?: boolean;
  writeAction?: WriteAction;
  writePhase?: 0 | 1 | 2; // 0=proposing, 1=executing, 2=done
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
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const streamInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setVoiceSupported(
      typeof window !== "undefined" &&
        ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    );
  }, []);

  const toggleVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition) as any;
    if (!SR) return;
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = new SR() as any;
    r.continuous = false; r.interimResults = true; r.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = Array.from(e.results as any[]).map((res: any) => res[0].transcript as string).join("");
      setInput(t);
    };
    r.onend = () => setIsListening(false);
    r.onerror = () => setIsListening(false);
    r.start();
    recognitionRef.current = r;
    setIsListening(true);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (streamInterval.current) clearInterval(streamInterval.current);
    if (recognitionRef.current) recognitionRef.current.abort();
  }, []);

  function handleSend(text?: string) {
    const query = (text ?? input).trim();
    if (!query || streaming) return;
    setInput("");

    const userMsg: Message = { role: "user", text: query };
    const answer = matchQuery(query);

    if (answer.writeAction) {
      // 3-phase: propose (0) → executing (1) → done (2)
      const writeMsg: Message = {
        role: "assistant",
        text: answer.text,
        citations: [],
        writeAction: answer.writeAction,
        writePhase: 0,
      };
      setMessages((prev) => [...prev, userMsg, writeMsg]);
      setStreaming(true);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m, i) => i === prev.length - 1 ? { ...m, writePhase: 1 } : m)
        );
        setTimeout(() => {
          setMessages((prev) =>
            prev.map((m, i) => i === prev.length - 1 ? { ...m, writePhase: 2 } : m)
          );
          setStreaming(false);
        }, 1000);
      }, 1800);
      return;
    }

    if (answer.integration) {
      // Two-phase: show "Fetching…" first, then reveal result + summary
      const fetchingMsg: Message = {
        role: "assistant",
        text: answer.text,
        fullText: answer.text,
        citations: [],
        streaming: false,
        integration: answer.integration,
        showIntegration: false,
      };
      setMessages((prev) => [...prev, userMsg, fetchingMsg]);
      setStreaming(true);
      setTimeout(() => {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, showIntegration: true } : m
          )
        );
        setStreaming(false);
      }, 1200);
      return;
    }

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

  function renderWriteAction(msg: Message) {
    const wa = msg.writeAction!;
    const phase = msg.writePhase ?? 0;
    const methodColor = "#F59E0B";
    return (
      <div className="flex gap-2 items-start">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: "rgba(245,158,11,0.15)" }}>
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* Intent bubble */}
          <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-xs text-white/70" style={{ background: "rgba(31,41,55,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {renderText(msg.text)}
          </div>

          {/* Proposed action card */}
          <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(245,158,11,0.25)", background: "rgba(245,158,11,0.05)" }}>
            {/* header */}
            <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(245,158,11,0.10)", borderBottom: "1px solid rgba(245,158,11,0.15)" }}>
              <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-amber-300">{wa.actionName}</span>
              <span className="ml-auto font-mono text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: "rgba(245,158,11,0.2)", color: methodColor }}>{wa.method}</span>
              <span className="font-mono text-[9px] text-white/30 truncate max-w-[140px]">{wa.endpoint.replace(/^(POST|PUT|PATCH) /, "")}</span>
            </div>

            {/* Params */}
            <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
              {wa.proposedParams.map((p) => (
                <div key={p.key} className="flex flex-col min-w-0">
                  <span className="text-[9px] uppercase tracking-wide text-white/30 font-semibold">{p.key}</span>
                  <span className="text-[10px] text-white/70 truncate">{p.value}</span>
                </div>
              ))}
            </div>

            {/* Status bar */}
            <div className="px-3 py-2 border-t border-white/5 flex items-center gap-2">
              {phase === 0 && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-300/70">Sending request…</span>
                </>
              )}
              {phase === 1 && (
                <>
                  <Loader2 className="w-3 h-3 animate-spin text-amber-400 flex-shrink-0" />
                  <span className="text-[10px] text-amber-300/70">Awaiting confirmation…</span>
                </>
              )}
              {phase === 2 && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-[10px] text-emerald-400 font-semibold">201 Created</span>
                </>
              )}
            </div>
          </div>

          {/* Success record */}
          {phase === 2 && (
            <>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(52,211,153,0.2)", background: "rgba(52,211,153,0.05)" }}>
                <div className="flex items-center gap-2 px-3 py-2" style={{ background: "rgba(52,211,153,0.08)", borderBottom: "1px solid rgba(52,211,153,0.12)" }}>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                  <span className="text-[10px] font-semibold text-emerald-300">Record Created</span>
                  <span className="ml-auto font-mono text-[9px] text-emerald-400/60">{wa.successRecord.id}</span>
                </div>
                <div className="px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {Object.entries(wa.successRecord).map(([k, v]) => (
                    <div key={k} className="flex flex-col min-w-0">
                      <span className="text-[9px] uppercase tracking-wide text-white/30 font-semibold">{k}</span>
                      <span className="text-[10px] text-white/70 truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
              {/* AI summary */}
              <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs text-white/70" style={{ background: "rgba(31,41,55,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
                {renderText(wa.summary)}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  function renderIntegration(msg: Message) {
    const intg = msg.integration!;
    return (
      <div className="flex gap-2 items-start">
        <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5" style={{ background: "rgba(124,140,255,0.2)" }}>
          <Sparkles className="w-3.5 h-3.5 text-[#9B8CFF]" />
        </div>
        <div className="flex flex-col gap-2 flex-1 min-w-0">
          {/* "Fetching…" bubble */}
          <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-none max-w-[85%] text-xs text-white/70" style={{ background: "rgba(31,41,55,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
            {!msg.showIntegration
              ? <span className="flex items-center gap-2"><Loader2 className="w-3 h-3 animate-spin text-[#9B8CFF]" />{msg.text}</span>
              : renderText(msg.text)
            }
          </div>
          {/* Integration result card */}
          {msg.showIntegration && (
            <div className="rounded-xl p-3 max-w-full" style={{ background: "rgba(124,140,255,0.07)", border: "1px solid rgba(124,140,255,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-[#9B8CFF] flex-shrink-0" />
                <span className="text-xs font-semibold text-[#9B8CFF]">{intg.actionName}</span>
                <span className="ml-auto flex items-center gap-1 text-[10px] text-emerald-400"><CheckCircle2 className="w-3 h-3" />200 OK</span>
              </div>
              <div className="text-[10px] text-white/30 font-mono mb-3 truncate">{intg.endpoint}</div>
              {/* Table */}
              <div className="rounded-lg overflow-auto max-h-56 border border-white/8" style={{ WebkitOverflowScrolling: "touch" }}>
                <table className="min-w-full text-[10px]">
                  <thead className="sticky top-0 z-10" style={{ background: "rgba(124,140,255,0.15)" }}>
                    <tr>
                      {intg.tableHeaders.map((h) => (
                        <th key={h} className="text-left px-2.5 py-1.5 text-[#9B8CFF] font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {intg.rows.map((row, ri) => (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? "rgba(0,0,0,0.2)" : "rgba(31,41,55,0.3)" }}>
                        {intg.tableHeaders.map((h) => (
                          <td key={h} className="px-2.5 py-1.5 whitespace-nowrap">
                            <div className="max-w-[140px] truncate text-white/70">{row[h] ?? "—"}</div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* AI summary */}
              <div className="mt-3 text-xs text-white/70 leading-relaxed">{renderText(intg.summary)}</div>
            </div>
          )}
        </div>
      </div>
    );
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
            You&apos;re in <strong className="text-amber-300">Demo Mode</strong> — responses are pre-scripted using sample documents. Voice input and API integrations are live.          </span>
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
        <div className="flex items-center gap-2">
          {/* Mobile sidebar toggle */}
          <button
            className="md:hidden flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-[#9CA3AF] hover:text-[#F9FAFB] hover:bg-white/5 transition-colors"
            onClick={() => setMobileSidebarOpen(true)}
          >
            <Menu className="w-4 h-4" />
            <span className="text-[11px]">Docs & APIs</span>
          </button>
          <Link href="/login">
            <Button size="sm" className="text-white text-xs h-8 px-4 border-0 rounded-lg gap-1.5" style={{ background: G, boxShadow: "0 2px 12px rgba(124,140,255,0.3)" }}>
              Start Free <ArrowRight className="w-3 h-3" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* MOBILE SIDEBAR BOTTOM SHEET */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileSidebarOpen(false)} />
          {/* Sheet */}
          <div className="relative rounded-t-2xl overflow-y-auto max-h-[80vh]" style={{ background: "#0D1220", border: "1px solid rgba(255,255,255,0.08)", borderBottom: "none" }}>
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            {/* Close */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <span className="text-sm font-semibold text-[#F9FAFB]">Demo Context</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                <X className="w-4 h-4 text-[#9CA3AF]" />
              </button>
            </div>

            {/* Sample Documents */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5">
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

            {/* Connected APIs */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold mb-3">Connected APIs</p>
              <div className="space-y-2">
                {CONNECTED_APIS.map((api) => (
                  <div key={api.name} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(31,41,55,0.5)" }}>
                    <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "#9B8CFF" }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-[#E5E7EB] leading-tight truncate">{api.name}</p>
                    </div>
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: api.color }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: api.color }} />
                      live
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Try asking */}
            <div className="px-5 pt-5 pb-4 border-b border-white/5">
              <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold mb-3">Try asking</p>
              <div className="space-y-1.5">
                {SUGGESTED.map((q) => {
                  const isWrite = WRITE_PAIRS.some((wp) => wp.answer.text === matchQuery(q).text && matchQuery(q).writeAction);
                  const isInteg = INTEGRATION_PAIRS.some((ip) => ip.answer.text === matchQuery(q).text && matchQuery(q).integration);
                  return (
                    <button
                      key={q}
                      onClick={() => { handleSend(q); setMobileSidebarOpen(false); }}
                      disabled={streaming}
                      className="w-full text-left text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-40"
                      style={isWrite
                        ? { color: "#F59E0B", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.15)" }
                        : isInteg
                        ? { color: "#9B8CFF", background: "rgba(124,140,255,0.06)", border: "1px solid rgba(124,140,255,0.12)" }
                        : { color: "#9CA3AF" }
                      }
                    >
                      {isWrite ? <Zap className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[#7C8CFF]" />}
                      {q}
                      {isWrite && <span className="ml-auto text-[9px] font-mono opacity-50">POST</span>}
                      {isInteg && !isWrite && <span className="ml-auto text-[9px] font-mono opacity-50">GET</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* CTA */}
            <div className="p-5">
              <div className="p-4 rounded-2xl" style={{ background: "linear-gradient(135deg, rgba(124,140,255,0.12), rgba(192,132,252,0.08))", border: "1px solid rgba(124,140,255,0.15)" }}>
                <p className="text-xs font-semibold text-[#F9FAFB] mb-1">Use your own docs + APIs</p>
                <p className="text-[11px] text-[#9CA3AF] leading-relaxed mb-3">Connect your documents and REST APIs for an AI workspace that knows your business.</p>
                <Link href="/login" onClick={() => setMobileSidebarOpen(false)}>
                  <Button size="sm" className="w-full h-7 text-[11px] border-0 rounded-lg" style={{ background: G, color: "#fff" }}>
                    Start Free
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN */}
      <div className="relative z-10 flex flex-1 overflow-hidden">

        {/* SIDEBAR */}
        <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-white/5 bg-[#0D1220]/60 backdrop-blur-sm overflow-y-auto">
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

          {/* Connected APIs */}
          <div className="px-5 pt-5 pb-4 border-b border-white/5">
            <p className="text-[10px] uppercase tracking-widest text-[#6B7280] font-semibold mb-3">Connected APIs</p>
            <div className="space-y-2">
              {CONNECTED_APIS.map((api) => (
                <div key={api.name} className="flex items-center gap-2.5 p-2.5 rounded-xl" style={{ background: "rgba(31,41,55,0.5)" }}>
                  <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: "#9B8CFF" }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-[#E5E7EB] leading-tight truncate">{api.name}</p>
                    <p className="text-[9px] text-white/25 mt-0.5">Imported via OpenAPI spec</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: api.color }}>
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: api.color }} />
                    live
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: "rgba(124,140,255,0.05)", border: "1px solid rgba(124,140,255,0.10)" }}>
              <FileCode className="w-3.5 h-3.5 text-[#9B8CFF] shrink-0" />
              <p className="text-[10px] text-white/35 leading-snug">Paste any OpenAPI spec to auto-configure endpoints in seconds</p>
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
              <p className="text-xs font-semibold text-[#F9FAFB] mb-1">Use your own docs + APIs</p>
              <p className="text-[11px] text-[#9CA3AF] leading-relaxed mb-3">Connect your documents and REST APIs for an AI workspace that knows your business.</p>
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
                  <p className="text-base font-semibold text-[#F9FAFB] mb-1">Ask about documents or trigger a live integration</p>
                  <p className="text-sm text-[#6B7280]">Use the chips below — or tap <strong className="text-white/60">Docs &amp; APIs</strong> in the menu to explore what&apos;s loaded</p>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && msg.writeAction ? (
                  <div className="max-w-2xl w-full">{renderWriteAction(msg)}</div>
                ) : msg.role === "assistant" && msg.integration ? (
                  <div className="max-w-2xl w-full">{renderIntegration(msg)}</div>
                ) : msg.role === "assistant" && (
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
          <div className="shrink-0 border-t border-white/5" style={{ background: "rgba(13,18,32,0.8)" }}>
            {/* Connected APIs chips — anchored above input */}
            <div className="px-4 pt-3 pb-1">
              <div className="flex items-center gap-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <span className="text-[10px] uppercase tracking-widest text-[#4B5563] font-semibold shrink-0 flex items-center gap-1">
                  <Globe className="w-3 h-3" /> APIs
                </span>
                <span className="text-white/10 shrink-0">·</span>
                {[
                  { label: "List Bids", query: "List all open procurement bids", method: "GET" },
                  { label: "Submit Bid", query: "Submit a new bid", method: "POST" },
                  { label: "Open Positions", query: "Show open positions in the HR system", method: "GET" },
                  { label: "Add Job", query: "Add a job opening", method: "POST" },
                  { label: "Contracts", query: "What active contracts do we have?", method: "GET" },
                  { label: "Log Contract", query: "Log a new vendor contract", method: "POST" },
                  { label: "PTO Policy", query: "What's our PTO policy?", method: "DOC" },
                  { label: "MFA Rules", query: "Explain the MFA requirements", method: "DOC" },
                ].map((api) => (
                  <button
                    key={api.label}
                    onClick={() => handleSend(api.query)}
                    disabled={streaming}
                    className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all disabled:opacity-40 hover:brightness-125"
                    style={api.method === "POST"
                      ? { background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", color: "#F59E0B" }
                      : api.method === "DOC"
                      ? { background: "rgba(107,114,128,0.12)", border: "1px solid rgba(107,114,128,0.2)", color: "#9CA3AF" }
                      : { background: "rgba(124,140,255,0.10)", border: "1px solid rgba(124,140,255,0.2)", color: "#9B8CFF" }
                    }
                    title={api.query}
                  >
                    {api.method === "POST"
                      ? <Zap className="w-2.5 h-2.5 opacity-80" />
                      : api.method === "DOC"
                      ? <FileText className="w-2.5 h-2.5 opacity-60" />
                      : <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                    }
                    {api.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pb-5 pt-2">
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-3"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={streaming}
                  placeholder={isListening ? "Listening… speak your question" : "Ask about documents or trigger an API integration…"}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-[#F9FAFB] placeholder-[#6B7280] outline-none disabled:opacity-50"
                  style={{ background: "rgba(31,41,55,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                />
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleVoice}
                    title={isListening ? "Stop listening" : "Voice input"}
                    className={`h-11 w-11 shrink-0 rounded-xl flex items-center justify-center transition-colors ${
                      isListening
                        ? "animate-pulse"
                        : ""}
                    `}
                    style={isListening
                      ? { background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#F87171" }
                      : { background: "rgba(31,41,55,0.6)", border: "1px solid rgba(255,255,255,0.08)", color: "#6B7280" }
                    }
                  >
                    {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  </button>
                )}
                <Button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="h-11 w-11 p-0 shrink-0 border-0 rounded-xl disabled:opacity-30"
                  style={{ background: G }}
                >
                  <Send className="w-4 h-4 text-white" />
                </Button>
              </form>
              <p className="text-center text-[10px] text-[#4B5563] mt-2">Demo mode · Document answers and integration results are pre-scripted</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
