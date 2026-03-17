"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, Plus, Trash2 } from "lucide-react";
import {
  getCronJobs,
  createCronJob,
  updateCronJob,
  deleteCronJob,
  getAgents,
  type CronJobInfo,
  type AgentDetail,
} from "@/lib/api";

export default function CronPage() {
  const [jobs, setJobs] = useState<CronJobInfo[]>([]);
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSchedule, setNewSchedule] = useState("");
  const [newType, setNewType] = useState("cron");
  const [newAgentId, setNewAgentId] = useState("");
  const [newMessage, setNewMessage] = useState("");

  const fetchData = () => {
    setLoading(true);
    Promise.all([getCronJobs(), getAgents()])
      .then(([j, a]) => {
        setJobs(j);
        setAgents(a);
      })
      .catch(() => {
        setJobs([]);
        setAgents([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim() || !newSchedule.trim()) return;
    setSaving(true);
    await createCronJob({
      name: newName.trim(),
      type: newType,
      schedule: newSchedule.trim(),
      agentId: newAgentId,
      message: newMessage,
      enabled: true,
    });
    setCreateOpen(false);
    setNewName("");
    setNewSchedule("");
    setNewType("cron");
    setNewAgentId("");
    setNewMessage("");
    setSaving(false);
    fetchData();
  };

  const handleToggle = async (job: CronJobInfo) => {
    await updateCronJob(job.id, { enabled: !job.enabled });
    fetchData();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteCronJob(deleteId);
    setDeleteId(null);
    fetchData();
  };

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      cron: "bg-violet-600/20 text-violet-400 border-violet-600/30",
      interval: "bg-blue-600/20 text-blue-400 border-blue-600/30",
      exact: "bg-amber-600/20 text-amber-400 border-amber-600/30",
    };
    return colors[type] || "bg-zinc-600/20 text-zinc-400 border-zinc-600/30";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Cron Jobs</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Schedule automated agent tasks
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Job
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5 text-violet-400" />
            Scheduled Jobs
          </CardTitle>
          <CardDescription className="text-zinc-500">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-zinc-800" />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
                <Clock className="h-7 w-7 text-violet-400" />
              </div>
              <p className="text-sm text-zinc-400">No cron jobs configured</p>
              <Button
                onClick={() => setCreateOpen(true)}
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300"
              >
                Create your first job
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Name</TableHead>
                  <TableHead className="text-zinc-500">Schedule</TableHead>
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Agent</TableHead>
                  <TableHead className="text-zinc-500">Last Run</TableHead>
                  <TableHead className="text-zinc-500">Enabled</TableHead>
                  <TableHead className="text-zinc-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id} className="border-zinc-800 hover:bg-zinc-800/50 transition-colors">
                    <TableCell>
                      <span className="font-medium text-zinc-200">{job.name}</span>
                    </TableCell>
                    <TableCell>
                      <code className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-300 font-mono">
                        {job.schedule}
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColor(job.type)}>
                        {job.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-zinc-400">{job.agentId || "-"}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-zinc-500">
                        {job.lastRun || "Never"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={job.enabled}
                        onCheckedChange={() => handleToggle(job)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-red-400"
                        onClick={() => setDeleteId(job.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
          <DialogHeader>
            <DialogTitle>Create Cron Job</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Schedule an automated agent task
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-400">Job Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="daily-report"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Type</Label>
                <Select value={newType} onValueChange={(v) => v && setNewType(v)}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    <SelectItem value="cron" className="text-zinc-200">Cron Expression</SelectItem>
                    <SelectItem value="interval" className="text-zinc-200">Interval</SelectItem>
                    <SelectItem value="exact" className="text-zinc-200">Exact Time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Schedule</Label>
                <Input
                  value={newSchedule}
                  onChange={(e) => setNewSchedule(e.target.value)}
                  placeholder={newType === "cron" ? "*/5 * * * *" : newType === "interval" ? "5m" : "14:30"}
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Agent</Label>
              <Select value={newAgentId} onValueChange={(v) => v && setNewAgentId(v)}>
                <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id} className="text-zinc-200">
                      {a.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Message</Label>
              <Textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Generate a daily status report..."
                rows={3}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              className="border-zinc-700 text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!newName.trim() || !newSchedule.trim() || saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Creating..." : "Create Job"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-200">Delete Cron Job</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              Are you sure you want to delete this job? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-400">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
