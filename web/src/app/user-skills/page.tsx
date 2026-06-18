"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, Trash2, Download, Search, Loader2, Check, ExternalLink, Info, Upload, Files } from "lucide-react";
import {
  getMySkills,
  deleteMySkill,
  searchSkills,
  installSkill,
  uploadSkill,
  getMe,
  userSkillAgentID,
  type SkillInfo,
  type SkillSearchResult,
} from "@/lib/api";

export default function UserSkillsPage() {
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [installOpen, setInstallOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [myUserID, setMyUserID] = useState<string | null>(null);

  // Per-user target — built once after getMe resolves, then reused for
  // every install/upload so the page doesn't refetch /api/me on every
  // dialog open. Null while loading; dialogs stay disabled until it
  // resolves so a fast click can't fire with no userID.
  const userTarget = useMemo(
    () => (myUserID ? userSkillAgentID(myUserID) : null),
    [myUserID],
  );

  const fetchSkills = () => {
    setLoading(true);
    getMySkills()
      .then(setSkills)
      .catch(() => setSkills([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSkills();
    getMe()
      .then((m) => {
        if (m?.user?.id) setMyUserID(m.user.id);
      })
      .catch(() => {});
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(deleteTarget);
    try {
      await deleteMySkill(deleteTarget);
      setDeleteTarget(null);
      fetchSkills();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Skills</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your personal skills. Available across every agent you chat with.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setUploadOpen(true)}
            disabled={!userTarget}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Skill
          </Button>
          <Button
            onClick={() => setInstallOpen(true)}
            disabled={!userTarget}
          >
            <Download className="h-4 w-4 mr-2" />
            Install Skill
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        <div className="rounded-lg border border-border bg-card">
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground mb-1">
              No personal skills yet
            </p>
            <p className="text-xs text-muted-foreground/60 max-w-sm">
              Install one from skills.sh, upload a .zip, or ask an agent to
              build one with the <code className="font-mono">skill-creator</code> skill.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="group rounded-lg border border-border bg-card p-5 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <p className="text-sm font-medium">{skill.name}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteTarget(skill.name)}
                  title="Remove skill"
                  disabled={deleting === skill.name}
                >
                  {deleting === skill.name ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {skill.description || "No description"}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          Personal skills live in your own bucket and follow you between
          agents. They shadow host-managed skills with the same name, so
          you can customize a skill's behavior for yourself without
          affecting other users.
        </p>
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Skill</AlertDialogTitle>
            <AlertDialogDescription>
              Remove <strong>{deleteTarget}</strong> from your personal skills?
              It will no longer be available to any of your agents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {userTarget && (
        <>
          <InstallSkillDialog
            open={installOpen}
            onOpenChange={setInstallOpen}
            onInstalled={() => {
              setInstallOpen(false);
              fetchSkills();
            }}
            installedNames={new Set(skills.map((s) => s.name))}
            target={userTarget}
          />
          <UploadSkillDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onUploaded={() => {
              setUploadOpen(false);
              fetchSkills();
            }}
            target={userTarget}
          />
        </>
      )}
    </div>
  );
}

function InstallSkillDialog({
  open,
  onOpenChange,
  onInstalled,
  installedNames,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInstalled: () => void;
  installedNames: Set<string>;
  target: string;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SkillSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setInstallError(null);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!open) return;
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(() => {
      searchSkills(query)
        .then((r) => setResults(r))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, open]);

  const visible = useMemo(() => results.slice(0, 20), [results]);

  const handleInstall = async (r: SkillSearchResult) => {
    setInstallError(null);
    setInstallingId(r.id);
    try {
      // `target` is the per-user pseudo agent ID (`_user_<uid>`); the
      // backend routes install + OSS-mirror into the caller's bucket.
      const resp = await installSkill({ source: "skillssh", name: r.skillId, agent: target });
      if (!resp.ok) {
        setInstallError(resp.error || "install failed");
        return;
      }
      onInstalled();
    } catch (e) {
      setInstallError(e instanceof Error ? e.message : "install failed");
    } finally {
      setInstallingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Install Skill</DialogTitle>
          <DialogDescription>
            Search skills.sh for a published skill. Installs land in{" "}
            <code className="font-mono text-xs">~/.fastclaw/users/&lt;you&gt;/skills/</code>{" "}
            and become available to every agent you chat with.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
          <Input
            autoFocus
            placeholder="pdf, translation, web scraping…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="min-h-[240px] max-h-[420px] overflow-y-auto -mx-1 px-1">
          {!query.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Start typing to search skills.sh
              </p>
            </div>
          ) : searching ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground mb-1">
                No skills found on skills.sh for{" "}
                <strong className="text-foreground">{query}</strong>
              </p>
              <p className="text-xs text-muted-foreground/70 max-w-sm">
                Ask one of your agents to build a custom skill with the{" "}
                <code className="font-mono">skill-creator</code> skill.
              </p>
            </div>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mb-1.5 px-1">
                Results from skills.sh
              </p>
              <div className="space-y-1.5 py-1">
                {visible.map((r) => {
                  const already = installedNames.has(r.skillId);
                  const busy = installingId === r.id;
                  const detailUrl = `https://skills.sh/${r.id}`;
                  return (
                    <div
                      key={r.id}
                      className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Sparkles className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">
                            {r.skillId}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {r.installs.toLocaleString()} installs
                          </span>
                        </div>
                        <a
                          href={detailUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono truncate"
                          title={`View on skills.sh: ${r.id}`}
                        >
                          {r.source}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <Button
                        size="sm"
                        variant={already ? "outline" : "default"}
                        disabled={already || busy}
                        onClick={() => handleInstall(r)}
                      >
                        {already ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5" /> Installed</>
                        ) : busy ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Installing…</>
                        ) : (
                          "Install"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {installError && (
          <p className="text-xs text-destructive break-all">{installError}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function UploadSkillDialog({
  open,
  onOpenChange,
  onUploaded,
  target,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUploaded: () => void;
  target: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setFile(null);
      setError(null);
      setDragOver(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const acceptFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (files.length > 1) {
      setError("Please drop only one .zip file at a time.");
      return;
    }
    const f = files[0];
    if (!/\.zip$/i.test(f.name)) {
      setError("File must be a .zip archive.");
      return;
    }
    setFile(f);
    setError(null);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const resp = await uploadSkill(file, target);
      if (!resp.ok) {
        setError(resp.error || "upload failed");
        return;
      }
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload skill</DialogTitle>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip,application/x-zip-compressed"
          className="hidden"
          onChange={(e) => acceptFiles(e.target.files)}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            acceptFiles(e.dataTransfer.files);
          }}
          className={`flex h-48 w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed bg-muted/20 px-6 py-8 text-center transition-colors hover:bg-muted/40 ${
            dragOver ? "border-primary bg-primary/5" : "border-border"
          }`}
        >
          <Files
            className={`h-10 w-10 ${
              file ? "text-primary" : "text-muted-foreground/60"
            }`}
            strokeWidth={1.4}
          />
          {file ? (
            <div className="space-y-1">
              <p className="text-sm font-medium break-all">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB · click to choose a different file
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Drag and drop or click to upload
            </p>
          )}
        </button>

        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive break-words">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={uploading}
          >
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!file || uploading}>
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading…
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}