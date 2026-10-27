/**
 * Logic checks for the domain layer. Run with: npm run check:logic
 * Exercises seed integrity, lifecycle rules, dependencies, undo, metrics and search.
 */
import assert from "node:assert/strict";
import * as d from "../src/lib/domain";
import { getEffectiveState, indexTasks, linkableTasks, dependsOn } from "../src/lib/lifecycle";
import { buildSeed } from "../src/lib/seed";
import { countByState, homeMetrics, projectStats, searchAll, tasksForView, topLevel } from "../src/lib/selectors";
import type { AppData, OpOk, OpResult, Task } from "../src/lib/types";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.error(`  FAIL ${name}\n       ${(e as Error).message}`);
    process.exitCode = 1;
  }
}

const today = "2026-10-27";
const now = `${today}T10:00:00.000Z`;
const me = "u-maya";
const ctx = { actorId: me, now };
const seed = buildSeed(today, now);

function ok<T = undefined>(r: OpResult<T>): OpOk<T> {
  if (!r.ok) assert.fail(`expected ok, got error: ${r.error}`);
  return r;
}
function bad(r: OpResult<unknown>, match?: RegExp): void {
  assert.equal(r.ok, false, "expected an error result");
  if (match && !r.ok) assert.match(r.error, match);
}
const byTitle = (data: AppData, text: string): Task => {
  const t = data.tasks.find((x) => x.title.includes(text));
  assert.ok(t, `no task containing "${text}"`);
  return t;
};

console.log("Seed integrity");
test("ids, keys and references are valid and unique", () => {
  const ids = new Set(seed.tasks.map((t) => t.id));
  assert.equal(ids.size, seed.tasks.length);
  assert.equal(new Set(seed.tasks.map((t) => t.key)).size, seed.tasks.length);
  for (const t of seed.tasks) {
    assert.ok(seed.projects.some((p) => p.id === t.projectId), `${t.key} project`);
    if (t.assigneeId) assert.ok(seed.users.some((u) => u.id === t.assigneeId), `${t.key} assignee`);
    assert.ok(seed.users.some((u) => u.id === t.reporterId), `${t.key} reporter`);
    if (t.parentId) assert.ok(ids.has(t.parentId), `${t.key} parent`);
    for (const dep of t.blockedBy) assert.ok(ids.has(dep), `${t.key} dependency`);
    assert.ok(t.id !== t.parentId);
  }
});
test("no state contradictions in the seed", () => {
  for (const t of seed.tasks) {
    if (t.stage === "backlog") assert.ok(t.status === "todo" && !t.hold && !t.blocker, `${t.key} backlog`);
    if (t.status === "done") assert.ok(!t.hold && !t.blocker, `${t.key} done`);
    assert.ok(!(t.hold && t.blocker), `${t.key} hold + blocker`);
  }
});
test("no dependency cycles", () => {
  const index = indexTasks(seed.tasks);
  for (const t of seed.tasks) for (const dep of t.blockedBy) assert.equal(dependsOn(index, dep, t.id), false, t.key);
});
test("seed covers every required state", () => {
  const counts = countByState(topLevel(seed.tasks), indexTasks(seed.tasks));
  for (const k of ["backlog", "done", "on_hold", "blocked", "active"] as const) assert.ok(counts[k] > 0, k);
  assert.ok(seed.tasks.some((t) => t.parentId));
  assert.ok(seed.tasks.some((t) => !t.assigneeId));
  assert.ok(seed.notifications.some((n) => n.type === "deadline"));
  assert.ok(seed.notifications.some((n) => n.type === "mention"));
  assert.ok(seed.notifications.some((n) => n.type === "assigned"));
});

console.log("Metrics are derived, not hardcoded");
test("home metrics agree with the effective-state model", () => {
  const m = homeMetrics(seed, "me", today);
  const index = indexTasks(seed.tasks);
  const mine = topLevel(seed.tasks).filter((t) => t.assigneeId === me);
  assert.equal(m.completed.length, mine.filter((t) => getEffectiveState(t, index) === "done").length);
  assert.equal(m.blocked.length, mine.filter((t) => getEffectiveState(t, index) === "blocked").length);
  assert.equal(m.onHold.length, mine.filter((t) => getEffectiveState(t, index) === "on_hold").length);
  assert.ok(m.overdue.every((t) => t.dueDate! < today));
  assert.ok(m.overdue.length >= 1 && m.upcoming.length >= 1);
});
test("kanban/list and blocked/on-hold views draw from the same records", () => {
  const index = indexTasks(seed.tasks);
  const flow = tasksForView(seed, index, "kanban", "all");
  const list = tasksForView(seed, index, "list", "all");
  assert.deepEqual(flow.map((t) => t.id), list.map((t) => t.id));
  const hold = tasksForView(seed, index, "onhold", "all");
  const blocked = tasksForView(seed, index, "blocked", "all");
  for (const t of hold) assert.ok(!flow.some((x) => x.id === t.id));
  assert.ok(blocked.every((t) => flow.some((x) => x.id === t.id)), "blocked tasks stay on the board with an indicator");
  assert.ok(!hold.some((t) => blocked.some((b) => b.id === t.id)), "never both on hold and blocked");
});

console.log("Status transitions");
test("blocked task cannot be marked done, and nothing changes", () => {
  const t = byTitle(seed, "Hold launch readiness review");
  bad(d.setStatus(seed, ctx, t.id, "done"), /blocked/i);
});
test("moving a status updates the one shared record", () => {
  const t = byTitle(seed, "Review Aurora pricing page copy");
  const r = ok(d.setStatus(seed, ctx, t.id, "done"));
  assert.equal(r.data.tasks.find((x) => x.id === t.id)!.status, "done");
  assert.ok(r.data.tasks.find((x) => x.id === t.id)!.completedAt);
  assert.equal(seed.tasks.find((x) => x.id === t.id)!.status, "in_review", "input data is not mutated");
});
test("same-status move is a no-op, not a fake success", () => {
  const t = byTitle(seed, "Review Aurora pricing page copy");
  const r = ok(d.setStatus(seed, ctx, t.id, "in_review"));
  assert.equal(r.changed, false);
});
test("a task with a manual blocker can't be completed until the blocker is resolved", () => {
  const manual = byTitle(seed, "Legal review of marketing claims");
  bad(d.setStatus(seed, ctx, manual.id, "done"), /blocked/i);
  const resolved = ok(d.resolveBlocker(seed, ctx, manual.id, { kind: "manual" })).data;
  const finished = ok(d.setStatus(resolved, ctx, manual.id, "done")).data;
  assert.equal(getEffectiveState(finished.tasks.find((x) => x.id === manual.id)!, indexTasks(finished.tasks)), "done");
});
test("done work is never displayed as blocked or on hold", () => {
  const held = byTitle(seed, "Produce 90-second product demo video");
  assert.ok(held.hold);
  const r = ok(d.setStatus(seed, ctx, held.id, "done"));
  const after = r.data.tasks.find((x) => x.id === held.id)!;
  assert.equal(after.hold, null);
  assert.equal(getEffectiveState(after, indexTasks(r.data.tasks)), "done");
});

console.log("Dependencies");
test("finishing a blocking task unblocks its dependents", () => {
  const copy = byTitle(seed, "Write launch page copy");
  const landing = byTitle(seed, "Build Aurora launch landing page");
  assert.equal(getEffectiveState(landing, indexTasks(seed.tasks)), "blocked");
  const r = ok(d.setStatus(seed, ctx, copy.id, "done"));
  const after = r.data.tasks.find((x) => x.id === landing.id)!;
  assert.equal(getEffectiveState(after, indexTasks(r.data.tasks)), "active");
  assert.ok(r.data.notifications.some((n) => n.taskId === landing.id && /no longer blocked/.test(n.text)) || landing.assigneeId === me);
});
test("reopening the blocker re-blocks the dependent", () => {
  const copy = byTitle(seed, "Write launch page copy");
  const landing = byTitle(seed, "Build Aurora launch landing page");
  const done = ok(d.setStatus(seed, ctx, copy.id, "done")).data;
  const reopened = ok(d.setStatus(done, ctx, copy.id, "in_progress")).data;
  assert.equal(getEffectiveState(reopened.tasks.find((x) => x.id === landing.id)!, indexTasks(reopened.tasks)), "blocked");
});
test("self dependency, duplicates and cycles are rejected", () => {
  const a = byTitle(seed, "Build Aurora launch landing page");
  const b = byTitle(seed, "Write launch page copy");
  bad(d.linkDependency(seed, ctx, a.id, a.id), /itself/);
  bad(d.linkDependency(seed, ctx, a.id, b.id), /already depends/);
  bad(d.linkDependency(seed, ctx, b.id, a.id), /circular/);
});
test("linkable picker excludes invalid targets", () => {
  const a = byTitle(seed, "Build Aurora launch landing page");
  const ids = linkableTasks(indexTasks(seed.tasks), a.id).map((t) => t.id);
  assert.ok(!ids.includes(a.id));
  assert.ok(!ids.includes(byTitle(seed, "Write launch page copy").id), "already linked");
});
test("link then unlink restores state", () => {
  const a = byTitle(seed, "Build usage metering API");
  const b = byTitle(seed, "Nightly ledger reconciliation job");
  const linked = ok(d.linkDependency(seed, ctx, a.id, b.id)).data;
  assert.ok(linked.tasks.find((t) => t.id === a.id)!.blockedBy.includes(b.id));
  const unlinked = ok(d.unlinkDependency(linked, ctx, a.id, b.id)).data;
  assert.ok(!unlinked.tasks.find((t) => t.id === a.id)!.blockedBy.includes(b.id));
});

console.log("On hold and Blocked");
test("hold then resume", () => {
  const t = byTitle(seed, "Write holiday email nurture sequence");
  const held = ok(d.holdTask(seed, ctx, t.id, "Waiting on budget")).data;
  const idx = indexTasks(held.tasks);
  assert.equal(getEffectiveState(held.tasks.find((x) => x.id === t.id)!, idx), "on_hold");
  assert.equal(held.tasks.find((x) => x.id === t.id)!.status, "todo", "hold doesn't change workflow status");
  bad(d.holdTask(held, ctx, t.id, ""), /already on hold/);
  const resumed = ok(d.resumeTask(held, ctx, t.id)).data;
  assert.equal(getEffectiveState(resumed.tasks.find((x) => x.id === t.id)!, indexTasks(resumed.tasks)), "active");
});
test("backlog and done tasks can't be held or blocked", () => {
  bad(d.holdTask(seed, ctx, byTitle(seed, "Shortlist influencer partners").id, "x"), /backlog/i);
  bad(d.markBlocked(seed, ctx, byTitle(seed, "Shortlist influencer partners").id, { reason: "x" }), /backlog/i);
  bad(d.holdTask(seed, ctx, byTitle(seed, "Approve Aurora pricing tiers").id, "x"), /done/i);
});
test("manual blocker: needs a reason or a dependency; hold and blocker don't coexist", () => {
  const t = byTitle(seed, "Create landing page variants");
  bad(d.markBlocked(seed, ctx, t.id, {}), /reason|link/i);
  const blocked = ok(d.markBlocked(seed, ctx, t.id, { reason: "Waiting on legal" })).data;
  const bt = blocked.tasks.find((x) => x.id === t.id)!;
  assert.equal(getEffectiveState(bt, indexTasks(blocked.tasks)), "blocked");
  bad(d.holdTask(blocked, ctx, t.id, "pause"), /blocker/i);
  const held = byTitle(seed, "Safety review of the conveyor changeover");
  bad(d.markBlocked(seed, ctx, held.id, { reason: "x" }), /on hold/i);
});
test("blocker with a linked dependency and a reason shows both", () => {
  const t = byTitle(seed, "Nightly ledger reconciliation job");
  const dep = byTitle(seed, "Build usage metering API");
  const r = ok(d.markBlocked(seed, ctx, t.id, { reason: "Needs schema sign-off", dependencyId: dep.id })).data;
  const nt = r.tasks.find((x) => x.id === t.id)!;
  assert.deepEqual(nt.blockedBy, [dep.id]);
  assert.ok(nt.blocker);
});
test("resolving one of two blockers keeps the task blocked; resolving all unblocks", () => {
  const t = byTitle(seed, "Nightly ledger reconciliation job");
  const dep = byTitle(seed, "Build usage metering API");
  const two = ok(d.markBlocked(seed, ctx, t.id, { reason: "Needs schema sign-off", dependencyId: dep.id })).data;
  const one = ok(d.resolveBlocker(two, ctx, t.id, { kind: "manual" }));
  assert.match(one.message!, /still has another/);
  assert.equal(getEffectiveState(one.data.tasks.find((x) => x.id === t.id)!, indexTasks(one.data.tasks)), "blocked");
  const none = ok(d.resolveBlocker(two, ctx, t.id, { kind: "all" }));
  assert.equal(getEffectiveState(none.data.tasks.find((x) => x.id === t.id)!, indexTasks(none.data.tasks)), "active");
  bad(d.resolveBlocker(none.data, ctx, t.id, { kind: "all" }), /nothing to resolve/i);
});

console.log("Backlog");
test("activating a backlog task updates the same record everywhere", () => {
  const t = byTitle(seed, "Draft press kit");
  assert.equal(t.stage, "backlog");
  bad(d.setStatus(seed, ctx, t.id, "in_progress"), /backlog/i);
  const r = ok(d.activateTask(seed, ctx, t.id, "in_progress")).data;
  const after = r.tasks.find((x) => x.id === t.id)!;
  assert.equal(after.stage, "active");
  assert.equal(after.status, "in_progress");
  assert.equal(r.tasks.length, seed.tasks.length, "no duplicate record");
  assert.ok(tasksForView(r, indexTasks(r.tasks), "kanban", "all").some((x) => x.id === t.id));
  assert.ok(projectStats(r, t.projectId, today).backlog < projectStats(seed, t.projectId, today).backlog);
});
test("moving back to backlog clears pause and resets status", () => {
  const t = byTitle(seed, "Produce 90-second product demo video");
  const r = ok(d.moveToBacklog(seed, ctx, t.id)).data;
  const after = r.tasks.find((x) => x.id === t.id)!;
  assert.deepEqual([after.stage, after.status, after.hold], ["backlog", "todo", null]);
  bad(d.moveToBacklog(r, ctx, t.id), /already/);
});
test("reordering the backlog swaps ranks", () => {
  const list = seed.tasks.filter((t) => t.stage === "backlog" && !t.parentId).sort((a, b) => a.rank - b.rank);
  const second = list[1];
  const r = ok(d.moveBacklogRank(seed, ctx, second.id, "up")).data;
  const sorted = r.tasks.filter((t) => t.stage === "backlog" && !t.parentId).sort((a, b) => a.rank - b.rank);
  assert.equal(sorted[0].id, second.id);
  assert.equal(ok(d.moveBacklogRank(r, ctx, second.id, "up")).changed, false);
});

console.log("Create, update, delete");
test("title is required; only the title is needed", () => {
  const project = seed.projects[0];
  bad(d.createTask(seed, ctx, { title: "   ", projectId: project.id }), /title/i);
  bad(d.createTask(seed, ctx, { title: "x", projectId: "nope" }), /project/i);
  const r = ok(d.createTask(seed, ctx, { title: "  Quick one  ", projectId: project.id }));
  const t = r.data.tasks.find((x) => x.id === r.value)!;
  assert.deepEqual([t.title, t.status, t.stage, t.priority, t.assigneeId], ["Quick one", "todo", "active", "none", null]);
  const next = ok(d.createTask(r.data, ctx, { title: "Second", projectId: project.id }));
  assert.equal(r.data.tasks.find((x) => x.id === r.value)!.number + 1, next.data.tasks.find((x) => x.id === next.value)!.number);
});
test("creation validates dates, labels, dependencies and subtasks", () => {
  const p = seed.projects[0];
  bad(d.createTask(seed, ctx, { title: "x", projectId: p.id, startDate: "2026-11-05", dueDate: "2026-11-01" }), /before the start/);
  bad(d.createTask(seed, ctx, { title: "x", projectId: p.id, labels: ["Nope"] }), /label/i);
  bad(d.createTask(seed, ctx, { title: "x", projectId: p.id, blockedBy: ["t-missing"] }), /dependency/i);
  const dep = byTitle(seed, "Write launch page copy");
  const r = ok(d.createTask(seed, ctx, { title: "Parent", projectId: p.id, blockedBy: [dep.id], subtasks: ["One", " ", "Two"], status: "backlog" }));
  const parent = r.data.tasks.find((x) => x.id === r.value)!;
  const kids = r.data.tasks.filter((x) => x.parentId === parent.id);
  assert.equal(kids.length, 2);
  assert.ok(kids.every((k) => k.stage === "backlog" && k.status === "todo"));
  assert.equal(getEffectiveState(parent, indexTasks(r.data.tasks)), "backlog", "backlog beats blocked in display");
});
test("subtask progress and nesting rules", () => {
  const parent = byTitle(seed, "Instrument launch funnel events in analytics");
  const subs = seed.tasks.filter((t) => t.parentId === parent.id);
  assert.equal(subs.length, 3);
  const r = ok(d.setStatus(seed, ctx, subs.find((s) => s.status !== "done")!.id, "done")).data;
  assert.equal(r.tasks.filter((t) => t.parentId === parent.id && t.status === "done").length, 2);
  bad(d.addSubtask(seed, ctx, subs[0].id, "nested"), /own subtasks/);
});
test("update validates, diffs and reports no-ops", () => {
  const t = byTitle(seed, "Write holiday email nurture sequence");
  bad(d.updateTask(seed, ctx, t.id, { title: " " }), /title/i);
  bad(d.updateTask(seed, ctx, t.id, { startDate: "2026-12-01", dueDate: "2026-11-01" }), /before the start/);
  assert.equal(ok(d.updateTask(seed, ctx, t.id, { priority: t.priority })).changed, false);
  const r = ok(d.updateTask(seed, ctx, t.id, { priority: "urgent", dueDate: "2026-10-30" }));
  assert.ok(r.data.activity.some((a) => a.taskId === t.id && /changed priority/.test(a.text)));
  assert.ok(r.data.activity.some((a) => a.taskId === t.id && /due date/.test(a.text)));
});
test("changing a due date changes overdue status in metrics", () => {
  const t = byTitle(seed, "Triage beta feedback");
  const before = homeMetrics(seed, "me", today).overdue.map((x) => x.id);
  assert.ok(before.includes(t.id));
  const r = ok(d.updateTask(seed, ctx, t.id, { dueDate: "2026-11-05" })).data;
  assert.ok(!homeMetrics(r, "me", today).overdue.some((x) => x.id === t.id));
});
test("assigning notifies the assignee, not yourself", () => {
  const t = byTitle(seed, "Publish help center articles");
  const r = ok(d.updateTask(seed, ctx, t.id, { assigneeId: "u-hannah" })).data;
  assert.ok(r.notifications.some((n) => n.userId === "u-hannah" && n.type === "assigned" && n.taskId === t.id));
  const self = ok(d.updateTask(seed, ctx, t.id, { assigneeId: me })).data;
  assert.ok(!self.notifications.some((n) => n.userId === me && n.taskId === t.id && n.type === "assigned"));
});
test("comments mention teammates", () => {
  const t = byTitle(seed, "Publish help center articles");
  bad(d.addComment(seed, ctx, t.id, "   "), /something/);
  const r = ok(d.addComment(seed, ctx, t.id, "Thanks @Arjun, looping in @hannah too")).data;
  assert.equal(r.notifications.filter((n) => n.type === "mention" && n.taskId === t.id).length, 2);
});
test("duplicate creates an independent copy with subtasks", () => {
  const t = byTitle(seed, "Instrument launch funnel events in analytics");
  const r = ok(d.duplicateTask(seed, ctx, t.id));
  const copy = r.data.tasks.find((x) => x.id === r.value)!;
  assert.equal(copy.title, `${t.title} (copy)`);
  assert.equal(copy.status, "todo");
  assert.equal(r.data.tasks.filter((x) => x.parentId === copy.id).length, 3);
});
test("delete removes children, notifications and links; undo restores them", () => {
  const dep = byTitle(seed, "Build usage metering API");
  const dependents = seed.tasks.filter((t) => t.blockedBy.includes(dep.id));
  assert.ok(dependents.length >= 2);
  const del = ok(d.deleteTask(seed, ctx, dep.id));
  assert.ok(!del.data.tasks.some((t) => t.id === dep.id));
  assert.ok(del.data.tasks.every((t) => !t.blockedBy.includes(dep.id)), "dangling links removed");
  const back = ok(d.restoreDeleted(del.data, del.value!));
  assert.equal(back.data.tasks.length, seed.tasks.length);
  for (const t of dependents) assert.ok(back.data.tasks.find((x) => x.id === t.id)!.blockedBy.includes(dep.id));
  const parent = byTitle(seed, "Instrument launch funnel events in analytics");
  const delParent = ok(d.deleteTask(seed, ctx, parent.id)).data;
  assert.equal(delParent.tasks.length, seed.tasks.length - 4, "parent plus three subtasks");
});

console.log("Projects and templates");
test("project validation and stats", () => {
  bad(d.createProject(seed, ctx, { name: " ", ownerId: me }), /name/i);
  bad(d.createProject(seed, ctx, { name: "aurora launch", ownerId: me }), /already exists/);
  bad(d.createProject(seed, ctx, { name: "New", ownerId: me, startDate: "2026-11-02", targetDate: "2026-11-01" }), /target/i);
  const r = ok(d.createProject(seed, ctx, { name: "Customer Portal", ownerId: me }));
  const p = r.data.projects.find((x) => x.id === r.value)!;
  assert.match(p.key, /^[A-Z0-9]{2,}$/);
  assert.equal(new Set(r.data.projects.map((x) => x.key)).size, r.data.projects.length);
  const aur = seed.projects[0];
  const s = projectStats(seed, aur.id, today);
  assert.equal(s.total, topLevel(seed.tasks).filter((t) => t.projectId === aur.id).length);
  assert.ok(s.progress > 0 && s.progress < 100 && s.overdue >= 1 && s.blocked >= 1);
});
test("template creates a project through the shared creation path", () => {
  for (const id of ["tpl-product-launch", "tpl-design-project", "tpl-marketing-campaign"]) {
    const r = ok(d.createProjectFromTemplate(seed, ctx, id, { name: `From ${id}`, ownerId: me, startDate: today }));
    const tasks = r.data.tasks.filter((t) => t.projectId === r.value);
    assert.ok(tasks.length >= 8);
    assert.ok(tasks.some((t) => t.blockedBy.length > 0), "dependencies wired");
    assert.ok(tasks.filter((t) => !t.parentId).every((t) => t.dueDate! >= today));
    assert.ok(tasks.some((t) => t.parentId), "subtasks created");
  }
  bad(d.createProjectFromTemplate(seed, ctx, "tpl-product-launch", { name: "", ownerId: me, startDate: today }), /name/i);
  const t = ok(d.createTaskFromTemplate(seed, ctx, "tpl-marketing-campaign", { projectId: seed.projects[0].id }));
  assert.ok(t.data.tasks.filter((x) => x.parentId === t.value).length >= 3);
});

console.log("Notifications and search");
test("read and mark-all-read", () => {
  const unread = seed.notifications.filter((n) => n.userId === me && !n.read);
  assert.ok(unread.length >= 3);
  const one = ok(d.markNotificationRead(seed, unread[0].id)).data;
  assert.equal(one.notifications.filter((n) => n.userId === me && !n.read).length, unread.length - 1);
  assert.equal(ok(d.markNotificationRead(one, unread[0].id)).changed, false);
  const all = ok(d.markAllNotificationsRead(one, me)).data;
  assert.equal(all.notifications.filter((n) => n.userId === me && !n.read).length, 0);
  assert.equal(all.notifications.filter((n) => n.userId !== me && !n.read).length, seed.notifications.filter((n) => n.userId !== me && !n.read).length);
});
test("deadline sync is idempotent", () => {
  const first = d.syncDeadlineNotifications(seed, ctx, today);
  assert.ok(first.ok && !first.changed, "seed already synced");
  const moved = ok(d.updateTask(seed, ctx, byTitle(seed, "Plan production cutover").id, { dueDate: "2026-10-28" })).data;
  const sync = ok(d.syncDeadlineNotifications(moved, ctx, today));
  assert.equal(sync.changed, true);
  assert.equal(ok(d.syncDeadlineNotifications(sync.data, ctx, today)).changed, false);
});
test("every simulated teammate event makes a real change", () => {
  for (const kind of ["assigned", "mention", "updated", "deadline"] as const) {
    const r = ok(d.simulateTeammateEvent(seed, ctx, kind, today));
    const added = r.data.notifications.filter((n) => !seed.notifications.some((s) => s.id === n.id) && n.userId === me);
    assert.ok(added.length >= 1, `${kind} produced a notification`);
    assert.notDeepEqual(r.data.tasks, seed.tasks, `${kind} changed task data`);
  }
});
test("search covers ids, titles, descriptions and projects; filters narrow", () => {
  const key = byTitle(seed, "Build usage metering API").key;
  assert.equal(searchAll(seed, key, {}, today).tasks[0].key, key);
  assert.ok(searchAll(seed, "metering", {}, today).tasks.length >= 1);
  assert.ok(searchAll(seed, "okta", {}, today).tasks.some((t) => /SSO/.test(t.title)), "description match");
  const proj = searchAll(seed, "warehouse", {}, today);
  assert.equal(proj.projects.length, 1);
  assert.ok(proj.tasks.length >= 5, "tasks in a matching project are found by project name");
  assert.equal(searchAll(seed, "zzzqqq", {}, today).tasks.length, 0);
  const narrowed = searchAll(seed, "", { priority: "urgent", status: "in_progress" }, today).tasks;
  assert.ok(narrowed.length >= 2 && narrowed.every((t) => t.priority === "urgent" && t.status === "in_progress"));
  assert.ok(searchAll(seed, "", { status: "backlog" }, today).tasks.every((t) => t.stage === "backlog"));
});

console.log(`\n${passed} checks passed${process.exitCode ? " (with failures above)" : ""}`);
