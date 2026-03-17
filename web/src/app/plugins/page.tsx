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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Puzzle, Download, Settings } from "lucide-react";
import { getPlugins, updatePlugin, type PluginInfo } from "@/lib/api";

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<PluginInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editPlugin, setEditPlugin] = useState<PluginInfo | null>(null);
  const [configJson, setConfigJson] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchPlugins = () => {
    setLoading(true);
    getPlugins()
      .then(setPlugins)
      .catch(() => setPlugins([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const handleToggle = async (plugin: PluginInfo) => {
    await updatePlugin(plugin.id, { enabled: !plugin.enabled });
    fetchPlugins();
  };

  const handleOpenConfig = (plugin: PluginInfo) => {
    setEditPlugin(plugin);
    setConfigJson(JSON.stringify(plugin.config || {}, null, 2));
  };

  const handleSaveConfig = async () => {
    if (!editPlugin) return;
    setSaving(true);
    try {
      const config = JSON.parse(configJson);
      await updatePlugin(editPlugin.id, { config });
    } catch {
      // invalid JSON
    }
    setSaving(false);
    setEditPlugin(null);
    fetchPlugins();
  };

  const statusColor = (status: string) => {
    if (status === "running") return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30";
    if (status === "stopped") return "bg-zinc-600/20 text-zinc-400 border-zinc-600/30";
    return "bg-amber-600/20 text-amber-400 border-amber-600/30";
  };

  const typeColor = (type: string) => {
    const colors: Record<string, string> = {
      channel: "bg-blue-600/20 text-blue-400 border-blue-600/30",
      tool: "bg-violet-600/20 text-violet-400 border-violet-600/30",
      provider: "bg-amber-600/20 text-amber-400 border-amber-600/30",
      hook: "bg-cyan-600/20 text-cyan-400 border-cyan-600/30",
    };
    return colors[type] || "bg-zinc-600/20 text-zinc-400 border-zinc-600/30";
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Plugins</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Extend FastClaw with custom plugins
          </p>
        </div>
        <Button
          variant="outline"
          className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300"
        >
          <Download className="h-4 w-4 mr-2" />
          Install Plugin
        </Button>
      </div>

      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-violet-400" />
            Installed Plugins
          </CardTitle>
          <CardDescription className="text-zinc-500">
            {plugins.length} plugin{plugins.length !== 1 ? "s" : ""} installed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full bg-zinc-800" />
              ))}
            </div>
          ) : plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
                <Puzzle className="h-7 w-7 text-violet-400" />
              </div>
              <p className="text-sm text-zinc-400">No plugins installed</p>
              <p className="text-xs text-zinc-600 mt-1">
                Plugins add channels, tools, and providers
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-zinc-800 hover:bg-transparent">
                  <TableHead className="text-zinc-500">Plugin</TableHead>
                  <TableHead className="text-zinc-500">Type</TableHead>
                  <TableHead className="text-zinc-500">Version</TableHead>
                  <TableHead className="text-zinc-500">Status</TableHead>
                  <TableHead className="text-zinc-500">Enabled</TableHead>
                  <TableHead className="text-zinc-500 text-right">Config</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plugins.map((plugin) => (
                  <TableRow
                    key={plugin.id}
                    className="border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10">
                          <Puzzle className="h-4 w-4 text-violet-400" />
                        </div>
                        <span className="font-medium text-zinc-200">{plugin.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColor(plugin.type)}>
                        {plugin.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-zinc-500">
                        {plugin.version || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColor(plugin.status)}>
                        {plugin.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={plugin.enabled}
                        onCheckedChange={() => handleToggle(plugin)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-zinc-500 hover:text-zinc-200"
                        onClick={() => handleOpenConfig(plugin)}
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Config Editor Dialog */}
      <Dialog open={!!editPlugin} onOpenChange={() => setEditPlugin(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-violet-400" />
              {editPlugin?.id} Configuration
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Edit plugin configuration as JSON
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-zinc-400">Config JSON</Label>
            <Textarea
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              rows={12}
              className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditPlugin(null)}
              className="border-zinc-700 text-zinc-400"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveConfig}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Saving..." : "Save Config"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
