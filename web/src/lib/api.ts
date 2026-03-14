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

export async function getStatus() {
  const res = await fetch("/api/status");
  return res.json();
}
