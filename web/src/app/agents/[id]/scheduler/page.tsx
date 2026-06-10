"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  Trash2,
  Repeat,
  Calendar,
  Hourglass,
  MessageSquare,
  Plus,
} from "lucide-react";
import {
  listAgentCronJobs,
  deleteAgentCronJob,
  toggleAgentCronJob,
  createAgentCronJob,
  getChatSessions,
  type AgentCronJob,
  type ChatSessionEntry,
} from "@/lib/api";
import { useAgentIdFromURL } from "@/hooks/use-agent-id";
import { useAgentName } from "@/hooks/use-agent-name";

// Scheduler page: lists every cron job the agent has on file. The
// `create_cron_job` tool the agent itself uses writes here, so anything
// you said in chat ("每分钟讲笑话", "5 分钟后提醒我睡觉") shows up as a
// row. Disable to pause without losing the job; delete to remove it.

function fmtSchedule(job: AgentCronJob): string {
  switch (job.type) {
    case "interval":
      return `every ${job.schedule}`;
    case "once":
      return `at ${job.schedule}`;
    case "cron":
    default:
      return job.schedule;
  }
}

function fmtRelative(iso?: string): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = t - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60_000);
  if (mins < 1) return diff > 0 ? "in <1m" : "just now";
  if (mins < 60) return diff > 0 ? `in ${mins}m` : `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return diff > 0 ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.round(hours / 24);
  return diff > 0 ? `in ${days}d` : `${days}d ago`;
}

function typeIcon(type: string) {
  switch (type) {
    case "interval":
      return <Repeat className="h-3.5 w-3.5" />;
    case "once":
      return <Hourglass className="h-3.5 w-3.5" />;
    case "cron":
    default:
      return <Calendar className="h-3.5 w-3.5" />;
  }
}

export default function AgentSchedulerPage() {
  const agentId = useAgentIdFromURL();
  const agentName = useAgentName(agentId);

  const [jobs, setJobs] = useState<AgentCronJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  // Delivery targets for new tasks — the agent's existing conversations.
  // Loaded with the jobs so the create dialog has them ready on open.
  const [sessions, setSessions] = useState<ChatSessionEntry[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<AgentCronJob | null>(null);
  // Track in-flight toggles by job id so the row reflects optimistic
  // state and the switch doesn't double-fire while the request is open.
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const refresh = useCallback(() => {
    if (!agentId) return;
    setLoading(true);
    listAgentCronJobs(agentId)
      .then((list) => {
        setJobs(list);
        setError("");
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load jobs"))
      .finally(() => setLoading(false));
    getChatSessions(agentId)
      .then((list) => setSessions(list))
      .catch(() => setSessions([]));
  }, [agentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleToggle = async (job: AgentCronJob, enabled: boolean) => {
    if (!agentId || toggling[job.id]) return;
    setToggling((m) => ({ ...m, [job.id]: true }));
    // Optimistic update — flip immediately, server is authoritative on
    // refresh. Reverts on failure.
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, enabled } : j)),
    );
    const res = await toggleAgentCronJob(agentId, job.id, enabled);
    setToggling((m) => {
      const { [job.id]: _drop, ...rest } = m;
      void _drop;
      return rest;
    });
    if (res.error || !res.ok) {
      setError(res.error || "Failed to update job");
      // Revert by refetching the canonical state.
      refresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !agentId) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    const res = await deleteAgentCronJob(agentId, target.id);
    if (res.error) setError(res.error);
    refresh();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-muted-foreground" />
            <h2 className="text-2xl font-semibold tracking-tight">Scheduler</h2>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Scheduled tasks for <strong>{agentName || "this agent"}</strong>.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <Plus className="size-4" />
          New Task
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/50 p-10 text-center">
          <Clock className="mx-auto size-8 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            No scheduled tasks yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              busy={!!toggling[job.id]}
              onToggle={(enabled) => handleToggle(job, enabled)}
              onDelete={() => setDeleteTarget(job)}
            />
          ))}
        </div>
      )}

      {agentId && (
        <CreateTaskDialog
          agentId={agentId}
          open={createOpen}
          onOpenChange={setCreateOpen}
          sessions={sessions}
          onCreated={refresh}
        />
      )}

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete scheduled task</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget?.name || deleteTarget?.id}</strong>?
              This stops future runs and can&apos;t be undone. Existing chat
              history is preserved.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function JobRow({
  job,
  busy,
  onToggle,
  onDelete,
}: {
  job: AgentCronJob;
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium truncate">{job.name || job.id}</span>
            <Badge
              variant="outline"
              className="inline-flex items-center gap-1 text-[10px]"
            >
              {typeIcon(job.type)}
              {job.type}
            </Badge>
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">
              {fmtSchedule(job)}
            </code>
            {job.channel && (
              <span className="text-[11px] text-muted-foreground">
                via {job.channel}
              </span>
            )}
          </div>
          <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <MessageSquare className="size-3.5 mt-0.5 shrink-0" />
            <span className="break-words">{job.message}</span>
          </div>
          <div className="flex gap-4 text-[11px] text-muted-foreground/80">
            <span>
              Last run:{" "}
              <span className="font-mono">{fmtRelative(job.lastRun)}</span>
            </span>
            <span>
              Next run:{" "}
              <span className="font-mono">{fmtRelative(job.nextRun)}</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Switch
            checked={job.enabled}
            disabled={busy}
            onCheckedChange={(v) => onToggle(v)}
            aria-label={job.enabled ? "Disable" : "Enable"}
          />
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={onDelete}
            title="Delete"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

const SCHEDULE_HINT: Record<string, { placeholder: string; help: string }> = {
  cron: {
    placeholder: "0 9 * * *",
    help: "5-field cron expression in your timezone. e.g. 0 9 * * * = every day 09:00.",
  },
  interval: {
    placeholder: "30m",
    help: "Fixed period: 30m, 2h, 90m. Fires repeatedly at that interval.",
  },
  once: {
    placeholder: "2026-06-15T09:00:00",
    help: "One-shot ISO datetime in your timezone. Must be in the future.",
  },
};

// sessionTarget maps a chat session to the (channel, chatId) the
// scheduler delivers onto. Web sessions route by the session key
// (channel "web"); IM threads route by their own channel + chat id.
function sessionTarget(s: ChatSessionEntry): {
  channel: string;
  chatId: string;
  accountId?: string;
} {
  const channel = s.channel || "web";
  if (channel === "web") {
    return { channel: "web", chatId: s.id };
  }
  return { channel, chatId: s.chatId || s.id, accountId: s.accountId };
}

function sessionLabel(s: ChatSessionEntry): string {
  const channel = s.channel || "web";
  const name = s.title || s.preview || s.chatId || s.id;
  return `${channel} · ${name}`;
}

function CreateTaskDialog({
  agentId,
  open,
  onOpenChange,
  sessions,
  onCreated,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  sessions: ChatSessionEntry[];
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("cron");
  const [schedule, setSchedule] = useState("");
  const [message, setMessage] = useState("");
  const [targetId, setTargetId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  const reset = () => {
    setName("");
    setType("cron");
    setSchedule("");
    setMessage("");
    setTargetId("");
    setErr("");
  };

  // Reset fields on dismiss in the handler (not an effect) so closing
  // the dialog leaves a clean form for next time.
  const handleOpenChange = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const hint = SCHEDULE_HINT[type] ?? SCHEDULE_HINT.cron;
  const canSubmit =
    !!name.trim() &&
    !!schedule.trim() &&
    !!message.trim() &&
    !!targetId &&
    !submitting;

  const submit = async () => {
    const target = sessions.find((s) => s.id === targetId);
    if (!target) return;
    setSubmitting(true);
    setErr("");
    const { channel, chatId, accountId } = sessionTarget(target);
    const res = await createAgentCronJob(agentId, {
      name: name.trim(),
      type,
      schedule: schedule.trim(),
      message: message.trim(),
      channel,
      chatId,
      accountId,
    });
    setSubmitting(false);
    if (res.error || !res.ok) {
      setErr(res.error || "Failed to create task");
      return;
    }
    handleOpenChange(false);
    onCreated();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New scheduled task</DialogTitle>
          <DialogDescription>
            Runs on a schedule and delivers the message to the agent as a
            fresh prompt on the chosen conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-name">Name</Label>
            <Input
              id="task-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Daily standup reminder"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? "cron")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cron">cron (recurring calendar)</SelectItem>
                <SelectItem value="interval">interval (fixed period)</SelectItem>
                <SelectItem value="once">once (one-shot)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-schedule">Schedule</Label>
            <Input
              id="task-schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder={hint.placeholder}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">{hint.help}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-message">Message</Label>
            <Textarea
              id="task-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Remind the team to post their standup updates."
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Deliver to</Label>
            {sessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No conversations yet — start a chat with this agent first, then
                come back to schedule a task delivered there.
              </p>
            ) : (
              <Select value={targetId} onValueChange={(v) => setTargetId(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a conversation" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {sessionLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {err && <p className="text-sm text-destructive">{err}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            {submitting ? "Creating…" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
