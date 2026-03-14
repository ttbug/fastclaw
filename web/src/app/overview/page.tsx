"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getStatus, type StatusResponse } from "@/lib/api";
import {
  Activity,
  Bot,
  Radio,
  Server,
  Brain,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OverviewPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = () => {
    setLoading(true);
    getStatus()
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Gateway Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitor your FastClaw gateway and agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/chat/">
            <Button
              variant="outline"
              size="sm"
              className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Open Chat
            </Button>
          </Link>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStatus}
            className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Status</CardTitle>
            <Activity className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${status?.running ? "bg-emerald-500 animate-pulse" : "bg-zinc-600"}`} />
              <span className="text-xl font-bold text-zinc-100">
                {status?.running ? "Running" : "Stopped"}
              </span>
            </div>
            {status?.uptime && (
              <p className="text-xs text-zinc-500 mt-1">Uptime: {status.uptime}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Port</CardTitle>
            <Server className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold font-mono text-zinc-100">
              {status?.port || "\u2014"}
            </span>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Agents</CardTitle>
            <Bot className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold text-zinc-100">
              {status?.agents?.length || 0}
            </span>
          </CardContent>
        </Card>
      </div>

      {/* Agents */}
      <Card className="border-zinc-800 bg-zinc-900/80">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-400" />
            Agents
          </CardTitle>
          <CardDescription className="text-zinc-500">
            Configured AI agents and their models
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status?.agents && status.agents.length > 0 ? (
            <div className="space-y-3">
              {status.agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10">
                      <Bot className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{agent.id}</p>
                      <p className="text-xs text-zinc-500 font-mono">{agent.model}</p>
                    </div>
                  </div>
                  <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                    Active
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-500">No agents configured</p>
          )}
        </CardContent>
      </Card>

      {/* Channels & Provider */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Radio className="h-5 w-5 text-cyan-400" />
              Channels
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Connected messaging platforms
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.channels && status.channels.length > 0 ? (
              <div className="space-y-3">
                {status.channels.map((ch, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                        <Radio className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200 capitalize">{ch.type}</p>
                        {ch.botUsername && (
                          <p className="text-xs text-zinc-500">@{ch.botUsername}</p>
                        )}
                      </div>
                    </div>
                    <Badge className="bg-emerald-600/20 text-emerald-400 border-emerald-600/30">
                      Connected
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No channels connected</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-400" />
              Provider
            </CardTitle>
            <CardDescription className="text-zinc-500">
              LLM provider configuration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.provider ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Provider</span>
                  <span className="text-sm text-zinc-200 capitalize">
                    {status.provider.name || "default"}
                  </span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">Model</span>
                  <span className="text-sm text-zinc-200 font-mono">
                    {status.provider.model}
                  </span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">API Base</span>
                  <span className="text-sm text-zinc-200 font-mono truncate max-w-48">
                    {status.provider.apiBase}
                  </span>
                </div>
                <Separator className="bg-zinc-800" />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-zinc-500">API Key</span>
                  <span className="text-sm text-zinc-200 font-mono">
                    {status.provider.apiKey}
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">No provider configured</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
