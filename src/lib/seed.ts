/**
 * Seed data. Dates are relative to "today" so the dashboard always has realistic
 * overdue / upcoming / blocked work. Every relationship is resolved by ref, then
 * validated by scripts/logic-check.ts. No metric is hardcoded anywhere.
 */
import { syncDeadlineNotifications } from "./domain";
import type {
  ActivityEvent,
  AppData,
  AppNotification,
  Comment,
  Priority,
  Project,
  Stage,
  Status,
  Task,
  Tint,
  User,
} from "./types";
import { addDays } from "./utils";

export const DATA_VERSION = 1;
export const CURRENT_USER_ID = "u-maya";

const USERS: User[] = [
  { id: "u-maya", name: "Maya Chen", role: "Product Manager", team: "Product" },
  { id: "u-arjun", name: "Arjun Mehta", role: "Senior Engineer", team: "Engineering" },
  { id: "u-lena", name: "Lena Fischer", role: "Product Designer", team: "Design" },
  { id: "u-tomas", name: "Tomás Rivera", role: "Marketing Lead", team: "Marketing" },
  { id: "u-sana", name: "Sana Qureshi", role: "Operations Manager", team: "Operations" },
  { id: "u-daniel", name: "Daniel Okafor", role: "Software Engineer", team: "Engineering" },
  { id: "u-ingrid", name: "Ingrid Larsen", role: "UX Researcher", team: "Design" },
  { id: "u-rahul", name: "Rahul Verma", role: "Software Engineer", team: "Engineering" },
  { id: "u-hannah", name: "Hannah Brooks", role: "Content Strategist", team: "Marketing" },
  { id: "u-kenji", name: "Kenji Watanabe", role: "Data Analyst", team: "Operations" },
];

const U = {
  maya: "u-maya",
  arjun: "u-arjun",
  lena: "u-lena",
  tomas: "u-tomas",
  sana: "u-sana",
  daniel: "u-daniel",
  ingrid: "u-ingrid",
  rahul: "u-rahul",
  hannah: "u-hannah",
  kenji: "u-kenji",
} as const;
type URef = keyof typeof U;

type PKey = "AUR" | "MAR" | "QGC" | "BPV" | "WOA";

interface ProjectDef {
  key: PKey;
  name: string;
  description: string;
  owner: URef;
  status: Project["status"];
  start: number;
  target: number;
  tint: Tint;
}

const PROJECT_DEFS: ProjectDef[] = [
  {
    key: "AUR",
    name: "Aurora Launch",
    description: "Launch Aurora, the workspace analytics add-on, to all customers with a coordinated web, sales and support push.",
    owner: "maya",
    status: "active",
    start: -30,
    target: 28,
    tint: "butter",
  },
  {
    key: "MAR",
    name: "Mobile App Redesign",
    description: "Redesign navigation, home and onboarding in the iOS and Android apps, then ship on the new design tokens.",
    owner: "lena",
    status: "active",
    start: -45,
    target: 40,
    tint: "lilac",
  },
  {
    key: "QGC",
    name: "Q4 Growth Campaign",
    description: "Holiday acquisition and nurture campaign across paid social, email and sponsored placements.",
    owner: "tomas",
    status: "active",
    start: -20,
    target: 35,
    tint: "sky",
  },
  {
    key: "BPV",
    name: "Billing Platform v2",
    description: "Replace the legacy invoicing system with usage-based metering, tax handling and automated dunning.",
    owner: "arjun",
    status: "active",
    start: -60,
    target: 20,
    tint: "sage",
  },
  {
    key: "WOA",
    name: "Warehouse Ops Automation",
    description: "Pilot handheld scanners and live dashboards to cut pick-and-pack errors in the main fulfillment center.",
    owner: "sana",
    status: "active",
    start: -25,
    target: 60,
    tint: "peach",
  },
];

interface Row {
  ref: string;
  p: PKey;
  title: string;
  desc?: string;
  st?: Status;
  stage?: Stage;
  pr?: Priority;
  as?: URef | null;
  rep?: URef;
  lab?: string[];
  due?: number | null;
  start?: number | null;
  by?: string[];
  hold?: string;
  block?: string;
  ago?: number;
  doneAgo?: number;
}

interface SubRow {
  parent: string;
  title: string;
  st?: Status;
  as?: URef | null;
}

const ROWS: Row[] = [
  /* ------------------------------ Aurora ------------------------------ */
  { ref: "aur-pos", p: "AUR", title: "Finalize launch positioning and messaging", desc: "Agree the target customer, the value proposition and the three proof points reused in every asset.", st: "done", pr: "high", as: "maya", rep: "maya", lab: ["Marketing", "Research"], due: -12, doneAgo: 11, ago: 28 },
  { ref: "aur-pricing", p: "AUR", title: "Approve Aurora pricing tiers", desc: "Lock tiers, usage limits and the launch discount with finance and sales.", st: "done", pr: "high", as: "sana", rep: "maya", lab: ["Ops"], due: -8, doneAgo: 9, ago: 27 },
  { ref: "aur-quotes", p: "AUR", title: "Collect customer quotes for the launch page", st: "done", pr: "low", as: "maya", rep: "maya", lab: ["Customer", "Marketing"], due: -6, doneAgo: 6, ago: 20 },
  { ref: "aur-copy", p: "AUR", title: "Write launch page copy", desc: "Hero, three feature sections, pricing explainer and FAQ, following the approved messaging.", st: "in_review", pr: "medium", as: "hannah", rep: "maya", lab: ["Marketing", "Docs"], due: 2, ago: 14 },
  { ref: "aur-landing", p: "AUR", title: "Build Aurora launch landing page", desc: "Implement the approved design, wire analytics events and run cross-browser QA.", st: "in_progress", pr: "high", as: "arjun", rep: "maya", lab: ["Feature", "Design"], due: 6, start: -5, by: ["aur-copy"], ago: 16 },
  { ref: "aur-enable", p: "AUR", title: "Prepare sales enablement kit", desc: "Pitch deck, objection handling and a demo script for the sales team.", st: "todo", pr: "medium", as: "tomas", rep: "maya", lab: ["Marketing", "Docs"], due: 12, by: ["aur-pos"], ago: 12 },
  { ref: "aur-beta", p: "AUR", title: "Triage beta feedback and fix launch blockers", desc: "Review all 41 beta responses, agree what must ship before GA and assign the rest to post-launch.", st: "in_progress", pr: "urgent", as: "maya", rep: "maya", lab: ["Customer", "Bug"], due: -2, start: -9, ago: 18 },
  { ref: "aur-sso", p: "AUR", title: "Fix SSO login loop reported by beta customers", desc: "Users on Okta get redirected back to the login page after consent. Reproduced on Safari and Chrome.", st: "in_progress", pr: "urgent", as: "daniel", rep: "maya", lab: ["Bug", "Customer"], due: 1, start: -3, ago: 7 },
  { ref: "aur-readiness", p: "AUR", title: "Hold launch readiness review", desc: "Go or no-go with owners of web, product, support and sales.", st: "todo", pr: "high", as: "maya", rep: "maya", lab: ["Ops"], due: 14, by: ["aur-landing", "aur-beta"], ago: 15 },
  { ref: "aur-faq", p: "AUR", title: "Publish help center articles for Aurora", desc: "Setup guide, permissions model and troubleshooting for the three most common beta issues.", st: "todo", pr: "medium", as: null, rep: "maya", lab: ["Docs"], due: 10, ago: 9 },
  { ref: "aur-pressk", p: "AUR", title: "Draft press kit and embargoed announcement", st: "todo", stage: "backlog", pr: "medium", as: "hannah", rep: "maya", lab: ["Marketing"], ago: 10 },
  { ref: "aur-video", p: "AUR", title: "Produce 90-second product demo video", desc: "Screen recording with voiceover, captions and a short intro for the landing page.", st: "in_progress", pr: "medium", as: "tomas", rep: "maya", lab: ["Marketing", "Design"], due: 20, hold: "Waiting on the final UI freeze before recording", ago: 11 },
  { ref: "aur-analytics", p: "AUR", title: "Instrument launch funnel events in analytics", desc: "Track visit, signup start, signup complete and first dashboard created.", st: "in_progress", pr: "high", as: "kenji", rep: "maya", lab: ["Ops", "Feature"], due: 5, start: -4, ago: 13 },
  { ref: "aur-legal", p: "AUR", title: "Legal review of marketing claims", desc: "Every performance claim on the landing page needs a source or needs to go.", st: "todo", pr: "medium", as: "maya", rep: "maya", lab: ["Ops"], due: 3, block: "Legal has no availability until next Monday. Slot requested.", ago: 8 },
  { ref: "aur-pricepage", p: "AUR", title: "Review Aurora pricing page copy", st: "in_review", pr: "medium", as: "maya", rep: "hannah", lab: ["Marketing"], due: 2, ago: 5 },
  { ref: "aur-partner", p: "AUR", title: "Evaluate partner referral program proposal", desc: "Inbound proposal from two agencies. Needs a recommendation, not a decision.", st: "todo", pr: "low", as: "maya", rep: "tomas", lab: ["Research"], hold: "Revisit after GA. Not needed for launch.", ago: 17 },
  { ref: "aur-roadmap", p: "AUR", title: "Draft Q1 roadmap themes", st: "todo", stage: "backlog", pr: "medium", as: "maya", rep: "maya", lab: ["Research"], ago: 6 },

  /* --------------------------- Mobile redesign ------------------------- */
  { ref: "mar-research", p: "MAR", title: "Synthesize usability study findings", desc: "Eight sessions, 34 issues. Cluster into five themes with severity.", st: "done", pr: "high", as: "ingrid", rep: "lena", lab: ["Research"], due: -15, doneAgo: 14, ago: 40 },
  { ref: "mar-ia", p: "MAR", title: "Define new navigation and information architecture", st: "done", pr: "high", as: "lena", rep: "lena", lab: ["Design"], due: -9, doneAgo: 10, ago: 32 },
  { ref: "mar-home", p: "MAR", title: "Design redesigned home screen", desc: "Cover loading, empty and error states. Include tablet breakpoint notes.", st: "in_review", pr: "high", as: "lena", rep: "lena", lab: ["Design"], due: 1, start: -10, ago: 24 },
  { ref: "mar-onboarding", p: "MAR", title: "Prototype three-step onboarding flow", st: "in_progress", pr: "medium", as: "lena", rep: "lena", lab: ["Design"], due: 9, start: -2, ago: 12 },
  { ref: "mar-tokens", p: "MAR", title: "Migrate color and spacing tokens to the design system", desc: "Replace 212 hardcoded values with tokens. Behind a feature flag until visual QA passes.", st: "in_progress", pr: "medium", as: "rahul", rep: "lena", lab: ["Tech debt", "Design"], due: 7, start: -6, ago: 19 },
  { ref: "mar-ios", p: "MAR", title: "Implement redesigned home screen on iOS", st: "todo", pr: "high", as: "rahul", rep: "lena", lab: ["Feature"], due: 16, by: ["mar-home"], ago: 10 },
  { ref: "mar-android", p: "MAR", title: "Implement redesigned home screen on Android", st: "todo", pr: "high", as: "daniel", rep: "lena", lab: ["Feature"], due: 18, by: ["mar-home"], ago: 10 },
  { ref: "mar-a11y", p: "MAR", title: "Audit redesigned screens for accessibility", desc: "Contrast, touch targets, screen reader order and dynamic type.", st: "todo", pr: "high", as: "ingrid", rep: "lena", lab: ["Research", "Design"], due: -1, ago: 14 },
  { ref: "mar-crash", p: "MAR", title: "Investigate crash on Android 12 during onboarding", desc: "About 1.4% of new Android 12 sessions. Stack trace points at the permission prompt.", st: "in_progress", pr: "urgent", as: "daniel", rep: "ingrid", lab: ["Bug", "Customer"], due: 2, start: -2, ago: 4 },
  { ref: "mar-dark", p: "MAR", title: "Explore dark mode palette", st: "todo", stage: "backlog", pr: "low", as: "lena", rep: "lena", lab: ["Design"], ago: 20 },
  { ref: "mar-tablet", p: "MAR", title: "Define tablet layouts for key screens", st: "todo", stage: "backlog", pr: "low", as: null, rep: "lena", lab: ["Design"], ago: 18 },
  { ref: "mar-icon", p: "MAR", title: "Refresh app icon and store screenshots", st: "todo", pr: "medium", as: "lena", rep: "lena", lab: ["Design", "Marketing"], due: 25, hold: "Paused until the brand refresh decision next quarter", ago: 15 },

  /* ------------------------------ Growth campaign ---------------------- */
  { ref: "qgc-brief", p: "QGC", title: "Write Q4 campaign brief and KPIs", st: "done", pr: "high", as: "tomas", rep: "tomas", lab: ["Marketing", "Docs"], due: -18, doneAgo: 17, ago: 20 },
  { ref: "qgc-segments", p: "QGC", title: "Define audience segments for paid social", st: "done", pr: "medium", as: "kenji", rep: "tomas", lab: ["Research"], due: -10, doneAgo: 9, ago: 18 },
  { ref: "qgc-retro", p: "QGC", title: "Publish Q3 campaign performance retro", st: "done", pr: "low", as: "kenji", rep: "tomas", lab: ["Docs", "Research"], due: -5, doneAgo: 4, ago: 15 },
  { ref: "qgc-creative", p: "QGC", title: "Develop creative concepts for the holiday push", st: "in_progress", pr: "high", as: "hannah", rep: "tomas", lab: ["Design", "Marketing"], due: 4, start: -7, ago: 12 },
  { ref: "qgc-calendar", p: "QGC", title: "Build content calendar for November", st: "in_review", pr: "medium", as: "hannah", rep: "tomas", lab: ["Marketing"], due: 0, ago: 11 },
  { ref: "qgc-tracking", p: "QGC", title: "Set up UTM scheme and conversion dashboards", desc: "Shared naming rules, conversion events per channel and one dashboard everyone trusts.", st: "in_progress", pr: "high", as: "kenji", rep: "tomas", lab: ["Ops"], due: 3, start: -3, ago: 9 },
  { ref: "qgc-email", p: "QGC", title: "Write holiday email nurture sequence", st: "todo", pr: "medium", as: "hannah", rep: "tomas", lab: ["Marketing"], due: 11, ago: 7 },
  { ref: "qgc-budget", p: "QGC", title: "Reconcile paid media budget with finance", desc: "Finance has a different committed spend for October. Find the delta and agree the Q4 plan.", st: "todo", pr: "high", as: "maya", rep: "tomas", lab: ["Ops"], due: 2, ago: 6 },
  { ref: "qgc-ab", p: "QGC", title: "Create landing page variants for the A/B test", st: "todo", pr: "medium", as: null, rep: "tomas", lab: ["Feature", "Marketing"], due: 13, by: ["qgc-creative"], ago: 5 },
  { ref: "qgc-sponsor", p: "QGC", title: "Confirm sponsored newsletter placements", st: "in_progress", pr: "medium", as: "tomas", rep: "tomas", lab: ["Marketing"], due: -3, block: "The vendor hasn't returned the signed insertion order", ago: 14 },
  { ref: "qgc-influencer", p: "QGC", title: "Shortlist influencer partners", st: "todo", stage: "backlog", pr: "low", as: "tomas", rep: "tomas", lab: ["Marketing", "Research"], ago: 8 },

  /* ------------------------------ Billing v2 --------------------------- */
  { ref: "bpv-schema", p: "BPV", title: "Design invoice schema and migration plan", st: "done", pr: "high", as: "arjun", rep: "arjun", lab: ["Tech debt", "Docs"], due: -30, doneAgo: 28, ago: 58 },
  { ref: "bpv-api", p: "BPV", title: "Build usage metering API", desc: "Idempotent ingest, per-tenant rollups and a replay endpoint for corrections.", st: "in_review", pr: "high", as: "daniel", rep: "arjun", lab: ["Feature"], due: 2, start: -14, ago: 30 },
  { ref: "bpv-pdf", p: "BPV", title: "Generate PDF invoices from the new schema", st: "in_progress", pr: "medium", as: "daniel", rep: "arjun", lab: ["Feature"], due: 8, start: -3, by: ["bpv-schema"], ago: 16 },
  { ref: "bpv-tax", p: "BPV", title: "Integrate tax calculation provider", desc: "VAT and US sales tax. Needs metering totals to compute line-level tax.", st: "in_progress", pr: "high", as: "rahul", rep: "arjun", lab: ["Feature", "Ops"], due: 10, start: -2, by: ["bpv-api"], ago: 14 },
  { ref: "bpv-dunning", p: "BPV", title: "Implement failed payment retry (dunning) flow", st: "todo", pr: "high", as: "arjun", rep: "arjun", lab: ["Feature", "Customer"], due: 15, ago: 12 },
  { ref: "bpv-ledger", p: "BPV", title: "Nightly ledger reconciliation job", st: "todo", pr: "medium", as: null, rep: "arjun", lab: ["Tech debt", "Ops"], due: 20, ago: 9 },
  { ref: "bpv-soc2", p: "BPV", title: "Prepare SOC 2 evidence for billing changes", st: "todo", pr: "medium", as: "sana", rep: "arjun", lab: ["Ops", "Docs"], due: 30, ago: 8 },
  { ref: "bpv-round", p: "BPV", title: "Fix rounding error on prorated annual upgrades", desc: "Customers upgrading mid-cycle are over-charged by up to 3 cents. Affects 212 invoices so far.", st: "in_progress", pr: "urgent", as: "rahul", rep: "arjun", lab: ["Bug", "Customer"], due: -4, start: -8, ago: 10 },
  { ref: "bpv-cutover", p: "BPV", title: "Plan production cutover and rollback", desc: "Decide the cutover window, data freeze rules and the rollback trigger.", st: "todo", pr: "high", as: "maya", rep: "arjun", lab: ["Ops"], due: 19, by: ["bpv-api", "bpv-tax", "bpv-dunning"], ago: 7 },
  { ref: "bpv-docs", p: "BPV", title: "Document billing webhooks for partners", st: "todo", stage: "backlog", pr: "low", as: null, rep: "arjun", lab: ["Docs"], ago: 13 },
  { ref: "bpv-refund", p: "BPV", title: "Self-serve refund requests in the admin console", st: "todo", stage: "backlog", pr: "medium", as: "daniel", rep: "arjun", lab: ["Feature", "Customer"], ago: 11 },

  /* ------------------------------ Warehouse ops ------------------------ */
  { ref: "woa-map", p: "WOA", title: "Map current pick-and-pack process", st: "done", pr: "medium", as: "sana", rep: "sana", lab: ["Ops", "Research"], due: -20, doneAgo: 19, ago: 24 },
  { ref: "woa-scan", p: "WOA", title: "Evaluate barcode scanner vendors", desc: "Compare three vendors on scan reliability, battery life and total cost per device.", st: "in_review", pr: "medium", as: "kenji", rep: "sana", lab: ["Research", "Ops"], due: 3, start: -9, ago: 17 },
  { ref: "woa-vendor", p: "WOA", title: "Negotiate scanner contract terms", st: "todo", pr: "medium", as: "maya", rep: "sana", lab: ["Ops"], due: 9, by: ["woa-scan"], ago: 3 },
  { ref: "woa-pilot", p: "WOA", title: "Run Zone B pilot with new handheld scanners", desc: "Two-week pilot with 12 pickers. Measure error rate and picks per hour before and after.", st: "todo", pr: "high", as: "sana", rep: "sana", lab: ["Ops"], due: 21, by: ["woa-scan"], ago: 10 },
  { ref: "woa-dash", p: "WOA", title: "Build live throughput dashboard", st: "in_progress", pr: "medium", as: "kenji", rep: "sana", lab: ["Feature", "Ops"], due: 8, start: -6, ago: 14 },
  { ref: "woa-train", p: "WOA", title: "Create training guide for warehouse leads", st: "todo", pr: "low", as: "hannah", rep: "sana", lab: ["Docs"], due: 27, ago: 6 },
  { ref: "woa-safety", p: "WOA", title: "Safety review of the conveyor changeover", st: "todo", pr: "high", as: "sana", rep: "sana", lab: ["Ops"], due: 12, hold: "Facilities is still repairing the floor in Zone C", ago: 12 },
  { ref: "woa-forecast", p: "WOA", title: "Draft Q1 labor demand forecast model", st: "todo", stage: "backlog", pr: "medium", as: "kenji", rep: "sana", lab: ["Research", "Ops"], ago: 9 },
  { ref: "woa-wms", p: "WOA", title: "Evaluate WMS integration options", st: "todo", stage: "backlog", pr: "medium", as: "arjun", rep: "sana", lab: ["Research", "Tech debt"], ago: 7 },
];

const SUBROWS: SubRow[] = [
  { parent: "aur-analytics", title: "Define event taxonomy", st: "done", as: "kenji" },
  { parent: "aur-analytics", title: "Implement client events", st: "in_progress", as: "arjun" },
  { parent: "aur-analytics", title: "Validate events in staging", st: "todo", as: "kenji" },
  { parent: "aur-landing", title: "Implement hero and feature sections", st: "done", as: "arjun" },
  { parent: "aur-landing", title: "Add pricing calculator", st: "in_progress", as: "arjun" },
  { parent: "aur-landing", title: "Cross-browser QA", st: "todo" },
  { parent: "aur-readiness", title: "Collect go or no-go inputs from each function", st: "todo" },
  { parent: "aur-readiness", title: "Draft rollback and comms plan", st: "todo" },
  { parent: "qgc-creative", title: "Concept sketches", st: "done", as: "hannah" },
  { parent: "qgc-creative", title: "Stakeholder pick", st: "todo", as: "tomas" },
  { parent: "qgc-creative", title: "Production assets", st: "todo", as: "hannah" },
  { parent: "bpv-dunning", title: "Define retry schedule with finance", st: "todo", as: "arjun" },
  { parent: "bpv-dunning", title: "Email templates for each failure stage", st: "todo", as: "hannah" },
  { parent: "bpv-dunning", title: "Admin override for manual retries", st: "todo" },
  { parent: "mar-onboarding", title: "Map happy path and permission prompts", st: "done", as: "lena" },
  { parent: "mar-onboarding", title: "Build clickable prototype", st: "in_progress", as: "lena" },
  { parent: "woa-pilot", title: "Select 12 pickers and a pilot supervisor", st: "todo", as: "sana" },
  { parent: "woa-pilot", title: "Define before and after measurements", st: "todo", as: "kenji" },
];

/** [task, author, body, minutes ago] */
const COMMENTS: [string, URef, string, number][] = [
  ["aur-beta", "daniel", "The SSO loop is the only true blocker so far. Everything else in the list is polish.", 60 * 26],
  ["aur-beta", "maya", "Agreed. I'll cut the rest from the GA scope and file them as post-launch.", 60 * 25],
  ["aur-sso", "daniel", "Reproduced it. The consent redirect drops the state parameter on Safari. Fix is small, testing now.", 95],
  ["aur-sso", "maya", "Thanks Daniel. Please ping me as soon as it is on staging so I can retest with the beta customers.", 70],
  ["aur-copy", "hannah", "Draft is ready for review. I need a decision on whether we lead with speed or accuracy.", 60 * 8],
  ["aur-copy", "maya", "Lead with accuracy. Speed is a claim legal will make us qualify.", 60 * 6],
  ["aur-landing", "arjun", "I can start the build now but I'd rather wait for final copy to avoid rework.", 60 * 20],
  ["mar-home", "lena", "Handoff notes are in the file. Open question on the tablet breakpoint for the activity feed.", 60 * 5],
  ["mar-crash", "ingrid", "Heavy on Pixel 4a and Galaxy A12. Might help narrow it down.", 60 * 3],
  ["bpv-round", "rahul", "The proration rounds each line item separately. We should round the total, not each line.", 60 * 22],
  ["bpv-round", "arjun", "Right, and finance wants a credit run for affected customers. Can you size it?", 60 * 21],
  ["bpv-cutover", "arjun", "@Maya can you own the customer comms section? I'll write the technical plan.", 60 * 30],
  ["qgc-budget", "tomas", "Finance shows a committed spend that is higher than our sheet by about the October retainer.", 60 * 4],
  ["woa-scan", "kenji", "Vendor B has the best scan rate but the battery only lasts six hours.", 60 * 12],
];

/** [task, actor, text, minutes ago]. Powers Home > Recent activity. */
const EVENTS: [string, URef, string, number][] = [
  ["aur-sso", "daniel", "moved AUR-8 from To do to In progress", 60 * 6],
  ["mar-home", "lena", "moved MAR-3 from In progress to In review", 60 * 7],
  ["woa-vendor", "sana", "assigned this to Maya Chen", 180],
  ["bpv-api", "daniel", "moved BPV-2 from In progress to In review", 60 * 10],
  ["qgc-calendar", "hannah", "moved QGC-5 from In progress to In review", 60 * 9],
  ["qgc-sponsor", "tomas", "marked as blocked: The vendor hasn't returned the signed insertion order", 60 * 28],
  ["aur-video", "tomas", "put this on hold: Waiting on the final UI freeze before recording", 60 * 31],
  ["aur-pos", "maya", "moved AUR-1 from In review to Done", 60 * 24 * 11],
];

function iso(today: string, dayOffset: number, hour = 9): string {
  const day = addDays(today, dayOffset);
  return `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

export function buildSeed(today: string, nowIso: string): AppData {
  let seq = 0;
  const id = (prefix: string): string => `${prefix}${++seq}`;
  const minsAgo = (m: number): string => new Date(new Date(nowIso).getTime() - m * 60_000).toISOString();

  const projects: Project[] = PROJECT_DEFS.map((def) => ({
    id: id("p"),
    key: def.key,
    name: def.name,
    description: def.description,
    ownerId: U[def.owner],
    status: def.status,
    startDate: addDays(today, def.start),
    targetDate: addDays(today, def.target),
    tint: def.tint,
    nextNumber: 1,
    createdAt: iso(today, def.start - 2),
    updatedAt: nowIso,
  }));
  const projectByKey = new Map(projects.map((p, i) => [PROJECT_DEFS[i].key, p]));

  const tasks: Task[] = [];
  const byRef = new Map<string, Task>();
  const activity: ActivityEvent[] = [];
  const makeTask = (row: {
    ref: string;
    p: PKey;
    title: string;
    desc?: string;
    st: Status;
    stage: Stage;
    pr: Priority;
    as: URef | null;
    rep: URef;
    lab: string[];
    due: number | null;
    start: number | null;
    parent: Task | null;
    ago: number;
    doneAgo?: number;
    hold?: string;
    block?: string;
  }): Task => {
    const project = projectByKey.get(row.p)!;
    const number = project.nextNumber++;
    const createdAt = iso(today, -row.ago);
    const task: Task = {
      id: id("t"),
      key: `${project.key}-${number}`,
      number,
      title: row.title,
      description: row.desc ?? "",
      status: row.stage === "backlog" ? "todo" : row.st,
      stage: row.stage,
      priority: row.pr,
      assigneeId: row.as ? U[row.as] : null,
      reporterId: U[row.rep],
      projectId: project.id,
      labels: row.lab,
      createdAt,
      updatedAt: row.st === "done" ? iso(today, -(row.doneAgo ?? 1), 15) : minsAgo(60 * (4 + (tasks.length % 40))),
      completedAt: row.st === "done" && row.stage === "active" ? iso(today, -(row.doneAgo ?? 1), 15) : null,
      startDate: row.start === null ? null : addDays(today, row.start),
      dueDate: row.due === null ? null : addDays(today, row.due),
      parentId: row.parent?.id ?? null,
      blockedBy: [],
      hold: row.hold ? { reason: row.hold, at: minsAgo(60 * 30), byId: U[row.as ?? row.rep] } : null,
      blocker: row.block ? { reason: row.block, at: minsAgo(60 * 28), byId: U[row.as ?? row.rep] } : null,
      comments: [],
      rank: tasks.length + 1,
    };
    tasks.push(task);
    byRef.set(row.ref, task);
    activity.push({
      id: id("a"),
      taskId: task.id,
      projectId: project.id,
      actorId: task.reporterId,
      at: createdAt,
      text: row.parent ? `added subtask ${task.key}: ${task.title}` : `created ${task.key}`,
    });
    return task;
  };

  for (const r of ROWS) {
    makeTask({
      ref: r.ref,
      p: r.p,
      title: r.title,
      desc: r.desc,
      st: r.st ?? "todo",
      stage: r.stage ?? "active",
      pr: r.pr ?? "none",
      as: r.as === undefined ? null : r.as,
      rep: r.rep ?? "maya",
      lab: r.lab ?? [],
      due: r.due === undefined ? null : r.due,
      start: r.start === undefined ? null : r.start,
      parent: null,
      ago: r.ago ?? 10,
      doneAgo: r.doneAgo,
      hold: r.hold,
      block: r.block,
    });
  }

  for (const r of ROWS) {
    if (!r.by) continue;
    const t = byRef.get(r.ref)!;
    t.blockedBy = r.by.map((ref) => {
      const dep = byRef.get(ref);
      if (!dep) throw new Error(`Seed error: ${r.ref} depends on unknown ${ref}`);
      return dep.id;
    });
  }

  let subIndex = 0;
  for (const s of SUBROWS) {
    const parent = byRef.get(s.parent);
    if (!parent) throw new Error(`Seed error: unknown parent ${s.parent}`);
    const key = PROJECT_DEFS.find((d) => projectByKey.get(d.key)!.id === parent.projectId)!.key;
    makeTask({
      ref: `sub-${subIndex++}`,
      p: key,
      title: s.title,
      st: s.st ?? "todo",
      stage: parent.stage,
      pr: "none",
      as: s.as ?? null,
      rep: "maya",
      lab: [],
      due: null,
      start: null,
      parent,
      ago: 5,
      doneAgo: 2,
    });
  }

  for (const [ref, author, body, m] of COMMENTS) {
    const t = byRef.get(ref);
    if (!t) throw new Error(`Seed error: comment on unknown ${ref}`);
    const c: Comment = { id: id("c"), authorId: U[author], body, createdAt: minsAgo(m) };
    t.comments.push(c);
    activity.push({ id: id("a"), taskId: t.id, projectId: t.projectId, actorId: U[author], at: c.createdAt, text: "commented" });
  }

  for (const [ref, actor, text, m] of EVENTS) {
    const t = byRef.get(ref);
    if (!t) throw new Error(`Seed error: event on unknown ${ref}`);
    activity.push({ id: id("a"), taskId: t.id, projectId: t.projectId, actorId: U[actor], at: minsAgo(m), text });
  }
  activity.sort((a, b) => a.at.localeCompare(b.at));

  const note = (
    userId: string,
    type: AppNotification["type"],
    ref: string,
    actor: URef,
    text: string,
    m: number,
    read: boolean,
  ): AppNotification => ({
    id: id("n"),
    userId,
    type,
    taskId: byRef.get(ref)!.id,
    actorId: U[actor],
    text,
    at: minsAgo(m),
    read,
  });
  const notifications: AppNotification[] = [
    note(U.maya, "assigned", "woa-vendor", "sana", `Sana Qureshi assigned you ${byRef.get("woa-vendor")!.key}: Negotiate scanner contract terms`, 180, false),
    note(U.maya, "mention", "bpv-cutover", "arjun", `Arjun Mehta mentioned you on ${byRef.get("bpv-cutover")!.key}: @Maya can you own the customer comms section?`, 60 * 30, false),
    note(U.maya, "updated", "aur-sso", "daniel", `Daniel Okafor commented on ${byRef.get("aur-sso")!.key}`, 95, false),
    note(U.maya, "updated", "aur-copy", "hannah", `Hannah Brooks moved ${byRef.get("aur-copy")!.key} to In review`, 60 * 30, true),
    note(U.arjun, "mention", "bpv-round", "rahul", `Rahul Verma commented on ${byRef.get("bpv-round")!.key}`, 60 * 22, false),
    note(U.lena, "updated", "mar-crash", "ingrid", `Ingrid Larsen commented on ${byRef.get("mar-crash")!.key}`, 60 * 3, false),
  ];

  const data: AppData = {
    version: DATA_VERSION,
    seq,
    currentUserId: CURRENT_USER_ID,
    users: USERS,
    projects,
    tasks,
    activity,
    notifications,
  };

  // Deadline reminders are derived from the data, never hardcoded.
  const synced = syncDeadlineNotifications(data, { actorId: CURRENT_USER_ID, now: nowIso }, today);
  return synced.ok ? synced.data : data;
}
