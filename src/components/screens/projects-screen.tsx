"use client";

import { FolderSimple, Plus, SquaresFour } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ProjectCard, ProjectFormDialog, TemplateDialog } from "@/components/projects/project-parts";
import { Page, PageHeader, TwoToneTitle } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { requestOpenTask, useApp } from "@/lib/app-context";

export function ProjectsScreen() {
  const { data } = useApp();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [templates, setTemplates] = useState(false);
  return (
    <Page>
      <PageHeader
        title={<TwoToneTitle soft="All" strong="projects" />}
        description={`${data.projects.length} projects across the team.`}
        actions={
          <>
            <Button icon={<SquaresFour size={14} />} onClick={() => setTemplates(true)}>Use a template</Button>
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>New project</Button>
          </>
        }
      />
      {data.projects.length === 0 ? (
        <EmptyState icon={<FolderSimple />} title="No projects yet" body="Create a project or start from a template." action={<Button variant="primary" onClick={() => setCreating(true)}>New project</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </ul>
      )}
      {creating ? <ProjectFormDialog open onClose={() => setCreating(false)} onSaved={(id) => id && router.push(`/projects/${id}`)} /> : null}
      {templates ? (
        <TemplateDialog
          open
          onClose={() => setTemplates(false)}
          onCreated={(kind, id) => (kind === "project" ? router.push(`/projects/${id}`) : requestOpenTask(id))}
        />
      ) : null}
    </Page>
  );
}
