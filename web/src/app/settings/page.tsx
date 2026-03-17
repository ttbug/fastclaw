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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Brain, Database, Webhook, Save, Check } from "lucide-react";
import { getConfig, updateConfig, type ConfigResponse } from "@/lib/api";

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Form state
  const [providerName, setProviderName] = useState("default");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [storageType, setStorageType] = useState("file");
  const [dsn, setDsn] = useState("");
  const [webhookEnabled, setWebhookEnabled] = useState(false);
  const [webhookToken, setWebhookToken] = useState("");
  const [webhookPath, setWebhookPath] = useState("/hooks");

  useEffect(() => {
    setLoading(true);
    getConfig()
      .then((cfg) => {
        setConfig(cfg);
        // Populate form
        const providers = cfg.providers || {};
        const firstKey = Object.keys(providers)[0] || "default";
        setProviderName(firstKey);
        setApiBase(providers[firstKey]?.apiBase || "");
        setApiKey(providers[firstKey]?.apiKey || "");
        setModel(cfg.agents?.defaults?.model || "gpt-4o");
        setStorageType(cfg.storage?.type || "file");
        setDsn(cfg.storage?.dsn || "");
        setWebhookEnabled(cfg.hooks?.enabled || false);
        setWebhookToken(cfg.hooks?.token || "");
        setWebhookPath(cfg.hooks?.path || "/hooks");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await updateConfig({
      providers: {
        [providerName]: { apiBase, apiKey },
      },
      agents: {
        defaults: { model },
      },
      storage: { type: storageType, dsn },
      hooks: {
        enabled: webhookEnabled,
        token: webhookToken,
        path: webhookPath,
      },
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-48 bg-zinc-800" />
        <Skeleton className="h-64 w-full bg-zinc-800" />
        <Skeleton className="h-48 w-full bg-zinc-800" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Gateway configuration
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className={saved ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4 mr-2" />
              Saved
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Settings"}
            </>
          )}
        </Button>
      </div>

      {/* Provider Config */}
      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-amber-400" />
            LLM Provider
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Configure your language model provider
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-zinc-400">API Base URL</Label>
              <Input
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
                placeholder="https://api.openai.com/v1"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-zinc-400">Model</Label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-400">API Key</Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
            />
            <p className="text-[11px] text-zinc-600">
              {config?.providers?.[providerName]?.apiKey
                ? `Current: ${config.providers[providerName].apiKey}`
                : "Not set"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Storage Config */}
      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-400" />
            Storage
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Configure data persistence backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-400">Storage Type</Label>
            <Select value={storageType} onValueChange={(v) => v && setStorageType(v)}>
              <SelectTrigger className="border-zinc-700 bg-zinc-800/50 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                <SelectItem value="file" className="text-zinc-200">File System</SelectItem>
                <SelectItem value="sqlite" className="text-zinc-200">SQLite</SelectItem>
                <SelectItem value="postgres" className="text-zinc-200">PostgreSQL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {storageType !== "file" && (
            <div className="space-y-2">
              <Label className="text-zinc-400">Connection String (DSN)</Label>
              <Input
                value={dsn}
                onChange={(e) => setDsn(e.target.value)}
                placeholder={storageType === "sqlite" ? "./data.db" : "postgres://user:pass@host:5432/fastclaw"}
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Webhook Config */}
      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Webhook className="h-5 w-5 text-cyan-400" />
                Webhooks
              </CardTitle>
              <CardDescription className="text-zinc-500 mt-1">
                HTTP webhook ingress for external integrations
              </CardDescription>
            </div>
            <Switch
              checked={webhookEnabled}
              onCheckedChange={setWebhookEnabled}
            />
          </div>
        </CardHeader>
        {webhookEnabled && (
          <CardContent className="space-y-4">
            <Separator className="bg-zinc-800" />
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-zinc-400">Webhook Path</Label>
                <Input
                  value={webhookPath}
                  onChange={(e) => setWebhookPath(e.target.value)}
                  placeholder="/hooks"
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-zinc-400">Bearer Token</Label>
                <Input
                  type="password"
                  value={webhookToken}
                  onChange={(e) => setWebhookToken(e.target.value)}
                  placeholder="secret-token"
                  className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono text-sm"
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
