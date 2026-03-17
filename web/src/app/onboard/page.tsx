"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { testProvider, saveConfig } from "@/lib/api";

const PROVIDERS: Record<string, { apiBase: string; models: string[] }> = {
  openai: {
    apiBase: "https://api.openai.com/v1",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  openrouter: {
    apiBase: "https://openrouter.ai/api/v1",
    models: [
      "openai/gpt-4o",
      "anthropic/claude-3.5-sonnet",
      "google/gemini-pro-1.5",
    ],
  },
  deepseek: {
    apiBase: "https://api.deepseek.com/v1",
    models: ["deepseek-chat", "deepseek-coder"],
  },
  groq: {
    apiBase: "https://api.groq.com/openai/v1",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
  },
  ollama: {
    apiBase: "http://localhost:11434/v1",
    models: ["llama3", "mistral", "codellama"],
  },
  custom: { apiBase: "", models: [] },
};

interface OnboardConfig {
  provider: string;
  apiBase: string;
  apiKey: string;
  model: string;
  telegramEnabled: boolean;
  telegramToken: string;
  port: number;
  agentName: string;
  personality: string;
}

const STEP_LABELS = [
  "Welcome",
  "LLM Provider",
  "Channels",
  "Gateway",
  "Launch",
];

function ConfettiEffect() {
  const colors = [
    "#8b5cf6",
    "#06b6d4",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#ec4899",
    "#6366f1",
  ];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 8,
    rotation: Math.random() * 360,
  }));

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            backgroundColor: p.color,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: p.id % 3 === 0 ? "50%" : "2px",
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<OnboardConfig>({
    provider: "openai",
    apiBase: "https://api.openai.com/v1",
    apiKey: "",
    model: "gpt-4o",
    telegramEnabled: true,
    telegramToken: "",
    port: 18953,
    agentName: "FastClaw Agent",
    personality:
      "You are a helpful, friendly AI assistant. You respond concisely and accurately.",
  });
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "success" | "error"
  >("idle");
  const [testError, setTestError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [jsonExpanded, setJsonExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updateConfig = useCallback(
    (updates: Partial<OnboardConfig>) => {
      setConfig((prev) => ({ ...prev, ...updates }));
    },
    []
  );

  const handleProviderChange = useCallback(
    (provider: string | null) => {
      if (!provider) return;
      const preset = PROVIDERS[provider];
      updateConfig({
        provider,
        apiBase: preset.apiBase,
        model: preset.models[0] || "",
      });
      setTestStatus("idle");
    },
    [updateConfig]
  );

  const handleTestConnection = useCallback(async () => {
    setTestStatus("testing");
    setTestError("");
    try {
      const result = await testProvider({
        apiBase: config.apiBase,
        apiKey: config.apiKey,
        model: config.model,
      });
      if (result.ok) {
        setTestStatus("success");
      } else {
        setTestStatus("error");
        setTestError(result.error || "Connection failed");
      }
    } catch {
      setTestStatus("error");
      setTestError("Could not reach the server. Is FastClaw running?");
    }
  }, [config.apiBase, config.apiKey, config.model]);

  const handleLaunch = useCallback(async () => {
    try {
      await saveConfig(config as unknown as Record<string, unknown>);
      setShowConfetti(true);
      setLaunched(true);
      setTimeout(() => setShowConfetti(false), 4000);
      setTimeout(() => router.push("/overview/"), 2000);
    } catch {
      setLaunched(true);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }
  }, [config, router]);

  const canProceed = useCallback(() => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return config.apiBase.length > 0 && config.model.length > 0;
      case 2:
        return true;
      case 3:
        return config.agentName.length > 0 && config.port > 0;
      case 4:
        return true;
      default:
        return false;
    }
  }, [step, config]);

  if (!mounted) return null;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      {showConfetti && <ConfettiEffect />}

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-[40%] left-1/2 h-[800px] w-[800px] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mb-10 flex items-center gap-2">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all duration-300 ${
                i === step
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110"
                  : i < step
                    ? "bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer"
                    : "bg-muted text-muted-foreground"
              }`}
              disabled={i > step}
            >
              {i < step ? (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : (
                i + 1
              )}
            </button>
            {i < STEP_LABELS.length - 1 && (
              <div
                className={`hidden h-px w-8 sm:block ${
                  i < step ? "bg-primary/40" : "bg-border"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <p className="relative mb-6 text-sm font-medium tracking-wide text-muted-foreground uppercase">
        {STEP_LABELS[step]}
      </p>

      <div className="relative w-full max-w-lg animate-fade-in-up" key={step}>
        {step === 0 && (
          <Card className="backdrop-blur-sm">
            <CardHeader className="space-y-6 pb-4 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-500 shadow-lg shadow-violet-500/20">
                <svg
                  className="h-8 w-8 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                  />
                </svg>
              </div>
              <div>
                <CardTitle className="text-3xl font-bold">
                  <span className="animate-gradient-text bg-gradient-to-r from-violet-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
                    FastClaw
                  </span>
                </CardTitle>
                <CardDescription className="mt-3 text-base">
                  AI Agent Framework
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 text-center">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Set up your AI agent in a few simple steps. Configure your LLM
                provider, connect messaging channels, and launch your agent.
              </p>
              <Separator />
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-violet-500">6+</p>
                  <p className="text-xs text-muted-foreground">LLM Providers</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-cyan-500">Multi</p>
                  <p className="text-xs text-muted-foreground">Agent Support</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-emerald-500">MCP</p>
                  <p className="text-xs text-muted-foreground">Tool Protocol</p>
                </div>
              </div>
              <Button
                onClick={() => setStep(1)}
                className="w-full"
                size="lg"
              >
                Get Started
                <svg
                  className="ml-2 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card className="backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">LLM Provider</CardTitle>
              <CardDescription>
                Choose your AI model provider and configure the connection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Select
                  value={config.provider}
                  onValueChange={handleProviderChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PROVIDERS).map((p) => (
                      <SelectItem key={p} value={p}>
                        <span className="capitalize">{p}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>API Base URL</Label>
                <Input
                  value={config.apiBase}
                  onChange={(e) => updateConfig({ apiBase: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => updateConfig({ apiKey: e.target.value })}
                  placeholder={
                    config.provider === "ollama"
                      ? "Not required for Ollama"
                      : "sk-..."
                  }
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Model</Label>
                {PROVIDERS[config.provider]?.models.length > 0 ? (
                  <Select
                    value={config.model}
                    onValueChange={(v: string | null) => v && updateConfig({ model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS[config.provider].models.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={config.model}
                    onChange={(e) => updateConfig({ model: e.target.value })}
                    placeholder="Enter model name"
                    className="font-mono text-sm"
                  />
                )}
              </div>

              <Separator />

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={testStatus === "testing"}
                >
                  {testStatus === "testing" ? (
                    <>
                      <svg
                        className="mr-2 h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Testing...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>
                {testStatus === "success" && (
                  <Badge
                    variant="outline"
                    className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  >
                    Connected
                  </Badge>
                )}
                {testStatus === "error" && (
                  <Badge
                    variant="outline"
                    className="bg-destructive/10 text-destructive border-destructive/20"
                  >
                    {testError || "Failed"}
                  </Badge>
                )}
              </div>

              <NavigationButtons
                step={step}
                setStep={setStep}
                canProceed={canProceed()}
              />
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Channels</CardTitle>
              <CardDescription>
                Connect messaging platforms to your agent.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
                      <svg
                        className="h-5 w-5 text-blue-500"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                      >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium">Telegram</p>
                      <p className="text-xs text-muted-foreground">
                        Connect via Bot API
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={
                      config.telegramEnabled
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                        : ""
                    }
                  >
                    {config.telegramEnabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>

                {config.telegramEnabled && (
                  <div className="mt-4 space-y-2">
                    <Label>Bot Token</Label>
                    <Input
                      type="password"
                      value={config.telegramToken}
                      onChange={(e) =>
                        updateConfig({ telegramToken: e.target.value })
                      }
                      placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Get a token from{" "}
                      <span className="text-primary">@BotFather</span> on
                      Telegram
                    </p>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/50 bg-muted/10 p-4 opacity-50">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                    <svg
                      className="h-5 w-5 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={1.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4.5v15m7.5-7.5h-15"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">More Channels</p>
                    <p className="text-xs text-muted-foreground/60">
                      Discord, Slack, WhatsApp -- coming soon
                    </p>
                  </div>
                </div>
              </div>

              <NavigationButtons
                step={step}
                setStep={setStep}
                canProceed={canProceed()}
              />
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl">Gateway Settings</CardTitle>
              <CardDescription>
                Configure your agent identity and server settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Agent Name</Label>
                <Input
                  value={config.agentName}
                  onChange={(e) =>
                    updateConfig({ agentName: e.target.value })
                  }
                  placeholder="My AI Agent"
                />
              </div>

              <div className="space-y-2">
                <Label>Port</Label>
                <Input
                  type="number"
                  value={config.port}
                  onChange={(e) =>
                    updateConfig({ port: parseInt(e.target.value) || 18953 })
                  }
                  className="font-mono"
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Personality{" "}
                  <span className="text-xs text-muted-foreground">(SOUL.md)</span>
                </Label>
                <Textarea
                  value={config.personality}
                  onChange={(e) =>
                    updateConfig({ personality: e.target.value })
                  }
                  rows={5}
                  placeholder="Describe your agent's personality, tone, and behavior..."
                  className="text-sm resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  This defines how your agent communicates and behaves.
                </p>
              </div>

              <NavigationButtons
                step={step}
                setStep={setStep}
                canProceed={canProceed()}
              />
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="backdrop-blur-sm animate-pulse-glow">
            <CardHeader>
              <CardTitle className="text-xl">
                {launched ? "You're All Set!" : "Review & Launch"}
              </CardTitle>
              <CardDescription>
                {launched
                  ? "FastClaw is now configured and ready to go."
                  : "Review your configuration before launching."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {launched ? (
                <div className="space-y-4 text-center py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20">
                    <svg
                      className="h-8 w-8 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <p className="text-lg font-medium">
                    Configuration saved successfully
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Redirecting to dashboard...
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <SummaryRow
                      label="Provider"
                      value={config.provider}
                      capitalize
                    />
                    <SummaryRow label="Model" value={config.model} mono />
                    <SummaryRow label="API Base" value={config.apiBase} mono />
                    <SummaryRow
                      label="API Key"
                      value={config.apiKey ? "********" : "Not set"}
                    />
                    <Separator />
                    <SummaryRow
                      label="Telegram"
                      value={
                        config.telegramEnabled
                          ? config.telegramToken
                            ? "Configured"
                            : "Enabled (no token)"
                          : "Disabled"
                      }
                    />
                    <Separator />
                    <SummaryRow label="Agent Name" value={config.agentName} />
                    <SummaryRow
                      label="Port"
                      value={String(config.port)}
                      mono
                    />
                  </div>

                  <button
                    onClick={() => setJsonExpanded(!jsonExpanded)}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <span>JSON Preview</span>
                    <svg
                      className={`h-4 w-4 transition-transform ${jsonExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  {jsonExpanded && (
                    <pre className="max-h-64 overflow-auto rounded-lg border border-border bg-background p-4 font-mono text-xs text-muted-foreground">
                      {JSON.stringify(config, null, 2)}
                    </pre>
                  )}

                  <Button
                    onClick={handleLaunch}
                    className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:from-violet-700 hover:to-cyan-700 transition-all"
                    size="lg"
                  >
                    Launch FastClaw
                    <svg
                      className="ml-2 h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.58-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"
                      />
                    </svg>
                  </Button>

                  <NavigationButtons
                    step={step}
                    setStep={setStep}
                    canProceed={canProceed()}
                    hidNext
                  />
                </>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <p className="relative mt-8 text-xs text-muted-foreground/50">
        FastClaw Agent Framework
      </p>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

function NavigationButtons({
  step,
  setStep,
  canProceed,
  hidNext,
}: {
  step: number;
  setStep: (s: number) => void;
  canProceed: boolean;
  hidNext?: boolean;
}) {
  return (
    <div className="flex items-center justify-between pt-2">
      <Button
        variant="ghost"
        onClick={() => setStep(step - 1)}
        disabled={step === 0}
      >
        <svg
          className="mr-1 h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11 17l-5-5m0 0l5-5m-5 5h12"
          />
        </svg>
        Back
      </Button>
      {!hidNext && (
        <Button
          onClick={() => setStep(step + 1)}
          disabled={!canProceed}
        >
          Next
          <svg
            className="ml-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </Button>
      )}
    </div>
  );
}
