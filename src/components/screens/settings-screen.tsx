"use client";

import { Page, PageHeader, Section, TwoToneTitle } from "@/components/shell/page";
import { Avatar } from "@/components/ui/avatar";
import { Tag } from "@/components/ui/badges";
import { Button } from "@/components/ui/button";
import { Field, SelectField } from "@/components/ui/fields";
import { useApp, useUi } from "@/lib/app-context";

const SHORTCUTS: [string, string][] = [
  ["C", "Create a task"],
  ["/", "Focus search"],
  ["Esc", "Close dialog or drawer"],
  ["Ctrl or Cmd + Enter", "Submit the create-task form"],
  ["Alt + Arrow keys", "Move a focused Kanban card between columns"],
];

export function SettingsScreen() {
  const { data, me, actions } = useApp();
  const ui = useUi();

  const reset = async (): Promise<void> => {
    const ok = await ui.confirm({
      title: "Reset demo data?",
      body: "All tasks, projects and comments you created or changed will be replaced with the original sample data. This can't be undone.",
      confirmLabel: "Reset data",
      danger: true,
    });
    if (ok) actions.resetDemoData();
  };

  return (
    <Page className="max-w-[760px]">
      <PageHeader title={<TwoToneTitle soft="Your" strong="settings" />} />
      <div className="flex flex-col gap-10">
        <Section title="View as" id="view-as">
          <div className="flex items-end gap-3">
            <Avatar name={me.name} size="lg" />
            <Field label="Current user" hint="There is no sign-in in this MVP. Switch users to see how assignments and My Tasks change." className="flex-1">
              {(p) => (
                <SelectField {...p} value={me.id} onChange={(e) => actions.switchUser(e.target.value)}>
                  {data.users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.role ? `, ${u.role}` : ""}</option>)}
                </SelectField>
              )}
            </Field>
          </div>
        </Section>
        <Section title="Keyboard shortcuts" id="shortcuts">
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            {SHORTCUTS.map(([k, d]) => (
              <div key={k} className="contents">
                <dt><kbd className="rounded-sm border border-line-strong bg-surface px-1.5 py-0.5 text-xs">{k}</kbd></dt>
                <dd>{d}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section title="Data and simulated features" id="data">
          <ul className="mb-4 flex flex-col gap-2 text-sm text-muted">
            <li><Tag tint="lilac">Simulated</Tag> AI task creation uses a local rule-based service, not a live model.</li>
            <li><Tag tint="lilac">Simulated</Tag> Notifications for teammates are generated on demand. No email or push is sent.</li>
            <li>Data is stored in this browser only (localStorage). Other browsers and devices will not see it.</li>
          </ul>
          <Button variant="danger" onClick={() => void reset()}>Reset demo data</Button>
        </Section>
      </div>
    </Page>
  );
}
