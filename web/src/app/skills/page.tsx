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
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, FolderOpen, Trash2, Download } from "lucide-react";
import { getSkills, deleteSkill, type SkillInfo } from "@/lib/api";

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const fetchSkills = () => {
    setLoading(true);
    getSkills()
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSkills();
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteSkill(deleteTarget);
    setDeleteTarget(null);
    fetchSkills();
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Skills</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Installed skills that agents can use
          </p>
        </div>
        <Button
          variant="outline"
          className="border-zinc-700 bg-zinc-800/50 hover:bg-zinc-700 text-zinc-300"
        >
          <Download className="h-4 w-4 mr-2" />
          Install Skill
        </Button>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 bg-zinc-800" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900/80">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-600/10 mb-4">
              <Sparkles className="h-7 w-7 text-violet-400" />
            </div>
            <p className="text-sm text-zinc-400 mb-1">No skills installed</p>
            <p className="text-xs text-zinc-600">
              Skills extend agent capabilities with specialized behaviors
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <Card
              key={skill.name}
              className="border-zinc-800 bg-zinc-900/80 hover:border-zinc-700 transition-colors group"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-600/10">
                      <Sparkles className="h-4 w-4 text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-medium text-zinc-200">
                        {skill.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className="mt-1 text-[10px] border-zinc-700 text-zinc-500"
                      >
                        {skill.type || "skill"}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setDeleteTarget(skill.name)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-zinc-500 text-sm line-clamp-2 mb-3">
                  {skill.description || "No description"}
                </CardDescription>
                <div className="flex items-center gap-1.5 text-zinc-600">
                  <FolderOpen className="h-3 w-3" />
                  <span className="text-[11px] font-mono truncate">
                    {skill.location}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-zinc-900 border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-200">Remove Skill</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-500">
              Remove <strong className="text-zinc-300">{deleteTarget}</strong> from installed skills?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-700 text-zinc-400">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
