"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { getStatus, sendChat, type AgentInfo } from "@/lib/api";
import { Bot, Send, User } from "lucide-react";

interface ChatMessage {
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
  const scrollRef = useRef<HTMLDivElement>(null);

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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || !selectedAgent || sending) return;

    setInput("");
    const userMsg: ChatMessage = {
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const result = await sendChat(selectedAgent, text);
      const agentMsg: ChatMessage = {
        role: "agent",
        content: result.response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        role: "agent",
        content: "Failed to get a response. Is the gateway running?",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
    }
  }, [input, selectedAgent, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-[calc(100vh-3rem)] md:h-screen">
      {/* Agent sidebar */}
      <div className="hidden w-56 flex-col border-r border-zinc-800 bg-zinc-900/30 lg:flex">
        <div className="border-b border-zinc-800 p-3">
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
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
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
            <p className="px-3 py-4 text-xs text-zinc-600">No agents available</p>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        {/* Chat header */}
        <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-violet-400" />
            <span className="text-sm font-medium text-zinc-200">
              {selectedAgent || "Select an agent"}
            </span>
          </div>

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
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="mx-auto max-w-2xl space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
                  <Bot className="h-8 w-8 text-violet-400" />
                </div>
                <p className="text-lg font-medium text-zinc-300">
                  Start a conversation
                </p>
                <p className="text-sm text-zinc-500 mt-1">
                  Send a message to {selectedAgent || "your agent"}
                </p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "user"
                      ? "bg-violet-600/20"
                      : "bg-zinc-800"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="h-4 w-4 text-violet-400" />
                  ) : (
                    <Bot className="h-4 w-4 text-zinc-400" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-violet-600 text-white"
                      : "bg-zinc-800 text-zinc-200"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                  <Bot className="h-4 w-4 text-zinc-400" />
                </div>
                <div className="rounded-2xl bg-zinc-800 px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "0ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "150ms" }} />
                    <div className="h-2 w-2 animate-bounce rounded-full bg-zinc-500" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-zinc-800 p-4">
          <div className="mx-auto flex max-w-2xl gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedAgent
                  ? "Type a message..."
                  : "Select an agent first"
              }
              disabled={!selectedAgent || sending}
              rows={1}
              className="min-h-[44px] max-h-32 resize-none border-zinc-700 bg-zinc-800/50 text-zinc-200 placeholder:text-zinc-500"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || !selectedAgent || sending}
              className="shrink-0 bg-violet-600 text-white hover:bg-violet-700"
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
