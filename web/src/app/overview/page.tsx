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
  Clock,
  Puzzle,
  ArrowRight,
  Settings,
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
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Monitor your FastClaw gateway
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchStatus}
          className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Status
            </CardTitle>
            <Activity className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  status?.running
                    ? "bg-emerald-500 animate-pulse"
                    : "bg-zinc-600"
                }`}
              />
              <span className="text-xl font-bold text-zinc-100">
                {status?.running ? "Running" : "Stopped"}
              </span>
            </div>
            {status?.uptime && (
              <p className="text-xs text-zinc-500 mt-1">
                Uptime: {status.uptime}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Agents
            </CardTitle>
            <Bot className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold text-zinc-100">
              {status?.agents?.length || 0}
            </span>
            <p className="text-xs text-zinc-500 mt-1">Active agents</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Channels
            </CardTitle>
            <Radio className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold text-zinc-100">
              {status?.channels?.length || 0}
            </span>
            <p className="text-xs text-zinc-500 mt-1">Connected</p>
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">
              Port
            </CardTitle>
            <Server className="h-4 w-4 text-zinc-500" />
          </CardHeader>
          <CardContent>
            <span className="text-xl font-bold font-mono text-zinc-100">
              {status?.port || "\u2014"}
            </span>
            <p className="text-xs text-zinc-500 mt-1">Gateway port</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 md:grid-cols-3">
        <Link href="/chat/">
          <Card className="border-zinc-800 bg-zinc-900/80 hover:border-violet-600/40 hover:bg-zinc-800/80 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600/10 group-hover:bg-violet-600/20 transition-colors">
                <MessageSquare className="h-5 w-5 text-violet-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">Chat</p>
                <p className="text-xs text-zinc-500">
                  Talk to your agents
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/agents/">
          <Card className="border-zinc-800 bg-zinc-900/80 hover:border-violet-600/40 hover:bg-zinc-800/80 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600/10 group-hover:bg-blue-600/20 transition-colors">
                <Bot className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">Agents</p>
                <p className="text-xs text-zinc-500">
                  Manage agent configs
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>

        <Link href="/settings/">
          <Card className="border-zinc-800 bg-zinc-900/80 hover:border-violet-600/40 hover:bg-zinc-800/80 transition-all cursor-pointer group">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-600/10 group-hover:bg-amber-600/20 transition-colors">
                <Settings className="h-5 w-5 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-200">Settings</p>
                <p className="text-xs text-zinc-500">
                  Gateway configuration
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition-colors" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Agents & Provider */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Agents */}
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              Agents
            </CardTitle>
            <CardDescription className="text-zinc-500">
              Configured AI agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.agents && status.agents.length > 0 ? (
              <div className="space-y-2">
                {status.agents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 p-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
                        <Bot className="h-4 w-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {agent.id}
                        </p>
                        <p className="text-xs text-zinc-500 font-mono">
                          {agent.model}
                        </p>
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

        {/* Provider */}
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
