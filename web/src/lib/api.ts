export interface StatusResponse {
  configured: boolean;
  running: boolean;
  port: number;
  uptime: string;
  agents: AgentInfo[];
  channels: ChannelInfo[];
  provider: ProviderInfo;
}

export interface AgentInfo {
  id: string;
  model: string;
  workspace: string;
}

export interface ChannelInfo {
  type: string;
  botUsername: string;
}

export interface ProviderInfo {
  name: string;
  model: string;
  apiBase: string;
  apiKey: string;
}

export async function getStatus(): Promise<StatusResponse> {
  const res = await fetch("/api/status");
  return res.json();
}

export async function testProvider(config: { apiBase: string; apiKey: string; model: string }) {
  const res = await fetch("/api/test-provider", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function saveConfig(config: Record<string, unknown>) {
  const res = await fetch("/api/save-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(config),
  });
  return res.json();
}

export async function getConfig() {
  const res = await fetch("/api/config");
  return res.json();
}

export async function sendChat(agentId: string, message: string): Promise<{ response: string }> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agentId, message }),
  });
  return res.json();
}
