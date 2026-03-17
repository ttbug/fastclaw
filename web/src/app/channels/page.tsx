"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Radio, MessageCircle, Hash, Send } from "lucide-react";
import { getChannels, type ChannelInfo } from "@/lib/api";

const channelIcons: Record<string, React.ElementType> = {
  telegram: Send,
  discord: Hash,
  slack: MessageCircle,
};

const channelColors: Record<string, string> = {
  telegram: "from-blue-500 to-blue-600",
  discord: "from-indigo-500 to-indigo-600",
  slack: "from-green-500 to-green-600",
};

export default function ChannelsPage() {
  const [channels, setChannels] = useState<ChannelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [editChannel, setEditChannel] = useState<ChannelInfo | null>(null);

  const fetchChannels = () => {
    setLoading(true);
    getChannels()
      .then(setChannels)
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChannels();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Channels</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Manage messaging platform connections
        </p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 bg-zinc-800" />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 mb-4">
              <Radio className="h-7 w-7 text-blue-400" />
            </div>
            <p className="text-sm text-zinc-400 mb-1">No channels configured</p>
            <p className="text-xs text-zinc-600">
              Configure channels in Settings or fastclaw.json
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel, i) => {
            const Icon = channelIcons[channel.type] || Radio;
            const gradient = channelColors[channel.type] || "from-zinc-500 to-zinc-600";
            const isConnected = channel.enabled !== false && channel.status !== "disconnected";

            return (
              <Card
                key={i}
                className="border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-colors cursor-pointer group"
                onClick={() => setEditChannel(channel)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <Badge
                      className={
                        isConnected
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-600/30"
                          : "bg-zinc-600/20 text-zinc-400 border-zinc-600/30"
                      }
                    >
                      <span
                        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${
                          isConnected ? "bg-emerald-400" : "bg-zinc-500"
                        }`}
                      />
                      {isConnected ? "Connected" : "Disconnected"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base text-zinc-200 capitalize mb-1">
                    {channel.type}
                  </CardTitle>
                  <CardDescription className="text-zinc-500 text-sm">
                    {channel.botUsername
                      ? `@${channel.botUsername}`
                      : "Click to configure"}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Channel Config Dialog */}
      <Dialog open={!!editChannel} onOpenChange={() => setEditChannel(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-200">
          <DialogHeader>
            <DialogTitle className="capitalize">
              {editChannel?.type} Configuration
            </DialogTitle>
            <DialogDescription className="text-zinc-500">
              Update channel connection settings
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-zinc-400">Bot Token</Label>
              <Input
                type="password"
                defaultValue="••••••••••••"
                className="border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono"
              />
            </div>
            {editChannel?.botUsername && (
              <div className="space-y-2">
                <Label className="text-zinc-400">Bot Username</Label>
                <Input
                  value={editChannel.botUsername}
                  disabled
                  className="border-zinc-700 bg-zinc-800/30 text-zinc-500"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditChannel(null)}
              className="border-zinc-700 text-zinc-400"
            >
              Cancel
            </Button>
            <Button className="bg-violet-600 hover:bg-violet-700 text-white">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
