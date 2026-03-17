"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getStatus, sendChat, type AgentInfo } from "@/lib/api";
import { Bot, Send, User, Copy, Check, SquarePen } from "lucide-react";

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

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen">
      {/* Agent sidebar */}
      <div className="hidden w-56 flex-col border-r border-zinc-800 bg-zinc-900/30 lg:flex">
        <div className="flex items-center justify-between border-b border-zinc-800 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
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
                  ? "bg-violet-600/10 text-violet-400"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              }`}
            >
              <Bot className="h-4 w-4 shrink-0" />
              <span className="truncate">{agent.id}</span>
            </button>
          ))}
          {agents.length === 0 && (
            <p className="px-3 py-4 text-xs text-zinc-600">
              No agents available
            </p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col bg-zinc-950">
        {/* Chat header */}
        <div className="flex h-12 items-center justify-between border-b border-zinc-800 px-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600/10">
              <Bot className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <span className="text-sm font-semibold text-zinc-200">
                {selectedAgent || "Select an agent"}
              </span>
              {selectedAgent && (
                <span className="ml-2 text-[11px] text-zinc-500">
                  {agents.find((a) => a.id === selectedAgent)?.model}
                </span>
              )}
            </div>
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
                className="rounded-md border border-zinc-700 bg-zinc-800 px-2 py-1 text-sm text-zinc-200 lg:hidden"
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
              className="flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="New Chat"
            >
              <SquarePen className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto min-h-0 px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-1">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-800/60 mb-4">
                  <Bot className="h-8 w-8 text-zinc-500" />
                </div>
                <p className="text-xl font-semibold text-zinc-300 mb-1">
                  Chat with {selectedAgent || "your agent"}
                </p>
                <p className="text-sm text-zinc-600">
                  Send a message to start a conversation
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className="group flex gap-3.5 py-2 hover:bg-zinc-900/50 -mx-4 px-4 rounded-lg relative"
              >
                <div className="shrink-0 mt-0.5">
                  {msg.role === "user" ? (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-600/15">
                      <User className="h-4 w-4 text-violet-400" />
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800">
                      <Bot className="h-4 w-4 text-zinc-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-semibold text-[15px] ${
                        msg.role === "user"
                          ? "text-violet-400"
                          : "text-zinc-200"
                      }`}
                    >
                      {msg.role === "user" ? "You" : selectedAgent}
                    </span>
                    <span className="text-[11px] text-zinc-600">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>
                  <div className="text-[15px] leading-relaxed text-zinc-300 mt-0.5">
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                </div>

                {/* Hover actions */}
                <div className="absolute right-2 top-2 hidden group-hover:flex items-center gap-0.5 bg-zinc-900 border border-zinc-700 rounded-md shadow-lg p-0.5">
                  <button
                    onClick={() => handleCopy(msg)}
                    className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
                    title="Copy"
                  >
                    {copiedId === msg.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {sending && (
              <div className="flex gap-3.5 py-2 -mx-4 px-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
                <div>
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="font-semibold text-[15px] text-zinc-200">
                      {selectedAgent}
                    </span>
                    <span className="inline-flex gap-1 ml-0.5">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                  <p className="text-[15px] text-zinc-500 italic">
                    Thinking...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 pb-6 pt-2">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 py-3">
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
                className="flex-1 resize-none bg-transparent text-[15px] text-zinc-200 placeholder:text-zinc-600 outline-none disabled:opacity-50"
                style={{ maxHeight: 200, minHeight: 24 }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !selectedAgent || sending}
                className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="text-center text-[11px] text-zinc-700 mt-2">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
