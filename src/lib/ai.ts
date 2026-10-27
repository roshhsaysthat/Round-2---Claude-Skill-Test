/**
 * AI-assisted task creation sits behind this small interface so a real model
 * integration can replace the simulation without touching any UI.
 *
 * NO LIVE MODEL IS CALLED HERE. The default implementation is a local, rule-based
 * simulation and every result is labelled `simulated: true`; the UI must show that.
 * Suggestions are only ever proposals. They never assign anyone, change deadlines
 * or resolve blockers. They flow into the normal create-task form for review.
 */
import type { Priority } from "./types";

export interface AiSuggestion {
  title: string;
  description: string;
  priority: Priority;
  acceptanceCriteria: string[];
  subtasks: string[];
  simulated: boolean;
}

export interface TaskAiService {
  readonly name: string;
  readonly simulated: boolean;
  suggest(brief: string, options?: { signal?: AbortSignal }): Promise<AiSuggestion>;
}

type Archetype = "launch" | "bug" | "design" | "research" | "generic";

const PATTERNS: [Archetype, RegExp][] = [
  ["bug", /\b(bug|fix|crash|error|broken|regression|outage|incident|fails?|failing)\b/i],
  ["launch", /\b(launch|campaign|announce|release|rollout|go-live|promote|promotion)\b/i],
  ["design", /\b(design|redesign|mockup|wireframe|prototype|ux|ui|brand|layout)\b/i],
  ["research", /\b(research|investigate|evaluate|compare|analy[sz]e|audit|assess|explore|study)\b/i],
];

const SUBTASKS: Record<Archetype, string[]> = {
  launch: [
    "Define goals and success metrics",
    "Draft messaging and key assets",
    "Align owners and stakeholders",
    "Schedule and publish",
    "Review results after launch",
  ],
  bug: [
    "Reproduce and capture details",
    "Identify the root cause",
    "Implement and test the fix",
    "Verify in staging and release",
    "Add a regression test",
  ],
  design: [
    "Gather requirements and references",
    "Explore two or three directions",
    "Review with stakeholders",
    "Finalize and hand off",
  ],
  research: ["Write down the questions to answer", "Gather data and examples", "Synthesize findings", "Share a recommendation"],
  generic: ["Clarify scope and owner", "Break the work into steps", "Do the work", "Review and share the outcome"],
};

const CRITERIA: Record<Archetype, string[]> = {
  launch: [
    "Success metrics are defined and tracked",
    "All assets are approved by their owners",
    "A short post-launch review is scheduled",
  ],
  bug: [
    "The issue no longer reproduces on the reported setup",
    "A regression test covers the failing case",
    "The fix is verified in staging before release",
  ],
  design: [
    "Key flows are covered, including empty and error states",
    "Stakeholders have reviewed and signed off",
    "Specs are ready for engineering handoff",
  ],
  research: [
    "Findings answer the questions written at the start",
    "Sources and data are linked",
    "A clear recommendation is shared with the team",
  ],
  generic: ["The outcome is clearly described", "The owner confirms the work is complete", "Anything left over is captured as follow-up tasks"],
};

function pickPriority(brief: string, archetype: Archetype): Priority {
  if (/\b(urgent|asap|immediately|blocker|critical|outage|today)\b/i.test(brief)) return "urgent";
  if (/\b(soon|important|deadline|this week|customers?)\b/i.test(brief)) return "high";
  if (/\b(someday|eventually|nice to have|low priority|when possible)\b/i.test(brief)) return "low";
  return archetype === "bug" ? "high" : "medium";
}

function toTitle(brief: string): string {
  const firstSentence = brief.split(/[.!?\n]/)[0].trim().replace(/^(please|can you|we need to|i need to|let's)\s+/i, "");
  const text = firstSentence.length > 90 ? `${firstSentence.slice(0, 87).trimEnd()}...` : firstSentence;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    });
  });
}

export const simulatedAiService: TaskAiService = {
  name: "Simulated assistant",
  simulated: true,
  async suggest(brief, options) {
    const text = brief.trim();
    if (text.length < 8) throw new Error("Add a little more detail so there is something to work from.");
    await delay(700, options?.signal);
    const archetype = PATTERNS.find(([, re]) => re.test(text))?.[0] ?? "generic";
    const title = toTitle(text);
    return {
      title,
      description: `${text.replace(/\s+/g, " ")}\n\nThe goal is to finish this with a clear owner, a realistic due date and an agreed way to confirm it is done.`,
      priority: pickPriority(text, archetype),
      acceptanceCriteria: CRITERIA[archetype],
      subtasks: SUBTASKS[archetype],
      simulated: true,
    };
  },
};

/** The single place to swap in a real service later. */
export const aiService: TaskAiService = simulatedAiService;
