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
import { Bot, Plus, Pencil, Trash2, FolderOpen } from "lucide-react";
import { getAgents, createAgent, updateAgent, deleteAgent, type AgentDetail } from "@/lib/api";

const models = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "claude-sonnet-4-6",
  "claude-haiku-4-5-20251001",
  "deepseek-chat",
  "deepseek-reasoner",
  "llama-3.1-70b",
  "qwen-2.5-72b",
];

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [editAgent, setEditAgent] = useState<AgentDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Create form
  const [newName, setNewName] = useState("");
  const [newModel, setNewModel] = useState("gpt-4o");
  const [newSoul, setNewSoul] = useState("");

  // Edit form
  const [editModel, setEditModel] = useState("");
  const [editSoul, setEditSoul] = useState("");

  const fetchAgents = () => {
    setLoading(true);
    getAgents()
      .then(setAgents)
      .catch(() => setAgents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    await createAgent({ id: newName.trim(), model: newModel, soul: newSoul });
    setCreateOpen(false);
    setNewName("");
    setNewModel("gpt-4o");
    setNewSoul("");
    setSaving(false);
    fetchAgents();
  };

  const handleEdit = (agent: AgentDetail) => {
    setEditAgent(agent);
    setEditModel(agent.model);
    setEditSoul(agent.soul || "");
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!editAgent) return;
    setSaving(true);
    await updateAgent(editAgent.id, { model: editModel, soul: editSoul });
    setEditOpen(false);
    setSaving(false);
    fetchAgents();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteAgent(deleteId);
    setDeleteId(null);
    fetchAgents();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Agents</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage your AI agents and their configurations
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-violet-600 hover:bg-violet-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Agent
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-400" />
            Agent List
          </CardTitle>
          <CardDescription className="text-zinc-500">
            {agents.length} agent{agents.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-zinc-800" />
              ))}
            </div>
          ) : agents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
                <Bot className="h-7 w-7 text-violet-400" />
              </div>
              <p className="text-sm text-zinc-400">No agents configured yet</p>
              <Button
                onClick={() => setCreateOpen(true)}
                variant="outline"
                className="mt-4 border-zinc-700 text-zinc-300"
              >
                Create your first agent
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Name</TableHead>
                  <TableHead className="text-zinc-500">Model</TableHead>
                  <TableHead className="text-zinc-500">Workspace</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow
                    key={agent.id}
                    className="border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                    onClick={() => handleEdit(agent)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10">
                          <Bot className="h-4 w-4 text-violet-400" />
                        </div>
                        <span className="font-medium text-zinc-200">
                          {agent.id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-zinc-400">
                        {agent.model}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-zinc-500">
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span className="text-xs font-mono truncate max-w-48">
                          {agent.workspace}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                        Active
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(agent);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-red-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteId(agent.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
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
            <DialogTitle>Create New Agent</DialogTitle>
            <DialogDescription className="text-zinc-500">
              Configure a new AI agent for your gateway
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-400">Agent Name</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="my-agent"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Model</Label>
              <Select value={newModel} onValueChange={(v) => v && setNewModel(v)}>
                <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-700">
                  {models.map((m) => (
                    <SelectItem key={m} value={m} className="text-zinc-200">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Personality (SOUL.md)</Label>
              <Textarea
                value={newSoul}
                onChange={(e) => setNewSoul(e.target.value)}
                placeholder="You are a helpful AI assistant..."
                rows={4}
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
              disabled={!newName.trim() || saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Creating..." : "Create Agent"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              {editAgent?.id}
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Edit agent configuration
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Model</Label>
                <Select value={editModel} onValueChange={(v) => v && setEditModel(v)}>
                  <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {models.map((m) => (
                      <SelectItem key={m} value={m} className="text-zinc-200">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Workspace</Label>
                <Input
                  value={editAgent?.workspace || ""}
                  disabled
                  className="border-zinc-700 bg-zinc-800/30 text-zinc-500 font-mono text-xs"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Personality (SOUL.md)</Label>
              <Textarea
                value={editSoul}
                onChange={(e) => setEditSoul(e.target.value)}
                placeholder="Your personality and behavioral guidelines..."
                rows={8}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 resize-none font-mono text-sm"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              className="border-zinc-700 text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-200">Delete Agent</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              Are you sure you want to delete <strong className="text-zinc-300">{deleteId}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-400">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
