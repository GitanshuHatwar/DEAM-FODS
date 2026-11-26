import React, { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Cpu,
  Pin,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  User,
  Wrench,
} from "lucide-react";
import { getHomeRouteForRole, useAuth } from "@/auth/AuthProvider";
import { isMockMode } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import "./homeStage.css";

type StagePhase = "idle" | "start" | "closeout" | "resolved";

interface TagScenario {
  id: string;
  uid: string;
  label: string;
  ticketTitle: string;
  deviceName: string;
  severity: string;
  score: number;
  faultSummary: string;
  maintenanceLog: string;
  pastIncident: string;
  nextService: string;
  isUnknown?: boolean;
}

const SCENARIOS: TagScenario[] = [
  {
    id: "conveyor",
    uid: "a4:7c:19:e2",
    label: "Conveyor M-02",
    ticketTitle: "Ticket 128 · Pending review",
    deviceName: "Conveyor motor M-02",
    severity: "Critical 86",
    score: 86,
    faultSummary:
      "Motor overheating with a burning smell near the drive belt.",
    maintenanceLog: "Bearing replaced",
    pastIncident: "Overheating flagged",
    nextService: "Overdue",
  },
  {
    id: "printer",
    uid: "04:a3:b2:c1",
    label: "LaserJet 04",
    ticketTitle: "Ticket 105 · Pending review",
    deviceName: "Lab LaserJet Printer 04",
    severity: "High 76",
    score: 76,
    faultSummary:
      "Power indicator blinking amber; Lab B print jobs stalled in spooler.",
    maintenanceLog: "Pickup roller kit",
    pastIncident: "Tray 2 feed slip",
    nextService: "Overdue",
  },
  {
    id: "unknown",
    uid: "04:de:ad:99",
    label: "Unknown Tag",
    ticketTitle: "Unregistered UID scanned",
    deviceName: "Unmapped Equipment Tag",
    severity: "Unknown Tag",
    score: 0,
    faultSummary:
      "No registered device matches 04DEAD99. Ready to prefill onboarding form.",
    maintenanceLog: "—",
    pastIncident: "—",
    nextService: "Add device",
    isUnknown: true,
  },
];

const HOW_STEPS = [
  {
    num: 1,
    tabLabel: "01  Report",
    title: "Report the fault",
    description:
      "Pick the device or validate its RFID UID, describe what broke and attach up to two client-compressed photos. The ticket is scored and ranked the instant it is saved.",
    statusText: "Pending review",
    pct: "34%",
    accentText: "Rule engine scored · Queued below active repair",
    highlights: ["Dropdown or RFID lookup", "0–2 compressed photos", "Instant rule triage"],
  },
  {
    num: 2,
    tabLabel: "02  Tap",
    title: "Tap the tag",
    description:
      "An ESP32 + MFRC522 reader sends the tag UID to the backend, and the portal updates live over SSE with specs, warranty and every past repair.",
    statusText: "Under review",
    pct: "67%",
    accentText: "Pinned to Tier 1 · Non-preemptive lock active",
    highlights: ["3-sec hardware debounce", "Sub-second SSE drawer", "Full device biodata"],
  },
  {
    num: 3,
    tabLabel: "03  Resolve",
    title: "Resolve and record",
    description:
      "Tap again to open close-out. Log root cause, parts replaced and the next service date. One atomic update closes the ticket and extends the device history.",
    statusText: "Resolved",
    pct: "100%",
    accentText: "Atomic RPC committed · Audit trail updated",
    highlights: ["Root cause + parts list", "Device status updated", "Timeline appended"],
  },
];

export function HomePage() {
  const { user, quickLoginAs } = useAuth();
  const navigate = useNavigate();

  // 3D Stage state
  const [tilt, setTilt] = useState({ rx: -7, ry: -22 });
  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phase, setPhase] = useState<StagePhase>("idle");

  // Interactive "How it works" state
  const [howStep, setHowStep] = useState<number>(1);

  // Interactive Smart Triage & Biodata cards state
  const [criticality, setCriticality] = useState<number>(5);
  const [safetyHazard, setSafetyHazard] = useState<boolean>(true);
  const [overdueBoost, setOverdueBoost] = useState<boolean>(true);
  const [biodataTab, setBiodataTab] = useState<"specs" | "history" | "warranty">(
    "specs",
  );

  const scenario = SCENARIOS[scenarioIdx];
  const isTapped = phase !== "idle";

  const computedScore = Math.min(
    100,
    criticality * 6 + (safetyHazard ? 45 : 16) + 10 + (overdueBoost ? 5 : 0),
  );

  const activeHow = HOW_STEPS[howStep - 1];

  const handleStageMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    setTilt({
      ry: Math.round(x * 56 * 10) / 10,
      rx: Math.round((-y * 28 - 4) * 10) / 10,
    });
  };

  const handleStageLeave = () => {
    setTilt({ rx: -7, ry: -22 });
  };

  const handleTapAction = () => {
    if (scenario.isUnknown) {
      setPhase(phase === "idle" ? "start" : "idle");
      return;
    }
    if (phase === "idle") setPhase("start");
    else if (phase === "start") setPhase("closeout");
    else if (phase === "closeout") setPhase("resolved");
    else setPhase("idle");
  };

  const selectScenario = (idx: number) => {
    setScenarioIdx(idx);
    setPhase("start");
  };

  const handleDemoEnter = async (userId: string, route: string) => {
    await quickLoginAs(userId);
    navigate(route);
  };

  const lcdLineA =
    phase === "idle"
      ? "READY"
      : scenario.isUnknown
        ? "UNKNOWN TAG"
        : phase === "start"
          ? "TAP OK: START"
          : phase === "closeout"
            ? "TAP 2: CLOSEOUT"
            : "RESOLVED OK";

  const lcdLineB =
    phase === "idle"
      ? "TAP A TAG..."
      : scenario.isUnknown
        ? `ADD ${scenario.uid.replace(/:/g, "").toUpperCase()}?`
        : phase === "start"
          ? `${scenario.id === "conveyor" ? "M-02" : "HP-04"} UNDER REVIEW`
          : phase === "closeout"
            ? "SUBMIT REPAIR LOG"
            : "HISTORY UPDATED";

  const tapButtonLabel =
    phase === "idle"
      ? "Simulate RFID tap"
      : scenario.isUnknown
        ? "Reset reader"
        : phase === "start"
          ? "Tap again (Close-out)"
          : phase === "closeout"
            ? "Confirm & Resolve"
            : "Reset reader";

  return (
    <div
      className="pjs min-h-screen bg-[#F8F6F3] text-[#0F172A] overflow-x-hidden"
      data-document-role="page"
      data-label="Homepage"
    >
      {/* Dark Forest Hero Wrapper */}
      <div
        className="relative overflow-hidden bg-[#07160F] text-white rounded-b-[40px] sm:rounded-b-[56px]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(123,224,180,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(123,224,180,.07) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      >
        <div className="rfid-hero-glow" />

        {/* Header */}
        <header className="relative z-10 mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-8">
          <Link
            to="/"
            className="flex items-center gap-2.5 text-[19px] font-extrabold tracking-tight"
          >
            <span className="grid h-[34px] w-[34px] place-items-center rounded-[11px] bg-[#7BE0B4]">
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#06140F"
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M5 12a7 7 0 0 1 7-7" />
                <path d="M5 12a7 7 0 0 0 7 7" opacity=".5" />
                <path d="M9 12a3 3 0 0 1 3-3" />
                <circle cx="13" cy="12" r="1.5" fill="#06140F" />
              </svg>
            </span>
            <span>DEAM-FODS</span>
          </Link>

          <nav
            aria-label="Homepage sections"
            className="hidden items-center gap-9 text-[15px] font-semibold text-[#C9E0D5] md:flex"
          >
            <a href="#how" className="hover:text-[#7BE0B4] transition-colors">
              How it works
            </a>
            <a href="#features" className="hover:text-[#7BE0B4] transition-colors">
              Features
            </a>
            <a href="#roles" className="hover:text-[#7BE0B4] transition-colors">
              Roles
            </a>
          </nav>

          <div className="flex items-center gap-2.5">
            {user ? (
              <Link
                to={getHomeRouteForRole(user.role)}
                className="inline-flex min-h-[46px] items-center gap-2 rounded-full bg-[#7BE0B4] px-6 text-[15px] font-bold text-[#06140F] shadow-[0_10px_40px_-10px_rgba(123,224,180,0.65)] transition hover:-translate-y-0.5 hover:bg-[#97ECC8]"
              >
                <span>Open Workspace</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-full border border-white/30 bg-white/[0.06] px-6 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.14]"
                >
                  Sign in
                </Link>
                <Link
                  to="/signup"
                  className="inline-flex min-h-[46px] items-center justify-center rounded-full bg-[#7BE0B4] px-6 text-[15px] font-bold text-[#06140F] shadow-[0_10px_40px_-10px_rgba(123,224,180,0.65)] transition hover:-translate-y-0.5 hover:bg-[#97ECC8]"
                >
                  Get started
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Hero Copy + 3D Interactive Stage */}
        <section className="relative z-10 mx-auto max-w-[1200px] px-5 pt-6 text-center sm:px-8">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#7BE0B4]/45 bg-[#7BE0B4]/10 px-4 py-2 text-[13px] font-bold text-[#9BEFC8]">
            <span className="rfid-led-blink h-2 w-2 rounded-full bg-[#7BE0B4]" />
            RFID-based smart lab maintenance
          </span>

          <h1 className="mx-auto mt-5 max-w-[900px] text-[clamp(36px,6.2vw,76px)] font-extrabold leading-[1.03] tracking-[-0.04em]">
            Every fault is one <span className="text-[#7BE0B4]">tap</span> away
            from its full history.
          </h1>

          <p className="mx-auto mt-5 max-w-[600px] text-[17px] sm:text-[19px] leading-[1.55] text-[#B9D3C6]">
            Tap the tag on the reader below and watch a ticket turn into a live
            repair record.
          </p>

          {/* Interactive Tag Preset Strip */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {SCENARIOS.map((sc, idx) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => selectScenario(idx)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                  idx === scenarioIdx
                    ? "border-[#7BE0B4] bg-[#7BE0B4]/20 text-[#9BEFC8]"
                    : "border-white/15 bg-white/[0.05] text-[#C9E0D5] hover:bg-white/[0.1]",
                )}
              >
                <span className="mono text-[11px]">{sc.uid}</span>
                <span>· {sc.label}</span>
              </button>
            ))}
          </div>

          {/* 3D Interactive Stage */}
          <div
            className="rfid-stage"
            onPointerMove={handleStageMove}
            onPointerLeave={handleStageLeave}
          >
            <div className="rfid-fit">
              <div
                className="rfid-scene"
                style={{
                  transform: `rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                }}
              >
                <div className="rfid-face rfid-face-back" />
                <div className="rfid-face rfid-face-right" />
                <div className="rfid-face rfid-face-left" />
                <div className="rfid-face rfid-face-top" />
                <div className="rfid-face rfid-face-bottom" />

                {/* Front Face (Clickable ESP32 + MFRC522 Reader) */}
                <button
                  type="button"
                  onClick={handleTapAction}
                  aria-label="Simulate RFID reader tap"
                  className="rfid-face rfid-face-front cursor-pointer text-left focus:outline-none"
                >
                  <div className="flex items-center justify-between px-[18px] pt-[14px]">
                    <span className="mono text-[11px] font-bold tracking-[0.16em] text-[#9BEFC8]">
                      ESP32 · MFRC522
                    </span>
                    <span
                      className="h-2.5 w-2.5 rounded-full transition-all"
                      style={
                        phase === "idle"
                          ? {
                              background: "#D99A45",
                              boxShadow: "0 0 10px #D99A45",
                            }
                          : scenario.isUnknown
                            ? {
                                background: "#DC6464",
                                boxShadow: "0 0 12px #DC6464",
                              }
                            : {
                                background: "#7BE0B4",
                                boxShadow: "0 0 12px #7BE0B4",
                              }
                      }
                    />
                  </div>

                  <div className="rfid-lcd mono mx-[18px] mt-[12px]">
                    <div>{lcdLineA}</div>
                    <div>{lcdLineB}</div>
                  </div>

                  <div className="absolute bottom-[16px] left-1/2 -ml-[48px] grid h-[44px] w-[96px] place-items-center rounded-[12px] border border-dashed border-[#9BEFC8]/70">
                    <span className="mono text-[11px] tracking-[0.2em] text-[#9BEFC8]">
                      READ
                    </span>
                  </div>

                  {isTapped && (
                    <>
                      <div className="rfid-wave" />
                      <div className="rfid-wave rfid-wave-delay" />
                    </>
                  )}
                </button>

                {/* Floating 13.56 MHz RFID Keycard */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={handleTapAction}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleTapAction();
                    }
                  }}
                  aria-label="RFID Tag Card"
                  className="rfid-tag"
                  style={{
                    transform: isTapped
                      ? "translateZ(58px) rotateZ(0deg)"
                      : "translateZ(200px) rotateZ(-9deg) rotateY(-14deg)",
                  }}
                >
                  <div className="rfid-tag-front">
                    <div className="px-[14px] py-[12px] text-left">
                      <div className="mono text-[10px] font-bold tracking-[0.14em] text-[#6B5A2F]">
                        13.56 MHz
                      </div>
                      <div
                        className="mt-[10px] h-[22px] w-[30px] rounded-[5px]"
                        style={{
                          background: "linear-gradient(135deg,#C9A24B,#EAD18E)",
                        }}
                      />
                      <div className="mono mt-[8px] text-[12px] font-bold text-[#2A2412]">
                        {scenario.uid}
                      </div>
                    </div>
                  </div>
                  <div className="rfid-tag-back" />
                </div>

                {/* Floating Z-Layered Left Telemetry Chips */}
                <div
                  className="rfid-chip-float left-[-300px] top-[10px] px-[18px] py-[14px] text-left"
                  style={{ transform: "translateZ(120px)" }}
                >
                  <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-[#9BEFC8]">
                    Priority queue
                  </span>
                  <span className="mt-1 block text-[15px] font-bold">
                    In-progress work stays pinned
                  </span>
                </div>

                <div
                  className="rfid-chip-float left-[-250px] top-[170px] flex items-center gap-[10px] px-[16px] py-[12px]"
                  style={{ transform: "translateZ(190px)" }}
                >
                  <span className="rfid-led-blink h-2.5 w-2.5 rounded-full bg-[#16A36A]" />
                  <span className="text-[14px] font-bold">
                    Live stream connected
                  </span>
                </div>

                {/* Floating Z-Layered Right Live Portal Card */}
                <div
                  className="rfid-panel text-left"
                  style={{ transform: "translateZ(150px)" }}
                >
                  {phase === "idle" ? (
                    <div>
                      <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#4B5563]">
                        Waiting for tap
                      </span>
                      <div className="mt-3 text-[20px] font-extrabold tracking-[-0.02em]">
                        {scenario.ticketTitle}
                      </div>
                      <div className="mt-2.5 h-2.5 rounded-[5px] bg-[#E5E7EB]" />
                      <div className="mt-2 h-2.5 w-[70%] rounded-[5px] bg-[#E5E7EB]" />
                      <p className="mt-3.5 text-[14px] leading-[1.5] text-[#4B5563]">
                        Tap the tag on the reader to load the device biodata.
                      </p>
                    </div>
                  ) : scenario.isUnknown ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#B94444]">
                          Unknown tag
                        </span>
                        <span className="rounded-full bg-[#FBE0E0] px-2.5 py-1 text-[11px] font-extrabold text-[#8E1F1F]">
                          Unregistered
                        </span>
                      </div>
                      <div className="text-[20px] font-extrabold tracking-[-0.02em]">
                        {scenario.deviceName}
                      </div>
                      <div className="rounded-[12px] bg-[#F4ECE1] px-3.5 py-3 text-[13px] leading-[1.45]">
                        {scenario.faultSummary}
                      </div>
                      <Link
                        to={
                          user?.role === "technician" || user?.role === "admin"
                            ? "/tech/devices/new?rfid=04DEAD99"
                            : "/login"
                        }
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#2E5D4B] py-2.5 text-xs font-bold text-white hover:bg-[#3F7A64] transition"
                      >
                        Add Device with 04DEAD99
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#1F6B4F]">
                          {phase === "resolved"
                            ? "Ticket resolved"
                            : phase === "closeout"
                              ? "Close-out ready"
                              : "Tag matched"}
                        </span>
                        <span className="rounded-full bg-[#FBE0E0] px-2.5 py-1 text-[12px] font-extrabold text-[#8E1F1F]">
                          {scenario.severity}
                        </span>
                      </div>

                      <div className="mt-2.5 text-[20px] font-extrabold tracking-[-0.02em]">
                        {scenario.deviceName}
                      </div>

                      <div className="mt-2.5 rounded-[12px] bg-[#F4ECE1] px-3.5 py-3 text-[13.5px] leading-[1.45]">
                        {phase === "closeout"
                          ? "Tap 2 confirmed — record root cause & parts replaced to commit atomic close-out."
                          : phase === "resolved"
                            ? "Incident logged, maintenance updated, and ticket closed atomically."
                            : scenario.faultSummary}
                      </div>

                      <div className="mt-3 grid gap-[7px] text-[13px]">
                        <div className="flex justify-between">
                          <span className="text-[#4B5563]">Maintenance log</span>
                          <b>{scenario.maintenanceLog}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#4B5563]">Past incident</span>
                          <b>{scenario.pastIncident}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#4B5563]">Next service</span>
                          <b
                            style={{
                              color:
                                phase === "resolved" ? "#16A36A" : "#8A5A12",
                            }}
                          >
                            {phase === "resolved"
                              ? "Scheduled +90d"
                              : scenario.nextService}
                          </b>
                        </div>
                      </div>

                      {/* 3-Step Mini Stepper */}
                      <div className="mt-3.5 flex items-center gap-1.5">
                        <span className="h-5 w-5 rounded-full bg-[#2E5D4B]" />
                        <span className="h-[3px] flex-1 bg-[#2E5D4B]" />
                        <span
                          className="h-5 w-5 rounded-full transition-colors"
                          style={{
                            background:
                              phase === "resolved" ? "#16A36A" : "#D99A45",
                          }}
                        />
                        <span
                          className="h-[3px] flex-1 transition-colors"
                          style={{
                            background:
                              phase === "resolved" ? "#16A36A" : "#D9DEE3",
                          }}
                        />
                        <span
                          className="h-5 w-5 rounded-full transition-all"
                          style={
                            phase === "resolved"
                              ? { background: "#16A36A" }
                              : { border: "2px solid #AAB3BC" }
                          }
                        />
                      </div>
                      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-[#4B5563]">
                        <span>Pending</span>
                        <span>Under review</span>
                        <span>Resolved</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stage Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 pb-10">
            <button
              type="button"
              onClick={handleTapAction}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#7BE0B4] px-9 text-[16px] font-bold text-[#06140F] shadow-[0_10px_40px_-10px_rgba(123,224,180,0.65)] transition hover:-translate-y-0.5 hover:bg-[#97ECC8]"
            >
              <Radio className="h-4 w-4" />
              <span>{tapButtonLabel}</span>
            </button>

            {phase !== "idle" && (
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-white/25 bg-white/[0.06] px-6 text-[15px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.14]"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>
            )}

            <a
              href="#how"
              className="inline-flex min-h-[56px] items-center justify-center rounded-full border border-white/28 bg-white/[0.06] px-9 text-[16px] font-bold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.14]"
            >
              See how it works
            </a>
          </div>

          <p className="pb-12 text-[13px] text-[#8FB1A1]">
            Move your cursor over the reader to rotate it, or click the reader to step through a full tap lifecycle.
          </p>
        </section>
      </div>

      {/* Section: How It Works */}
      <section id="how" className="mx-auto mt-[88px] max-w-[1200px] px-5 sm:px-8">
        <div className="text-center">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#2E5D4B]">
            How it works
          </span>
          <h2 className="mt-3 text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
            From fault to fixed in three moves.
          </h2>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {HOW_STEPS.map((item) => {
            const active = howStep === item.num;
            return (
              <button
                key={item.num}
                type="button"
                onClick={() => setHowStep(item.num)}
                className={cn(
                  "min-h-[46px] rounded-full border px-[22px] text-[15px] font-bold transition-all cursor-pointer",
                  active
                    ? "border-[#2E5D4B] bg-[#2E5D4B] text-white shadow-sm"
                    : "border-[#CBD2D9] bg-white text-[#0F172A] hover:border-[#2E5D4B]/50",
                )}
              >
                {item.tabLabel}
              </button>
            );
          })}
        </div>

        <div className="mt-7 grid items-center gap-10 rounded-[28px] bg-[#07160F] p-7 text-white sm:p-12 lg:grid-cols-[1.15fr_1fr]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeHow.num}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <h3 className="text-[28px] sm:text-[32px] font-bold tracking-[-0.03em]">
                {activeHow.title}
              </h3>
              <p className="text-[16px] sm:text-[17px] leading-[1.65] text-[#C4DCCF]">
                {activeHow.description}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {activeHow.highlights.map((hl) => (
                  <span
                    key={hl}
                    className="inline-flex items-center gap-1.5 rounded-full border border-[#7BE0B4]/30 bg-[#7BE0B4]/10 px-3 py-1 text-xs font-semibold text-[#9BEFC8]"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {hl}
                  </span>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          <div className="rounded-[20px] border border-[#7BE0B4]/40 bg-[#7BE0B4]/[0.08] p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#7BE0B4]">
                Status
              </span>
              <span className="mono text-xs text-[#9BEFC8]">
                {activeHow.pct}
              </span>
            </div>
            <div className="mt-3 text-[26px] sm:text-[28px] font-extrabold tracking-[-0.02em]">
              {activeHow.statusText}
            </div>
            <p className="mt-1 text-xs text-[#B9D3C6]">{activeHow.accentText}</p>
            <div className="mt-5 h-2.5 rounded-[5px] bg-white/15 overflow-hidden">
              <div
                className="h-full rounded-[5px] bg-[#7BE0B4] transition-all duration-500"
                style={{ width: activeHow.pct }}
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setHowStep((s) => (s === 3 ? 1 : s + 1))}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7BE0B4] hover:text-[#97ECC8]"
              >
                <span>{howStep === 3 ? "Restart cycle" : "Next move"}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Interactive Features (Smart Triage + Full Biodata) */}
      <section
        id="features"
        className="mx-auto mt-[88px] max-w-[1200px] px-5 sm:px-8"
      >
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          {/* Deep Sage Smart Triage Card (Interactive Score Playground) */}
          <div className="rfid-card-hover border-[#2E5D4B] bg-[#2E5D4B] p-8 text-white sm:p-10">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#9BEFC8]">
                Smart triage
              </span>
              <span className="mono rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-[#9BEFC8]">
                Score {computedScore} / 100
              </span>
            </div>

            <h3 className="mt-3 text-[28px] sm:text-[32px] font-bold leading-[1.12] tracking-[-0.03em]">
              The right ticket on top, always.
            </h3>
            <p className="mt-2.5 max-w-[520px] text-[16px] sm:text-[17px] leading-[1.65] text-[#DCEFE6]">
              Criticality, safety keywords and ticket age feed a 0 to 100 score.
              Work in progress is never bumped by a newer, higher score.
            </p>

            {/* Interactive Triage Controls */}
            <div className="mt-6 rounded-2xl border border-white/15 bg-black/15 p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-[#E8F3EF]">
                  Try live rule scoring:
                </span>
                <span className="inline-flex items-center gap-1 text-[#9BEFC8]">
                  <Pin className="h-3.5 w-3.5" />
                  Active work stays pinned
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-1.5">
                  <span>Criticality</span>
                  <select
                    aria-label="Simulate device criticality"
                    value={criticality}
                    onChange={(e) => setCriticality(Number(e.target.value))}
                    className="rounded bg-[#1B3A2E] px-1.5 py-0.5 font-mono text-white"
                  >
                    <option value={5}>5 (×6 = 30)</option>
                    <option value={4}>4 (×6 = 24)</option>
                    <option value={3}>3 (×6 = 18)</option>
                    <option value={2}>2 (×6 = 12)</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => setSafetyHazard((v) => !v)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 font-semibold transition",
                    safetyHazard
                      ? "border-[#7BE0B4] bg-[#7BE0B4] text-[#06140F]"
                      : "border-white/25 bg-white/10 text-white",
                  )}
                >
                  Safety Keyword (+45)
                </button>

                <button
                  type="button"
                  onClick={() => setOverdueBoost((v) => !v)}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 font-semibold transition",
                    overdueBoost
                      ? "border-[#7BE0B4] bg-[#7BE0B4] text-[#06140F]"
                      : "border-white/25 bg-white/10 text-white",
                  )}
                >
                  Overdue (+5)
                </button>
              </div>
            </div>
          </div>

          {/* Warm Beige Full Biodata Card (Interactive Inspector) */}
          <div className="rfid-card-hover border-[#E3D3BC] bg-[#F4ECE1] p-8 sm:p-10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#6B4F1D]">
                Full biodata
              </span>
              <span className="mono rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-[#2E5D4B] border border-[#E3D3BC]">
                PK: 04A3B2C1
              </span>
            </div>

            <h3 className="mt-3 text-[28px] sm:text-[32px] font-bold leading-[1.12] tracking-[-0.03em] text-[#0F172A]">
              Every device remembers.
            </h3>
            <p className="mt-2.5 text-[16px] sm:text-[17px] leading-[1.65] text-[#3F3A2E]">
              Specs, warranty, incidents and logs, all keyed to one RFID UID.
            </p>

            {/* Interactive mini tabs */}
            <div className="mt-5 space-y-2.5">
              <div className="flex gap-1.5">
                {(["specs", "history", "warranty"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setBiodataTab(tab)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-bold capitalize transition",
                      biodataTab === tab
                        ? "bg-[#2E5D4B] text-white"
                        : "bg-white/80 text-[#3F3A2E] hover:bg-white",
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="rounded-xl border border-[#E3D3BC] bg-white/90 p-3.5 text-xs text-[#0F172A]">
                {biodataTab === "specs" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[#6B7280] block">Model</span>
                      <b>HP-M404dn</b>
                    </div>
                    <div>
                      <span className="text-[#6B7280] block">IP Address</span>
                      <b className="mono">10.4.2.18</b>
                    </div>
                  </div>
                )}
                {biodataTab === "history" && (
                  <div className="space-y-1">
                    <p>
                      <b>Incident #098:</b> Tray 2 pickup roller replaced
                    </p>
                    <p className="text-[#6B7280]">
                      Atomic maintenance log appended · zero orphan records
                    </p>
                  </div>
                )}
                {biodataTab === "warranty" && (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[#6B7280] block">Warranty</span>
                      <b>Valid until Mar 2027</b>
                    </div>
                    <span className="rounded-full bg-[#D99A45]/15 px-2.5 py-0.5 font-semibold text-[#926018]">
                      Service Due
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Roles */}
      <section
        id="roles"
        className="mx-auto mt-5 max-w-[1200px] px-5 sm:px-8"
      >
        <div className="grid gap-5 md:grid-cols-3">
          <div className="rfid-card-hover flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#2E5D4B]">
                  Users
                </span>
                <User className="h-4 w-4 text-[#648DAA]" />
              </div>
              <p className="mt-2.5 text-[16px] leading-[1.6] text-[#0F172A]">
                Raise tickets with dropdown or RFID lookup and follow a clear
                three-step status.
              </p>
            </div>
            {isMockMode ? (
              <button
                type="button"
                onClick={() => handleDemoEnter("user-customer-1", "/portal")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Open User Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Sign in to Portal</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="rfid-card-hover flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#2E5D4B]">
                  Technicians
                </span>
                <Wrench className="h-4 w-4 text-[#2E5D4B]" />
              </div>
              <p className="mt-2.5 text-[16px] leading-[1.6] text-[#0F172A]">
                Work a ranked non-preemptive queue, tap devices via SSE and
                close out repairs.
              </p>
            </div>
            {isMockMode ? (
              <button
                type="button"
                onClick={() => handleDemoEnter("user-tech-1", "/tech")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Open Technician Queue</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Sign in as Technician</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          <div className="rfid-card-hover flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-[0.1em] text-[#2E5D4B]">
                  Admins
                </span>
                <Shield className="h-4 w-4 text-[#2E5D4B]" />
              </div>
              <p className="mt-2.5 text-[16px] leading-[1.6] text-[#0F172A]">
                Manage people, equipment lifecycle and ESP32 scanners with a
                full audit log.
              </p>
            </div>
            {isMockMode ? (
              <button
                type="button"
                onClick={() => handleDemoEnter("user-admin-1", "/admin")}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Open Admin Console</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : (
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2E5D4B] hover:text-[#3F7A64]"
              >
                <span>Sign in as Admin</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="mx-auto mt-[88px] max-w-[1200px] px-5 sm:px-8">
        <div
          className="rounded-[32px] bg-[#07160F] px-8 py-[72px] text-center text-white"
          style={{
            backgroundImage:
              "radial-gradient(circle at 50% 120%,rgba(123,224,180,.4),transparent 60%)",
          }}
        >
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#7BE0B4]/30 bg-white/[0.06] px-3.5 py-1 text-xs font-semibold text-[#9BEFC8] mb-5">
            <Cpu className="h-3.5 w-3.5" />
            <span>ESP32 · Supabase · FastAPI · React</span>
          </div>
          <h2 className="mx-auto max-w-[660px] text-[clamp(32px,4.4vw,52px)] font-extrabold leading-[1.08] tracking-[-0.035em]">
            Cut the downtime. Keep the history.
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[17px] leading-[1.6] text-[#B9D3C6]">
            Bring tickets, devices and RFID taps into one calm workspace.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              to={user ? getHomeRouteForRole(user.role) : "/signup"}
              className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-[#7BE0B4] px-9 text-[16px] font-bold text-[#06140F] shadow-[0_10px_40px_-10px_rgba(123,224,180,0.65)] transition hover:-translate-y-0.5 hover:bg-[#97ECC8]"
            >
              <span>{user ? "Open Workspace" : "Get started"}</span>
              <Sparkles className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-5 py-10 text-[14px] text-[#4B5563] sm:px-8">
        <span>DEAM-FODS · Smart lab maintenance</span>
        <span>FastAPI · Supabase · React · ESP32</span>
      </footer>
    </div>
  );
}
