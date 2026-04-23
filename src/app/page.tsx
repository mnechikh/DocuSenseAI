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
  Database,
  Shield,
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
          <a href="#features" className="hover:text-white/80 transition-colors">Features</a>
          <a href="#how-it-works" className="hover:text-white/80 transition-colors">How it works</a>
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
              Get started <ArrowRight className="ml-1.5 w-3.5 h-3.5" />
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
            Powered by Gemini 2.5 · Semantic AI · Multi-tenant isolation
          </div>

          <h1 className="text-5xl md:text-[72px] font-extrabold tracking-tight leading-[1.04] mb-6">
            Your knowledge,
            <br />
            <span style={{ background: LUMXIA_GRADIENT, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
              always within reach.
            </span>
          </h1>
          <p className="text-lg md:text-xl text-[#9CA3AF] max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload any document. Ask anything in plain language.
            Lumxia transforms your team&apos;s files into a calm, always-on AI knowledge companion.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button
                size="lg"
                className="text-white text-base px-8 h-12 border-0 rounded-xl"
                style={{ background: LUMXIA_GRADIENT, boxShadow: "0 8px 28px rgba(124,140,255,0.35)" }}
              >
                Start for free <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="text-white/60 hover:text-white border-white/10 hover:border-white/20 bg-transparent hover:bg-white/5 text-base px-8 h-12 rounded-xl"
              >
                Sign in to dashboard
              </Button>
            </Link>
          </div>

          {/* Stats */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-12 mt-20">
            {[
              { val: "< 15s", label: "Avg. index time" },
              { val: "PDF · DOCX · XLSX", label: "Supported formats" },
              { val: "Semantic AI", label: "Query understanding" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center gap-1.5">
                <span className="text-2xl font-bold text-[#F9FAFB]">{s.val}</span>
                <span className="text-[#9CA3AF] text-xs uppercase tracking-wider">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ────────────────────────────────────────────── */}
      <section id="features" className="relative z-10 px-6 md:px-16 py-28 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-[#F9FAFB]">
              Built for how humans actually work
            </h2>
            <p className="text-[#9CA3AF] text-base max-w-xl mx-auto">
              No training. No complex pipelines. Just a calm, intelligent assistant that knows your documents inside out.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                iconBg: "rgba(124,140,255,0.12)",
                iconColor: "#7C8CFF",
                Icon: Sparkles,
                title: "Semantic Understanding",
                desc: "Asks about 'pricing' — finds 'Schedule of Rates', '$50,000', 'contract value'. Context-aware, not just keyword matching.",
              },
              {
                iconBg: "rgba(155,140,255,0.12)",
                iconColor: "#9B8CFF",
                Icon: FileText,
                title: "Any Document Format",
                desc: "PDF, DOCX, XLSX, CSV, TXT. Scanned PDFs get Gemini Vision OCR automatically when text extraction isn't possible.",
              },
              {
                iconBg: "rgba(192,132,252,0.12)",
                iconColor: "#C084FC",
                Icon: Shield,
                title: "Fully Isolated Tenants",
                desc: "Every organisation lives in its own secure silo. Firestore security rules guarantee zero cross-tenant data access.",
              },
              {
                iconBg: "rgba(124,140,255,0.12)",
                iconColor: "#7C8CFF",
                Icon: MessageSquare,
                title: "Conversational Chat",
                desc: "Chat with your entire knowledge base. Every answer includes the exact source document it came from.",
              },
              {
                iconBg: "rgba(155,140,255,0.12)",
                iconColor: "#9B8CFF",
                Icon: Upload,
                title: "Fast Indexing",
                desc: "Local PDF parsing + parallel upload. A 4 MB document is extracted, chunked, embedded and ready in under 15 seconds.",
              },
              {
                iconBg: "rgba(192,132,252,0.12)",
                iconColor: "#C084FC",
                Icon: Users,
                title: "Team Access Control",
                desc: "Invite users, assign Admin or User roles, approve or suspend accounts — all from the built-in admin panel.",
              },
            ].map((f) => (
              <div
                key={f.title}
                className="group p-6 rounded-2xl border border-white/6 transition-all duration-300"
                style={{ background: "rgba(31,41,55,0.35)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(124,140,255,0.2)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(31,41,55,0.6)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,255,255,0.06)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(31,41,55,0.35)"; }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5" style={{ background: f.iconBg }}>
                  <f.Icon className="w-5 h-5" style={{ color: f.iconColor }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] text-[15px] mb-2">{f.title}</h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ────────────────────────────────────────── */}
      <section id="how-it-works" className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 tracking-tight text-[#F9FAFB]">Up and running in minutes</h2>
            <p className="text-[#9CA3AF] text-base">No training. No complicated setup. Just upload and ask.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { step: "01", Icon: Upload, title: "Upload your documents", desc: "Drag and drop any PDF, Word doc, or spreadsheet. Lumxia accepts the formats your team already works with." },
              { step: "02", Icon: Sparkles, title: "AI indexes everything", desc: "Lumxia extracts, chunks, and semantically understands every page. Your private knowledge base is ready instantly." },
              { step: "03", Icon: MessageSquare, title: "Ask anything", desc: "Open the AI chat. Ask any question in natural language. Get precise answers with the source document cited." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col">
                <div className="text-7xl font-black leading-none mb-4 select-none" style={{ color: "rgba(124,140,255,0.08)" }}>{s.step}</div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5" style={{ background: "rgba(124,140,255,0.12)" }}>
                  <s.Icon className="w-5 h-5" style={{ color: "#9B8CFF" }} />
                </div>
                <h3 className="font-semibold text-[#F9FAFB] mb-2">{s.title}</h3>
                <p className="text-sm text-[#9CA3AF] leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CHECKLIST ───────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            "PDF, DOCX, XLSX, CSV, TXT support",
            "Gemini 2.5 Flash semantic AI",
            "Multi-tenant data isolation",
            "Role-based access control",
            "Query expansion for better answers",
            "Firebase-powered infrastructure",
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-sm text-[#9CA3AF]">
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: "#9B8CFF" }} />
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────── */}
      <section className="relative z-10 px-6 md:px-16 py-24 border-t border-white/5">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="relative p-12 rounded-3xl overflow-hidden"
            style={{ border: "1px solid rgba(124,140,255,0.15)", background: "rgba(124,140,255,0.05)" }}
          >
            <div className="relative">
              <div className="flex justify-center mb-6">
                <LumxiaLogo size={56} />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight text-[#F9FAFB]">
                Ready to orchestrate
                <br />
                your knowledge?
              </h2>
              <p className="text-[#9CA3AF] mb-8 text-sm leading-relaxed">
                Get started for free. No credit card required.
              </p>
              <Link href="/login">
                <Button
                  size="lg"
                  className="text-white text-base px-10 h-12 border-0 rounded-xl"
                  style={{ background: LUMXIA_GRADIENT, boxShadow: "0 8px 28px rgba(124,140,255,0.35)" }}
                >
                  Get started free <ArrowRight className="ml-2 w-4 h-4" />
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
          <p>© 2026 Lumxia. All rights reserved.</p>
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

