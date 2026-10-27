import type { Priority, Tint } from "./types";

export interface TemplateItem {
  ref: string;
  title: string;
  description: string;
  priority: Priority;
  labels: string[];
  /** Days after the project start date that this item is due. */
  dueOffset: number;
  dependsOn?: string[];
  subtasks?: string[];
}

export interface Template {
  id: string;
  name: string;
  blurb: string;
  tint: Tint;
  project: { name: string; description: string; durationDays: number };
  items: TemplateItem[];
  /** A single-task blueprint for "create a task from this template". */
  task: { title: string; description: string; priority: Priority; labels: string[]; subtasks: string[] };
}

export const TEMPLATES: Template[] = [
  {
    id: "tpl-product-launch",
    name: "Product launch",
    blurb: "From positioning to launch day, with the dependencies already wired.",
    tint: "butter",
    project: {
      name: "Product launch",
      description: "Coordinate messaging, pricing, web, enablement and launch day across teams.",
      durationDays: 42,
    },
    items: [
      {
        ref: "positioning",
        title: "Define positioning and messaging",
        description: "Agree target customer, value proposition and the three proof points every asset will reuse.",
        priority: "high",
        labels: ["Marketing", "Research"],
        dueOffset: 7,
        subtasks: ["Interview five target customers", "Draft messaging house", "Review with leadership"],
      },
      {
        ref: "pricing",
        title: "Finalize pricing and packaging",
        description: "Lock tiers, limits and launch discount rules with finance and sales.",
        priority: "high",
        labels: ["Ops"],
        dueOffset: 10,
      },
      {
        ref: "landing",
        title: "Build launch landing page",
        description: "Design, build and QA the launch page, including analytics events.",
        priority: "medium",
        labels: ["Design", "Feature"],
        dueOffset: 24,
        dependsOn: ["positioning", "pricing"],
        subtasks: ["Wireframe page sections", "Write page copy", "Implement and QA"],
      },
      {
        ref: "enablement",
        title: "Prepare sales enablement kit",
        description: "Pitch deck, FAQ, objection handling and demo script for the sales team.",
        priority: "medium",
        labels: ["Marketing", "Docs"],
        dueOffset: 28,
        dependsOn: ["positioning"],
      },
      {
        ref: "beta",
        title: "Review beta feedback and fix launch blockers",
        description: "Triage beta feedback and agree what must ship before launch.",
        priority: "urgent",
        labels: ["Bug", "Customer"],
        dueOffset: 30,
      },
      {
        ref: "readiness",
        title: "Hold launch readiness review",
        description: "Go or no-go meeting with owners of web, product, support and sales.",
        priority: "high",
        labels: ["Ops"],
        dueOffset: 36,
        dependsOn: ["landing", "enablement", "beta"],
      },
      {
        ref: "launch",
        title: "Run launch day command center",
        description: "Staff the war room, monitor metrics and handle comms for launch day.",
        priority: "urgent",
        labels: ["Ops", "Marketing"],
        dueOffset: 42,
        dependsOn: ["readiness"],
      },
    ],
    task: {
      title: "Launch readiness checklist",
      description: "Confirm every function is ready before the go or no-go decision.",
      priority: "high",
      labels: ["Ops"],
      subtasks: [
        "Product sign-off on scope",
        "Support macros and help center updated",
        "Billing and pricing verified in production",
        "Launch comms approved",
        "Rollback plan reviewed",
      ],
    },
  },
  {
    id: "tpl-design-project",
    name: "Design project",
    blurb: "Discovery through handoff for a new product surface.",
    tint: "lilac",
    project: {
      name: "Design project",
      description: "Research, structure, design and validate a new experience, then hand it to engineering.",
      durationDays: 35,
    },
    items: [
      {
        ref: "research",
        title: "Synthesize discovery research",
        description: "Turn interviews and analytics into problem statements and design principles.",
        priority: "high",
        labels: ["Research", "Design"],
        dueOffset: 5,
      },
      {
        ref: "ia",
        title: "Map information architecture and key flows",
        description: "Define navigation, core objects and the three primary user flows.",
        priority: "medium",
        labels: ["Design"],
        dueOffset: 10,
        dependsOn: ["research"],
      },
      {
        ref: "wires",
        title: "Produce low-fidelity wireframes",
        description: "Explore two layout directions for each primary flow.",
        priority: "medium",
        labels: ["Design"],
        dueOffset: 16,
        dependsOn: ["ia"],
        subtasks: ["Flow one wireframes", "Flow two wireframes", "Flow three wireframes"],
      },
      {
        ref: "visual",
        title: "Develop high-fidelity visual design",
        description: "Apply the design system and cover empty, loading and error states.",
        priority: "medium",
        labels: ["Design"],
        dueOffset: 25,
        dependsOn: ["wires"],
      },
      {
        ref: "test",
        title: "Prototype and run usability tests",
        description: "Test with six participants and capture changes to make before handoff.",
        priority: "high",
        labels: ["Research"],
        dueOffset: 30,
        dependsOn: ["visual"],
      },
      {
        ref: "handoff",
        title: "Complete design QA and engineering handoff",
        description: "Annotate specs, align on component gaps and walk engineering through the designs.",
        priority: "medium",
        labels: ["Design", "Docs"],
        dueOffset: 35,
        dependsOn: ["test"],
      },
    ],
    task: {
      title: "Design review package",
      description: "Everything reviewers need to give useful feedback in one pass.",
      priority: "medium",
      labels: ["Design"],
      subtasks: ["Write context and goals", "Export key screens", "List open questions", "Schedule review session"],
    },
  },
  {
    id: "tpl-marketing-campaign",
    name: "Marketing campaign",
    blurb: "Brief, creative, channels and reporting for a multi-channel push.",
    tint: "sky",
    project: {
      name: "Marketing campaign",
      description: "Plan, produce, launch and measure a multi-channel campaign.",
      durationDays: 30,
    },
    items: [
      {
        ref: "brief",
        title: "Write campaign brief and success metrics",
        description: "Objective, audience, budget, timing and the numbers that define success.",
        priority: "high",
        labels: ["Marketing", "Docs"],
        dueOffset: 4,
      },
      {
        ref: "segments",
        title: "Define audience segments",
        description: "Pick two segments and the message angle for each.",
        priority: "medium",
        labels: ["Research", "Marketing"],
        dueOffset: 7,
        dependsOn: ["brief"],
      },
      {
        ref: "creative",
        title: "Develop creative concepts",
        description: "Three concepts with sample headlines and visuals, narrowed to one.",
        priority: "medium",
        labels: ["Design", "Marketing"],
        dueOffset: 14,
        dependsOn: ["segments"],
        subtasks: ["Concept sketches", "Stakeholder pick", "Production assets"],
      },
      {
        ref: "calendar",
        title: "Build content calendar",
        description: "Schedule posts, emails and paid placements across channels.",
        priority: "low",
        labels: ["Marketing"],
        dueOffset: 16,
        dependsOn: ["brief"],
      },
      {
        ref: "tracking",
        title: "Set up channel tracking and dashboards",
        description: "UTM scheme, conversion events and a shared dashboard before spend begins.",
        priority: "high",
        labels: ["Ops"],
        dueOffset: 18,
      },
      {
        ref: "go",
        title: "Launch campaign",
        description: "Publish and activate paid placements. Monitor the first 48 hours.",
        priority: "urgent",
        labels: ["Marketing"],
        dueOffset: 21,
        dependsOn: ["creative", "calendar", "tracking"],
      },
      {
        ref: "report",
        title: "Publish performance report",
        description: "Results against the brief, what worked and what to change next time.",
        priority: "medium",
        labels: ["Docs", "Research"],
        dueOffset: 30,
        dependsOn: ["go"],
      },
    ],
    task: {
      title: "Campaign brief",
      description: "A one-page brief the whole team can work from.",
      priority: "high",
      labels: ["Marketing", "Docs"],
      subtasks: ["Define objective and KPIs", "Confirm audience and budget", "Agree timeline", "Get sign-off"],
    },
  },
];

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
