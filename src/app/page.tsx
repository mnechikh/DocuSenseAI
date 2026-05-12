"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  Users,
  ArrowRight,
  CheckCircle2,
  Upload,
  Sparkles,
  Shield,
  Zap,
  FolderOpen,
  Clock,
  AlertTriangle,
  Lock,
  Key,
  Building2,
  Play,
  Globe,
  Database,
  BarChart3,
  ChevronRight,
} from "lucide-react";

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

export default function Home() {
  const router = useRouter();
  const { currentUser } = useStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (currentUser) router.push("/dashboard");
  }, [currentUser, router]);

  if (!mounted || currentUser) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0B0F1A]">
        <div className="animate-pulse"><LumxiaLogo size={36} /></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-[#F9FAFB] overflow-x-hidden">
      {/* ── Grid + ambient orbs ─────────────────────────────────── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(124,140,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(124,140,255,0.04) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div className="fixed top-[-200px] left-[-120px] w-[700px] h-[700px] rounded-full blur-[140px] pointer-events-none" style={{ background: "rgba(124,140,255,0.10)" }} />
      <div className="fixed bottom-[5%] right-[-100px] w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none" style={{ background: "rgba(192,132,252,0.08)" }} />

      {/* ── NAV ─────────────────────────────────────────────────── */}
      <nav className="relative z-10 flex items-center justify-between px-6 md:px-16 py-5 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <LumxiaLogo size={32} />
          <span className="text-[17px] font-bold tracking-tight text-[#F9FAFB]">Lumxia</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/40">
          <a href="#how-it-works" className="hover:text-white/80 transition-colors">How it works</a>
          <a href="#integrations" className="hover:text-white/80 transition-colors">Integrations</a>
          <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
          <a href="#pricing" className="hover:text-white/80 transition-colors">Pricing</a>
          <Link href="/demo" className="hover:text-white/80 transition-colors">Demo</Link>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-white/50 hover:text-white hover:bg-white/5 text-sm h-9 border-0">
              Sign in
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="sm"
              className="text-white text-sm h-9 px-5 border-0 rounded-xl"
              style={{ background: LUMXIA_GRADIENT, boxShadow: "0 4px 16px rgba(124,140,255,0.3)" }}
            >
              Start Free <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 pt-28 pb-24 text-center">
        <div className="max-w-4xl mx-auto">
          <div
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium mb-10 border"
            style={{ background: "rgba(124,140,255,0.08)", borderColor: "rgba(124,140,255,0.2)", color: "#9B8CFF" }}
          >
            <Sparkles className="w-3 h-3" />
            AI knowledge + live integrations · Chat, query, and take action · Powered by Gemini 2.5
          </div>

          <h1 className="text-5xl md:text-[68px] font-extrabold tracking-tight leading-[1.05] mb-6">
            Your company&apos;s knowledge.
            <br />
            <span style={{ background: LUMXIA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              Instantly accessible.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-12 leading-relaxed">
            Lumxia turns your documents into a secure, AI-powered knowledge system — and connects to your external tools so your team can search, ask, and <span className="text-[#C084FC] font-medium">take action</span> without leaving the chat.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="text-white text-base px-10 h-12 border-0 rounded-xl"
                style={{ background: LUMXIA_GRADIENT, boxShadow: "0 8px 32px rgba(124,140,255,0.45)" }}
              >
                Start Free <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/demo">
              <Button
                size="lg"
                variant="outline"
                className="text-white/70 hover:text-white border-white/15 hover:border-white/30 bg-transparent hover:bg-white/5 text-base px-8 h-12 rounded-xl gap-2"
              >
                <Play className="w-4 h-4" />
                Try Demo
              </Button>
            </Link>
          </div>
          <p className="text-xs text-white/30 mt-4">No credit card required</p>

          {/* Stats */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-10 mt-20">
            {[
              { val: "< 15s", label: "Avg. index time" },
              { val: "Multi-tenant", label: "Enterprise architecture" },
              { val: "Live actions", label: "Chat → API integrations" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl font-bold text-[#F9FAFB]">{s.val}</span>
                <span className="text-[#9CA3AF] text-xs uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEM ─────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Sound familiar?</p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-[#F9FAFB]">Your knowledge is scattered—and it&apos;s costing you time.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { Icon: FolderOpen, color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)", title: "Documents spread across tools", desc: "Slack, Drive, email, Notion — your knowledge is everywhere and nowhere." },
              { Icon: MessageSquare, color: "#FBBF24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.18)", title: "Repeated internal questions", desc: "The same questions get asked over and over because answers are buried." },
              { Icon: Clock, color: "#F87171", bg: "rgba(248,113,113,0.08)", border: "rgba(248,113,113,0.18)", title: "Time wasted searching", desc: "Employees spend 20% of their week hunting for information that already exists." },
              { Icon: AlertTriangle, color: "#FBBF24", bg: "rgba(251,191,36,0.07)", border: "rgba(251,191,36,0.18)", title: "Knowledge locked in files", desc: "Critical know-how sits in documents nobody can find or search effectively." },
            ].map((p) => (
              <div key={p.title} className="p-6 rounded-2xl border text-left" style={{ background: p.bg, borderColor: p.border }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <p.Icon className="w-5 h-5" style={{ color: p.color }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] mb-2 text-sm leading-snug">{p.title}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">How it works</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-[#F9FAFB]">From document to answer in seconds</h2>
            <p className="text-[#9CA3AF]">No setup. No training. Upload and ask.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { step: "01", Icon: Upload, label: "Upload documents", desc: "PDF, DOCX, XLSX, CSV, images — drag and drop files, folders, or a ZIP archive." },
              { step: "02", Icon: Sparkles, label: "Lumxia indexes + understands", desc: "Content is extracted, chunked, and semantically embedded. Ready in under 15 seconds." },
              { step: "03", Icon: MessageSquare, label: "Ask in natural language", desc: "Type any question. No query syntax, no Boolean operators, no learning curve." },
              { step: "04", Icon: Zap, label: "Get accurate answers instantly", desc: "Precise, grounded answers with source citations from your actual documents." },
              { step: "05", Icon: Zap, label: "Take action from chat", desc: "Connect your APIs. One click triggers live calls — fetch, submit, update — all in the chat thread.", highlight: true },
            ].map((s) => (
              <div key={s.step} className="flex flex-col">
                <div className="text-6xl font-black leading-none mb-4 select-none" style={{ color: "rgba(124,140,255,0.07)" }}>{s.step}</div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: s.highlight ? "rgba(124,140,255,0.22)" : "rgba(124,140,255,0.10)" }}>
                  <s.Icon className="w-5 h-5" style={{ color: s.highlight ? "#C084FC" : "#9B8CFF" }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] mb-2 text-sm">{s.label}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Capabilities</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-[#F9FAFB]">Everything your team needs</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { Icon: Sparkles, color: "#7C8CFF", bg: "rgba(124,140,255,0.12)", title: "AI-Powered Knowledge Search", desc: "Semantic understanding finds answers your keyword search would miss." },
              { Icon: Lock, color: "#9B8CFF", bg: "rgba(155,140,255,0.12)", title: "Secure Multi-Tenant Architecture", desc: "Enterprise-grade isolation. Your data never touches another organisation." },
              { Icon: Users, color: "#C084FC", bg: "rgba(192,132,252,0.12)", title: "Team Access & Role Control", desc: "Admin and User roles with built-in approval, invite, and suspension flows." },
              { Icon: Zap, color: "#7C8CFF", bg: "rgba(124,140,255,0.12)", title: "AI-Powered Integrations", desc: "Connect any REST API. Ask in natural language, Lumxia triggers the call and surfaces results as a readable table." },
              { Icon: Building2, color: "#9B8CFF", bg: "rgba(155,140,255,0.12)", title: "Bulk Upload & Indexing", desc: "Drop a ZIP, drag a folder, or push via API. Lumxia queues and processes everything." },
              { Icon: FileText, color: "#C084FC", bg: "rgba(192,132,252,0.12)", title: "All Document Formats", desc: "PDF, DOCX, XLSX, CSV, TXT, images — OCR fallback for scanned documents." },
            ].map((f) => (
              <div
                key={f.title}
                className="p-6 rounded-2xl border border-white/6 transition-all duration-200"
                style={{ background: "rgba(31,41,55,0.35)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,140,255,0.22)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(31,41,55,0.65)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(31,41,55,0.35)"; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: f.bg }}>
                  <f.Icon className="w-5 h-5" style={{ color: f.color }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── INTEGRATIONS SHOWCASE ───────────────────────────────── */}
      <section id="integrations" className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Integrations</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-[#F9FAFB]">
              Chat with your data.{" "}
              <span style={{ background: LUMXIA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Act on it too.
              </span>
            </h2>
            <p className="text-[#9CA3AF] max-w-2xl mx-auto text-sm leading-relaxed">
              Connect any REST API — procurement, HR, CRM, ERP — and let the AI propose and execute live actions directly from the chat. No switching tabs. No copying IDs.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

            {/* Left: chat mockup */}
            <div className="rounded-2xl border border-white/8 overflow-hidden shadow-2xl" style={{ background: "rgba(13,18,32,0.8)" }}>
              {/* mock header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5" style={{ background: "rgba(124,140,255,0.10)" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500/60" />
                  <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                  <div className="w-2 h-2 rounded-full bg-green-500/60" />
                </div>
                <span className="text-[10px] text-white/30 font-mono">Lumxia — Knowledge Chat</span>
                <div />
              </div>
              {/* mock messages */}
              <div className="p-4 space-y-4 text-xs">
                <div className="flex justify-end">
                  <div className="px-3 py-2 rounded-2xl rounded-tr-none text-white max-w-[75%]" style={{ background: LUMXIA_GRADIENT }}>
                    List all open procurement bids for this quarter
                  </div>
                </div>
                <div className="flex gap-2">
                  <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: "rgba(124,140,255,0.2)" }}>
                    <Sparkles className="w-3 h-3 text-[#9B8CFF]" />
                  </div>
                  <div className="flex flex-col gap-2 flex-1">
                    <div className="px-3 py-2 rounded-2xl rounded-tl-none" style={{ background: "rgba(31,41,55,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-white/70">Fetching bids from Procurement API, Q2 2026.</span>
                    </div>
                    {/* Action card */}
                    <div className="rounded-xl p-3" style={{ background: "rgba(124,140,255,0.07)", border: "1px solid rgba(124,140,255,0.2)" }}>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Zap className="w-3 h-3 text-[#9B8CFF]" />
                        <span className="font-semibold text-[#9B8CFF]">List Bids — Success (200)</span>
                      </div>
                      {/* mini table */}
                      <div className="rounded-lg overflow-hidden border border-white/8">
                        <table className="w-full text-[9px]">
                          <thead>
                            <tr style={{ background: "rgba(124,140,255,0.12)" }}>
                              <th className="text-left px-2 py-1 text-[#9B8CFF] font-semibold">Title</th>
                              <th className="text-left px-2 py-1 text-[#9B8CFF] font-semibold">Agency</th>
                              <th className="text-left px-2 py-1 text-[#9B8CFF] font-semibold">Stage</th>
                              <th className="text-left px-2 py-1 text-[#9B8CFF] font-semibold">Deadline</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["VA Data Center RFI", "Veterans Affairs", "Drafting", "Jun 3"],
                              ["Cybersecurity Audit", "Dept of Defense", "Submitted", "May 28"],
                              ["IT Services Contract", "GSA", "Drafting", "Jun 15"],
                              ["Cloud Migration RFP", "HHS", "Review", "Jun 8"],
                            ].map(([title, agency, stage, deadline], i) => (
                              <tr key={i} className={i % 2 === 0 ? "" : ""} style={{ background: i % 2 === 0 ? "rgba(0,0,0,0.2)" : "rgba(31,41,55,0.3)" }}>
                                <td className="px-2 py-1 text-white/80 max-w-[90px] truncate">{title}</td>
                                <td className="px-2 py-1 text-white/50 truncate">{agency}</td>
                                <td className="px-2 py-1"><span className="px-1 py-0.5 rounded text-[8px] font-medium" style={{ background: stage === "Submitted" ? "rgba(52,211,153,0.15)" : "rgba(124,140,255,0.15)", color: stage === "Submitted" ? "#34D399" : "#9B8CFF" }}>{stage}</span></td>
                                <td className="px-2 py-1 text-white/50">{deadline}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                    {/* AI summary */}
                    <div className="px-3 py-2 rounded-2xl rounded-tl-none" style={{ background: "rgba(31,41,55,0.7)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <span className="text-white/70">Found <strong className="text-white">47 active bids</strong> this quarter. <strong className="text-white">31 are in Drafting</strong>, 12 submitted, 4 under review. Earliest deadline: May 28 (Cybersecurity Audit).</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* mock input */}
              <div className="px-4 pb-4">
                <div className="flex items-center gap-2 rounded-xl px-3 py-2 border border-white/8" style={{ background: "rgba(31,41,55,0.5)" }}>
                  <span className="flex-1 text-xs text-white/20">Ask a question or trigger an action…</span>
                  <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: LUMXIA_GRADIENT }}>
                    <ChevronRight className="w-3 h-3 text-white" />
                  </div>
                </div>
              </div>
            </div>

            {/* Right: feature points */}
            <div className="space-y-8 pt-4">
              {[
                {
                  Icon: Globe,
                  color: "#7C8CFF",
                  bg: "rgba(124,140,255,0.10)",
                  title: "Connect any REST API",
                  desc: "Add your endpoint, auth headers, and parameters from the Integrations dashboard. Lumxia handles Bearer tokens, API keys, and custom headers — securely stored, never exposed to users.",
                },
                {
                  Icon: Sparkles,
                  color: "#9B8CFF",
                  bg: "rgba(155,140,255,0.10)",
                  title: "AI proposes actions automatically",
                  desc: "When a user's question implies an external action, Lumxia detects it, maps the required parameters, and surfaces a one-click 'Run' card — no commands, no forms.",
                },
                {
                  Icon: BarChart3,
                  color: "#C084FC",
                  bg: "rgba(192,132,252,0.10)",
                  title: "Results rendered as readable tables",
                  desc: "JSON responses are intelligently parsed — arrays become sortable tables with smart column selection, formatted dates, and a plain-English AI summary above the data.",
                },
                {
                  Icon: Database,
                  color: "#7C8CFF",
                  bg: "rgba(124,140,255,0.10)",
                  title: "Works alongside your documents",
                  desc: "Combine knowledge from your uploaded files and live API data in the same chat thread. Ask 'does our policy allow this?' and 'show me the current records' — in one conversation.",
                },
              ].map((f) => (
                <div key={f.title} className="flex gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ background: f.bg }}>
                    <f.Icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[#F9FAFB] text-sm mb-1">{f.title}</h3>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}

              {/* connector logos */}
              <div className="pt-4 border-t border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-3 font-semibold">Works with any REST API including</p>
                <div className="flex flex-wrap gap-2">
                  {["Procurement APIs", "Salesforce", "HubSpot", "SAP", "ServiceNow", "Custom ERPs", "HR Systems", "Jira"].map((name) => (
                    <span key={name} className="px-2.5 py-1 rounded-full text-[10px] font-medium" style={{ background: "rgba(124,140,255,0.08)", border: "1px solid rgba(124,140,255,0.15)", color: "#9B8CFF" }}>
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── USE CASES ───────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Use cases</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-[#F9FAFB]">Real teams. Real results.</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { Icon: Building2, iconColor: "#7C8CFF", gradient: "linear-gradient(135deg, rgba(124,140,255,0.14), rgba(124,140,255,0.04))", border: "rgba(124,140,255,0.2)", title: "Internal Knowledge Base", desc: "Centralise SOPs, policies, and product specs. Every employee gets instant answers from your authoritative documents.", items: ["Single source of truth", "Always up to date", "Self-serve answers"] },
              { Icon: Users, iconColor: "#9B8CFF", gradient: "linear-gradient(135deg, rgba(155,140,255,0.14), rgba(155,140,255,0.04))", border: "rgba(155,140,255,0.2)", title: "Employee Onboarding", desc: "New hires ask natural-language questions and get immediate answers from your actual handbooks and training material.", items: ["Faster ramp-up", "Consistent answers", "Reduced manager load"] },
              { Icon: Zap, iconColor: "#C084FC", gradient: "linear-gradient(135deg, rgba(192,132,252,0.14), rgba(192,132,252,0.04))", border: "rgba(192,132,252,0.2)", title: "Live Integration Workflows", desc: "Connect procurement, HR, and CRM APIs. Type a question, click Run, and get live data with an AI-generated summary — all in the thread.", items: ["API actions from chat", "Results as smart tables", "Docs + live data combined"] },
            ].map((u) => (
              <div key={u.title} className="p-6 rounded-2xl border flex flex-col" style={{ background: u.gradient, borderColor: u.border }}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <u.Icon className="w-5 h-5" style={{ color: u.iconColor }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] text-base mb-3">{u.title}</h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed mb-5">{u.desc}</p>
                <ul className="mt-auto space-y-2">
                  {u.items.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-xs text-[#9CA3AF]">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: u.iconColor }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DIFFERENTIATION ─────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Why Lumxia</p>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6 text-[#F9FAFB]">Built for teams—not just individuals</h2>
              <p className="text-[#9CA3AF] text-sm leading-relaxed mb-8">
                Most AI document tools are built for solo use. Lumxia is architected from the ground up for collaboration, security, and scale.
              </p>
              <Link href="/login">
                <Button className="text-white border-0 rounded-xl px-7 h-11" style={{ background: LUMXIA_GRADIENT, boxShadow: "0 4px 20px rgba(124,140,255,0.35)" }}>
                  Get started free <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </div>
            <div className="space-y-4">
              {[
                { label: "Multi-tenant by design", desc: "Every workspace is cryptographically isolated" },
                { label: "Role-based access control", desc: "Granular Admin and User permissions" },
                { label: "Works across ALL document types", desc: "PDF, DOCX, XLSX, images, and more" },
                { label: "Native API integrations", desc: "Connect any REST API — trigger live calls from chat" },
                { label: "Scales with your organisation", desc: "From 1 user to enterprise teams" },
              ].map((b) => (
                <div key={b.label} className="flex items-start gap-3 p-4 rounded-xl border border-white/5" style={{ background: "rgba(31,41,55,0.35)" }}>
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#9B8CFF" }} />
                  <div>
                    <p className="text-sm font-medium text-[#F9FAFB]">{b.label}</p>
                    <p className="text-xs text-[#9CA3AF]">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ─────────────────────────────────────────────── */}
      <section id="pricing" className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-widest text-[#7C8CFF] mb-4 font-semibold">Pricing</p>
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4 text-[#F9FAFB]">Simple, transparent pricing</h2>
            <p className="text-[#9CA3AF]">Start free. Scale when you&apos;re ready. No hidden fees.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {[
              { name: "Free", price: "$0", period: "forever", tagline: "For individuals", highlight: false, cta: "Start Free", features: ["5 documents", "20 AI queries / month", "All file formats", "AI chat interface", "Secure workspace isolation"] },
              { name: "Starter", price: "$29", period: "/ month", tagline: "For small teams", highlight: true, cta: "Get Starter", features: ["25 documents", "500 AI queries / month", "1 GB storage", "5 API integrations", "Role-based access control", "Priority support"] },
              { name: "Pro", price: "$99", period: "/ month", tagline: "For growing organisations", highlight: false, cta: "Get Pro", features: ["999 documents", "2,000 AI queries / month", "10 GB storage", "Unlimited API integrations", "Bulk ZIP / folder ingestion", "Admin user management", "Priority support"] },
            ].map((plan) => (
              <div key={plan.name} className="p-7 rounded-2xl border flex flex-col" style={{ background: plan.highlight ? "rgba(124,140,255,0.10)" : "rgba(31,41,55,0.35)", borderColor: plan.highlight ? "rgba(124,140,255,0.35)" : "rgba(255,255,255,0.06)", boxShadow: plan.highlight ? "0 0 40px rgba(124,140,255,0.12)" : "none" }}>
                {plan.highlight && (
                  <div className="text-[10px] uppercase tracking-widest font-bold mb-4 self-start px-2.5 py-1 rounded-full" style={{ background: "rgba(124,140,255,0.2)", color: "#9B8CFF" }}>Most popular</div>
                )}
                <p className="text-[10px] uppercase tracking-widest text-[#6B7280] mb-1">{plan.tagline}</p>
                <p className="text-xs uppercase tracking-widest text-[#9CA3AF] mb-1">{plan.name}</p>
                <div className="flex items-end gap-1 mb-2">
                  <span className="text-4xl font-extrabold text-[#F9FAFB]">{plan.price}</span>
                  <span className="text-[#9CA3AF] text-sm mb-1">{plan.period}</span>
                </div>
                <ul className="space-y-2.5 mb-8 mt-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2.5 text-sm text-[#D1D5DB]">
                      <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: plan.highlight ? "#9B8CFF" : "#4B5563" }} />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/login" className="mt-auto">
                  <Button className="w-full h-10 rounded-xl text-sm border-0" style={plan.highlight ? { background: LUMXIA_GRADIENT, color: "#fff", boxShadow: "0 4px 16px rgba(124,140,255,0.3)" } : { background: "rgba(255,255,255,0.06)", color: "#F9FAFB" }}>
                    {plan.cta} <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="relative p-12 rounded-3xl overflow-hidden"
            style={{ border: "1px solid rgba(124,140,255,0.15)", background: "rgba(124,140,255,0.05)" }}
          >
            <div className="flex justify-center mb-6">
              <LumxiaLogo size={56} />
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-[#F9FAFB]">
              Stop searching.{" "}
              <span style={{ background: LUMXIA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                Start knowing.
              </span>
            </h2>
            <p className="text-[#9CA3AF] mb-2 text-sm leading-relaxed">
              Join teams already using Lumxia to unlock their company knowledge.
            </p>
            <p className="text-[#6B7280] text-xs mb-8">No credit card required. Up and running in minutes.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/login">
                <Button size="lg" className="text-white text-base px-10 h-12 border-0 rounded-xl" style={{ background: LUMXIA_GRADIENT, boxShadow: "0 8px 28px rgba(124,140,255,0.4)" }}>
                  Start Using Lumxia Free <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="ghost" className="text-white/50 hover:text-white hover:bg-white/5 text-base px-8 h-12 rounded-xl gap-2">
                  <Play className="w-4 h-4" /> Try Demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────────── */}
      <footer className="relative z-10 border-t border-white/5 px-6 md:px-16 py-8">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-white/25">
          <div className="flex items-center gap-2.5">
            <LumxiaLogo size={24} />
            <span className="font-semibold text-white/40">Lumxia</span>
          </div>
          <p>© 2026 Lumxia · intellaqc.com</p>
          <div className="flex gap-6">
            <Link href="/support" className="hover:text-white/50 transition-colors">Support</Link>
            <Link href="/privacy" className="hover:text-white/50 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-white/50 transition-colors">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
