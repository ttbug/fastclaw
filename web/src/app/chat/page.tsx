"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getStatus, sendChat, type AgentInfo } from "@/lib/api";
import { Bot, Send, Copy, Check, SquarePen } from "lucide-react";

interface ChatMessage {
  id: string;
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

export default function ChatPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    getStatus()
      .then((status) => {
        if (status.agents?.length > 0) {
          setAgents(status.agents);
          setSelectedAgent(status.agents[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedAgent || sending) return;

    setInput("");
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const result = await sendChat(selectedAgent, text);
      const agentMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: "agent",
        content: result.response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: `e-${Date.now()}`,
        role: "agent",
        content: "Failed to get a response. Is the gateway running?",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [input, selectedAgent, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleNewChat = () => {
    setMessages([]);
  };

  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const currentAgent = agents.find((a) => a.id === selectedAgent);

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen">
      {/* Agent sidebar */}
      <div className="hidden w-56 flex-col border-r border-border bg-card/30 lg:flex">
        <div className="flex items-center justify-between border-b border-border p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Agents
          </p>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => {
                setSelectedAgent(agent.id);
                setMessages([]);
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                selectedAgent === agent.id
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="truncate">{agent.id}</span>
            </button>
          ))}
          {agents.length === 0 && (
            <p className="px-3 py-4 text-xs text-muted-foreground/60">
              No agents available
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex h-12 items-center justify-between border-b border-border px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold">
              {selectedAgent || "Select an agent"}
            </span>
            {currentAgent && (
              <Badge variant="secondary" className="font-mono text-[10px]">
                {currentAgent.model}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile agent select */}
            {agents.length > 1 && (
              <select
                value={selectedAgent}
                onChange={(e) => {
                  setSelectedAgent(e.target.value);
                  setMessages([]);
                }}
                className="rounded-md border border-border bg-card px-2 py-1 text-sm lg:hidden"
              >
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.id}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={handleNewChat}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="New Chat"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                  <Bot className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium mb-1">
                  Chat with {selectedAgent || "your agent"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Send a message to start a conversation
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`group relative max-w-[80%] ${
                    msg.role === "user" ? "order-1" : ""
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2.5 ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted rounded-bl-md"
                    }`}
                  >
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">
                      {msg.content}
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-1.5 mt-1 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span className="text-[10px] text-muted-foreground/60">
                      {formatTime(msg.timestamp)}
                    </span>
                    {msg.role === "agent" && (
                      <button
                        onClick={() => handleCopy(msg)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-muted text-muted-foreground/60 hover:text-muted-foreground transition-all"
                        title="Copy"
                      >
                        {copiedId === msg.id ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="typing-dot inline-block h-2 w-2 rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
                    <span className="typing-dot inline-block h-2 w-2 rounded-full bg-muted-foreground/60" style={{ animationDelay: "200ms" }} />
                    <span className="typing-dot inline-block h-2 w-2 rounded-full bg-muted-foreground/60" style={{ animationDelay: "400ms" }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pb-6 pt-2">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-4 py-3 focus-within:ring-2 focus-within:ring-ring/20 transition-shadow">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  selectedAgent
                    ? `Message ${selectedAgent}...`
                    : "Select an agent first"
                }
                disabled={!selectedAgent || sending}
                rows={1}
                className="flex-1 resize-none bg-transparent text-[15px] placeholder:text-muted-foreground/50 outline-none disabled:opacity-50"
                style={{ maxHeight: 200, minHeight: 24 }}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || !selectedAgent || sending}
                size="icon"
                className="h-8 w-8 shrink-0 rounded-lg"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
