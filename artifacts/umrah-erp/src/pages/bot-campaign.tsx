import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, AlertCircle, Users, CheckCheck,
  RefreshCw, Play, Pause, Square, Clock, Timer,
  Paperclip, Image, Film, Music, FileText, X, Library,
  ChevronDown, ChevronUp, Search, CheckSquare, Square as SquareIcon,
  ExternalLink, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { MediaLibraryDrawer, type MediaLibraryItem } from "@/components/media-library-drawer";

/* ── Types ────────────────────────────────────────────────────────── */

type BotContact = { jid: string; name: string | null; phone: string | null };

type ActiveCampaignMedia = {
  id: number;
  name: string;
  mimeType: string;
  sizeBytes: number;
};

type ActiveCampaign = {
  id: number;
  message: string;
  status: "idle" | "running" | "paused";
  total: number;
  sent: number;
  nextSendAt: string | null;
  delaySeconds: number;
  estimatedFinishAt: string | null;
  lastSent: { name: string | null; phone: string | null; sentAt: string } | null;
  createdAt: string;
  mediaLibraryId: number | null;
  mediaCaption: string | null;
  media: ActiveCampaignMedia | null;
  recipientMode: "all" | "selected";
};

type CampaignHistoryItem = {
  id: number;
  status: string;
  message: string;
  total: number;
  sent: number;
  recipientMode: "all" | "selected";
  createdAt: string;
  mediaLibraryId: number | null;
  mediaCaption: string | null;
  mediaName: string | null;
  mediaMimeType: string | null;
  mediaSizeBytes: number | null;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Returns a human-readable label. Never exposes raw JIDs. */
function contactLabel(c: { name?: string | null; phone?: string | null }): string {
  if (c.name) return c.phone ? `${c.name} (${c.phone})` : c.name;
  if (c.phone) return c.phone;
  return "Unknown contact";
}

function fmtDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${h}h ${rm}m`;
  }
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

function fmtEta(isoFinish: string): string {
  const diff = new Date(isoFinish).getTime() - Date.now();
  if (diff <= 0) return "finishing soon";
  const totalMin = Math.ceil(diff / 60_000);
  if (totalMin >= 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `~${h}h ${m}m remaining`;
  }
  return `~${totalMin}m remaining`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function computeDynamicDelay(contactCount: number): number {
  return Math.max(20, Math.floor(172800 / Math.max(contactCount, 1)));
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function mimeToType(mimeType: string): "image" | "video" | "audio" | "document" {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    running: "bg-green-100 text-green-800 border-green-200",
    paused:  "bg-yellow-100 text-yellow-800 border-yellow-200",
    done:    "bg-blue-100 text-blue-800 border-blue-200",
    stopped: "bg-gray-100 text-gray-700 border-gray-200",
    idle:    "bg-slate-100 text-slate-700 border-slate-200",
  };
  return map[status] ?? "bg-gray-100 text-gray-700 border-gray-200";
}

function MediaTypeIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn("h-5 w-5", className);
  switch (type) {
    case "image":    return <Image className={cls} />;
    case "video":    return <Film className={cls} />;
    case "audio":    return <Music className={cls} />;
    default:         return <FileText className={cls} />;
  }
}

/* ── Inline media preview (used in active campaign + history) ──── */
function MediaInfoBadge({
  name, mimeType, sizeBytes, caption,
  mediaLibraryId, apiFetchAuth,
}: {
  name: string; mimeType: string; sizeBytes: number;
  caption?: string | null;
  mediaLibraryId: number;
  apiFetchAuth: (path: string, init?: RequestInit) => Promise<Response>;
}) {
  const mediaType = mimeToType(mimeType);
  const isImage = mediaType === "image";

  const previewQuery = useQuery<{ url: string }>({
    queryKey: ["media-preview-url", mediaLibraryId],
    queryFn: () =>
      apiFetchAuth(`/api/media-library/${mediaLibraryId}/download-url`).then((r) => r.json()),
    staleTime: 50 * 60_000,
    enabled: isImage,
  });

  const previewUrl = previewQuery.data?.url;

  return (
    <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
      {isImage && previewUrl ? (
        <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
          <img
            src={previewUrl}
            alt={name}
            className="h-14 w-14 rounded object-cover border hover:opacity-90 transition-opacity"
          />
        </a>
      ) : (
        <div className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
          mediaType === "image" && "bg-blue-100",
          mediaType === "video" && "bg-purple-100",
          mediaType === "audio" && "bg-orange-100",
          mediaType === "document" && "bg-gray-100",
        )}>
          <MediaTypeIcon
            type={mediaType}
            className={cn(
              mediaType === "image" && "text-blue-600",
              mediaType === "video" && "text-purple-600",
              mediaType === "audio" && "text-orange-600",
              mediaType === "document" && "text-gray-600",
            )}
          />
        </div>
      )}
      <div className="flex-1 min-w-0 space-y-0.5">
        <p className="text-sm font-medium truncate">{name}</p>
        <p className="text-xs text-muted-foreground">
          {mediaType} · {formatBytes(sizeBytes)}
        </p>
        {caption && (
          <p className="text-xs text-blue-700 italic">"{caption}"</p>
        )}
      </div>
      {previewUrl && (
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground"
          title="Open file"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

/* ── Page component ───────────────────────────────────────────────── */

export default function BotCampaignPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  function apiFetchAuth(path: string, init?: RequestInit) {
    const hdrs: Record<string, string> = tokenRef.current
      ? { Authorization: `Bearer ${tokenRef.current}` }
      : {};
    return fetch(path, {
      ...init,
      headers: { ...hdrs, ...(init?.headers as Record<string, string> | undefined ?? {}) },
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    });
  }

  /* ── Local state ── */
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [mediaMode, setMediaMode] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaLibraryItem | null>(null);
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaDrawerOpen, setMediaDrawerOpen] = useState(false);

  /* Phase 3 — contact selection */
  const [recipientMode, setRecipientMode] = useState<"all" | "selected">("all");
  const [selectedJids, setSelectedJids] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");

  /* History panel */
  const [historyOpen, setHistoryOpen] = useState(false);

  /* ── Queries ── */
  const activeCampaignQuery = useQuery<ActiveCampaign | null>({
    queryKey: ["bot-campaign-active"],
    queryFn: () => apiFetchAuth("/api/bot/campaign/active").then((r) => r.json()),
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 5_000;
      return d.status === "running" ? 3_000 : 6_000;
    },
    retry: false,
  });

  const contactsQuery = useQuery<BotContact[]>({
    queryKey: ["bot-contacts"],
    queryFn: () => apiFetchAuth("/api/bot/contacts").then((r) => r.json()),
    staleTime: 60_000,
    retry: false,
  });

  const historyQuery = useQuery<CampaignHistoryItem[]>({
    queryKey: ["bot-campaigns-history"],
    queryFn: () => apiFetchAuth("/api/bot/campaigns").then((r) => r.json()),
    enabled: historyOpen,
    staleTime: 30_000,
    retry: false,
  });

  /* ── Mutations ── */
  const createAndStartMutation = useMutation({
    mutationFn: async (payload: {
      message: string;
      mediaLibraryId?: number | null;
      caption?: string | null;
      recipientMode: "all" | "selected";
      contacts?: BotContact[];
    }) => {
      const camp = await apiFetchAuth("/api/bot/campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json() as Promise<{ id: number }>);

      const started = await apiFetchAuth(`/api/bot/campaign/${camp.id}/start`, {
        method: "POST",
      }).then((r) => r.json() as Promise<{ delaySeconds: number }>);

      return started;
    },
    onSuccess: (data) => {
      void activeCampaignQuery.refetch();
      void qc.invalidateQueries({ queryKey: ["bot-campaigns-history"] });
      const delaySec = data?.delaySeconds ?? 20;
      toast({
        title: "Campaign started",
        description: `First message in ${fmtDuration(delaySec)} — one every ${fmtDuration(delaySec)}.`,
      });
    },
    onError: () => toast({ title: "Failed to start campaign", variant: "destructive" }),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetchAuth(`/api/bot/campaign/${id}/pause`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      void activeCampaignQuery.refetch();
      toast({ title: "Campaign paused" });
    },
    onError: () => toast({ title: "Failed to pause", variant: "destructive" }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetchAuth(`/api/bot/campaign/${id}/resume`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      void activeCampaignQuery.refetch();
      const delaySec = activeCampaignQuery.data?.delaySeconds ?? 20;
      toast({
        title: "Campaign resumed",
        description: `Next message in ${fmtDuration(delaySec)}.`,
      });
    },
    onError: () => toast({ title: "Failed to resume", variant: "destructive" }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetchAuth(`/api/bot/campaign/${id}/stop`, { method: "POST" }).then((r) => r.json()),
    onSuccess: () => {
      void activeCampaignQuery.refetch();
      void qc.invalidateQueries({ queryKey: ["bot-campaign-active"] });
      void qc.invalidateQueries({ queryKey: ["bot-campaigns-history"] });
      toast({ title: "Campaign stopped" });
    },
    onError: () => toast({ title: "Failed to stop", variant: "destructive" }),
  });

  /* ── Countdown tick (pure UI — only when running) ── */
  const campaign = activeCampaignQuery.data ?? null;
  const isRunning = campaign?.status === "running";

  useEffect(() => {
    if (!isRunning) return;
    const iv = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(iv);
  }, [isRunning]);

  /* ── Derived values ── */
  const contacts = contactsQuery.data ?? [];
  const isPaused = campaign?.status === "paused";
  const isIdle = campaign?.status === "idle";
  const hasActiveCampaign = campaign !== null;

  const progressPct = campaign
    ? Math.min(100, Math.round((campaign.sent / Math.max(campaign.total, 1)) * 100))
    : 0;

  const countdownSec =
    isRunning && campaign?.nextSendAt
      ? Math.max(0, Math.round((new Date(campaign.nextSendAt).getTime() - now) / 1000))
      : null;

  const isBusy =
    createAndStartMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    stopMutation.isPending;

  const hasContent = mediaMode
    ? !!selectedMedia
    : message.trim().length > 0;

  /* Phase 3 — filtered contact list for "selected" mode */
  const filteredContacts = contactSearch.trim()
    ? contacts.filter((c) => {
        const q = contactSearch.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q)
        );
      })
    : contacts;

  const effectiveContacts =
    recipientMode === "selected"
      ? contacts.filter((c) => selectedJids.has(c.jid))
      : contacts;

  const previewDelay = computeDynamicDelay(effectiveContacts.length);
  const canStart =
    hasContent &&
    effectiveContacts.length > 0 &&
    !isBusy;

  /* ── Handlers ── */
  function handleStart() {
    if (!canStart) return;
    createAndStartMutation.mutate({
      message: message.trim(),
      mediaLibraryId: mediaMode && selectedMedia ? selectedMedia.id : null,
      caption: mediaMode && mediaCaption.trim() ? mediaCaption.trim() : null,
      recipientMode,
      contacts: recipientMode === "selected" ? effectiveContacts : undefined,
    });
  }

  function toggleContact(jid: string) {
    setSelectedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid); else next.add(jid);
      return next;
    });
  }

  function toggleAll() {
    if (selectedJids.size === filteredContacts.length && filteredContacts.length > 0) {
      setSelectedJids(new Set());
    } else {
      setSelectedJids(new Set(filteredContacts.map((c) => c.jid)));
    }
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* ── Media Library Drawer ── */}
      <MediaLibraryDrawer
        open={mediaDrawerOpen}
        onClose={() => setMediaDrawerOpen(false)}
        onSelect={(item) => {
          setSelectedMedia(item);
          setMediaDrawerOpen(false);
        }}
      />

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Send className="h-6 w-6 text-green-600" />
          Message Campaign
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Blast a message to all or selected contacts — delay spread automatically across 48 hours.
        </p>
      </div>

      {/* ── Loading state ── */}
      {activeCampaignQuery.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading campaign status…
        </div>
      )}

      {/* ══════════════════════════════════════════
          ACTIVE CAMPAIGN PANEL
         ══════════════════════════════════════════ */}
      {!activeCampaignQuery.isLoading && hasActiveCampaign && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Campaign in progress</CardTitle>
              {(isRunning || isIdle) && (
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
                  Running
                </Badge>
              )}
              {isPaused && (
                <Badge variant="secondary">
                  <Pause className="h-3 w-3 mr-1" />
                  Paused
                </Badge>
              )}
            </div>

            {/* Recipient mode badge */}
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className="text-xs font-normal">
                <Users className="h-3 w-3 mr-1" />
                {campaign!.recipientMode === "selected" ? "Selected contacts" : "All contacts"}
              </Badge>
            </div>

            {/* Media preview (replaces static "Media attachment included") */}
            {campaign!.media && (
              <div className="mt-2">
                <MediaInfoBadge
                  name={campaign!.media.name}
                  mimeType={campaign!.media.mimeType}
                  sizeBytes={campaign!.media.sizeBytes}
                  caption={campaign!.mediaCaption}
                  mediaLibraryId={campaign!.media.id}
                  apiFetchAuth={apiFetchAuth}
                />
              </div>
            )}

            {campaign!.message && (
              <CardDescription className="text-xs mt-1 line-clamp-2">
                "{campaign!.message}"
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="font-medium">
                  {campaign!.sent} of {campaign!.total} contacts sent
                </span>
                <span className="text-muted-foreground">{progressPct}%</span>
              </div>
              <Progress value={progressPct} className="h-2" />
              {campaign!.estimatedFinishAt && isRunning && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {fmtEta(campaign!.estimatedFinishAt)}
                </p>
              )}
            </div>

            {/* Delay info */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>
                One message every{" "}
                <span className="font-semibold text-foreground">
                  {fmtDuration(campaign!.delaySeconds)}
                </span>
                {" "}— {campaign!.total} contacts spread across 48 h max
              </span>
            </div>

            {/* Countdown */}
            {isRunning && countdownSec !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Next message in{" "}
                <span className={cn(
                  "font-mono font-semibold tabular-nums",
                  countdownSec <= 10 ? "text-orange-600" : "text-foreground",
                )}>
                  {fmtDuration(countdownSec)}
                </span>
              </div>
            )}

            {isPaused && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Pause className="h-4 w-4" />
                Paused at contact {campaign!.sent + 1} of {campaign!.total} — resumes with {fmtDuration(campaign!.delaySeconds)} gap
              </div>
            )}

            {/* Last sent — human-readable, no JID */}
            {campaign!.lastSent && (
              <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                <span className="font-medium">Last sent to: </span>
                {contactLabel(campaign!.lastSent)}
              </div>
            )}

            <Separator />

            {/* Controls */}
            <div className="flex gap-2">
              {(isRunning || isIdle) && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  onClick={() => pauseMutation.mutate(campaign!.id)}
                >
                  {pauseMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    : <Pause className="h-4 w-4 mr-1" />}
                  Pause
                </Button>
              )}

              {isPaused && (
                <Button
                  variant="default"
                  size="sm"
                  disabled={isBusy}
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => resumeMutation.mutate(campaign!.id)}
                >
                  {resumeMutation.isPending
                    ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                    : <Play className="h-4 w-4 mr-1" />}
                  Resume
                </Button>
              )}

              <Button
                variant="destructive"
                size="sm"
                disabled={isBusy}
                onClick={() => stopMutation.mutate(campaign!.id)}
              >
                {stopMutation.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  : <Square className="h-4 w-4 mr-1" />}
                Stop
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════════════════════════════════
          SETUP FORM (no active campaign)
         ══════════════════════════════════════════ */}
      {!activeCampaignQuery.isLoading && !hasActiveCampaign && (
        <div className="space-y-5">

          {/* ── Contacts panel ── */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Recipients
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contactsQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading contacts…
                </div>
              )}

              {contactsQuery.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load contacts
                  <Button variant="ghost" size="sm" onClick={() => contactsQuery.refetch()}>
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              )}

              {!contactsQuery.isLoading && !contactsQuery.isError && contacts.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No individual contacts found yet. Contacts appear once someone messages you on WhatsApp.
                </div>
              )}

              {contacts.length > 0 && (
                <>
                  {/* ── Recipient mode toggle ── */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setRecipientMode("all"); setSelectedJids(new Set()); }}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                        recipientMode === "all"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      <Users className="h-3 w-3" />
                      All ({contacts.length.toLocaleString()})
                    </button>
                    <button
                      onClick={() => setRecipientMode("selected")}
                      className={cn(
                        "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border transition-colors",
                        recipientMode === "selected"
                          ? "bg-green-600 text-white border-green-600"
                          : "bg-background text-muted-foreground border-border hover:bg-muted",
                      )}
                    >
                      <CheckSquare className="h-3 w-3" />
                      Select contacts
                      {recipientMode === "selected" && selectedJids.size > 0 && (
                        <span className="ml-1 bg-white/25 rounded-full px-1.5">
                          {selectedJids.size}
                        </span>
                      )}
                    </button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => contactsQuery.refetch()}
                      disabled={contactsQuery.isFetching}
                      className="ml-auto"
                    >
                      {contactsQuery.isFetching
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>

                  {/* ── All mode: delay preview + compact list ── */}
                  {recipientMode === "all" && (
                    <>
                      <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5 shrink-0" />
                        <span>
                          With {contacts.length.toLocaleString()} contacts, gap will be{" "}
                          <span className="font-semibold">{fmtDuration(previewDelay)}</span>
                          {previewDelay === 20 ? " (minimum)" : " — spread evenly across 48 h"}.
                        </span>
                      </div>
                      <ScrollArea className="h-36 rounded-md border">
                        <div className="p-2 space-y-0.5">
                          {contacts.slice(0, 100).map((c) => (
                            <div key={c.jid} className="text-xs px-2 py-1 rounded hover:bg-muted/50 truncate">
                              {contactLabel(c)}
                            </div>
                          ))}
                          {contacts.length > 100 && (
                            <div className="text-xs px-2 py-1 text-muted-foreground italic">
                              … and {(contacts.length - 100).toLocaleString()} more
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </>
                  )}

                  {/* ── Selected mode: searchable checklist ── */}
                  {recipientMode === "selected" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                          <Input
                            placeholder="Search by name or phone…"
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="pl-8 h-8 text-xs"
                          />
                        </div>
                        <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs whitespace-nowrap">
                          {selectedJids.size === filteredContacts.length && filteredContacts.length > 0
                            ? "Deselect all"
                            : "Select all"}
                        </Button>
                      </div>

                      {selectedJids.size > 0 && (
                        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-2.5 py-1.5">
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span className="font-medium">{selectedJids.size} contact{selectedJids.size !== 1 ? "s" : ""} selected</span>
                          <button
                            className="ml-auto text-green-600 hover:text-green-800"
                            onClick={() => setSelectedJids(new Set())}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}

                      <ScrollArea className="h-48 rounded-md border">
                        <div className="p-2 space-y-0.5">
                          {filteredContacts.length === 0 ? (
                            <div className="text-xs text-muted-foreground px-2 py-3 text-center">
                              No contacts match your search
                            </div>
                          ) : (
                            filteredContacts.map((c) => {
                              const checked = selectedJids.has(c.jid);
                              return (
                                <button
                                  key={c.jid}
                                  onClick={() => toggleContact(c.jid)}
                                  className={cn(
                                    "w-full flex items-center gap-2.5 text-xs px-2 py-1.5 rounded transition-colors text-left",
                                    checked ? "bg-green-50 text-green-800" : "hover:bg-muted/50",
                                  )}
                                >
                                  {checked
                                    ? <CheckSquare className="h-3.5 w-3.5 shrink-0 text-green-600" />
                                    : <SquareIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                  <span className="truncate">{contactLabel(c)}</span>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </ScrollArea>

                      {recipientMode === "selected" && selectedJids.size === 0 && (
                        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                          Select at least one contact to enable the campaign.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ── Message mode toggle ── */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium">Message mode:</Label>
            <button
              onClick={() => { setMediaMode(false); setSelectedMedia(null); setMediaCaption(""); }}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors",
                !mediaMode ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted",
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              Text only
            </button>
            <button
              onClick={() => setMediaMode(true)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium border transition-colors",
                mediaMode ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted",
              )}
            >
              <Paperclip className="h-3.5 w-3.5" />
              Media + Caption
            </button>
          </div>

          {/* ── Text mode ── */}
          {!mediaMode && (
            <div className="space-y-2">
              <Label htmlFor="bot-message">Message to send</Label>
              <Textarea
                id="bot-message"
                placeholder="Type your message here. Every selected contact will receive this exact text."
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="resize-none"
              />
              {/* WhatsApp-style text preview */}
              {message.trim() && (
                <div className="rounded-lg bg-[#e8f5e9] border border-green-200 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-2">Preview (each contact receives)</p>
                  <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 max-w-[260px] shadow-sm">
                    <p className="text-sm whitespace-pre-wrap break-words text-gray-800">{message.trim()}</p>
                    <p className="text-[10px] text-right text-muted-foreground/70 mt-1">12:00</p>
                  </div>
                </div>
              )}
              {effectiveContacts.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Sends to {effectiveContacts.length.toLocaleString()} contacts · gap {fmtDuration(previewDelay)} · total ~{fmtDuration(effectiveContacts.length * previewDelay)}.
                </p>
              )}
            </div>
          )}

          {/* ── Media + Caption mode ── */}
          {mediaMode && (
            <div className="space-y-3">
              <Label>Attachment</Label>

              {!selectedMedia ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-blue-200 bg-blue-50 py-8">
                  <Library className="h-10 w-10 text-blue-300" />
                  <p className="text-sm text-blue-700 font-medium">No file selected</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-blue-300 text-blue-700 hover:bg-blue-100"
                    onClick={() => setMediaDrawerOpen(true)}
                  >
                    <Library className="h-3.5 w-3.5" />
                    Browse Media Library
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg border bg-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-lg",
                      selectedMedia.mediaType === "image" && "bg-blue-100",
                      selectedMedia.mediaType === "video" && "bg-purple-100",
                      selectedMedia.mediaType === "audio" && "bg-orange-100",
                      selectedMedia.mediaType === "document" && "bg-gray-100",
                    )}>
                      <MediaTypeIcon
                        type={selectedMedia.mediaType}
                        className={cn(
                          selectedMedia.mediaType === "image" && "text-blue-600",
                          selectedMedia.mediaType === "video" && "text-purple-600",
                          selectedMedia.mediaType === "audio" && "text-orange-600",
                          selectedMedia.mediaType === "document" && "text-gray-600",
                        )}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{selectedMedia.originalFilename}</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedMedia.mediaType} · {formatBytes(selectedMedia.sizeBytes)}
                      </p>
                    </div>
                    <button
                      onClick={() => { setSelectedMedia(null); setMediaCaption(""); }}
                      className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="media-caption" className="text-xs">Caption (optional)</Label>
                    <Textarea
                      id="media-caption"
                      placeholder="Add a caption to send with the file…"
                      rows={3}
                      value={mediaCaption}
                      onChange={(e) => setMediaCaption(e.target.value)}
                      className="resize-none text-sm"
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                    onClick={() => setMediaDrawerOpen(true)}
                  >
                    <Library className="h-3.5 w-3.5" />
                    Change file
                  </Button>
                </div>
              )}

              {/* WhatsApp-style send preview */}
              {selectedMedia && (
                <div className="rounded-lg bg-[#e8f5e9] border border-green-200 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-green-700 mb-2">Preview (each contact receives)</p>
                  <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 max-w-[260px] shadow-sm space-y-1.5">
                    <div className={cn(
                      "flex items-center gap-2 rounded px-2 py-1.5 text-xs",
                      "bg-green-700/10",
                    )}>
                      <MediaTypeIcon type={selectedMedia.mediaType} className="h-4 w-4 text-green-700 shrink-0" />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-green-800">{selectedMedia.originalFilename}</p>
                        <p className="text-[10px] text-green-700/70">{selectedMedia.mediaType} · {formatBytes(selectedMedia.sizeBytes)}</p>
                      </div>
                    </div>
                    {mediaCaption && (
                      <p className="text-sm whitespace-pre-wrap break-words text-gray-800">{mediaCaption}</p>
                    )}
                    <p className="text-[10px] text-right text-muted-foreground/70">12:00</p>
                  </div>
                </div>
              )}

              {effectiveContacts.length > 0 && selectedMedia && (
                <p className="text-xs text-muted-foreground">
                  Sends to {effectiveContacts.length.toLocaleString()} contacts · gap {fmtDuration(previewDelay)} · total ~{fmtDuration(effectiveContacts.length * previewDelay)}.
                </p>
              )}
            </div>
          )}

          {/* Safety notice */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Ban prevention — dynamic 48 h spread</p>
            <p>
              Gap is calculated at start:{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">max(20 s, 172800 s ÷ contacts)</code>.
              Large lists get tens of minutes between sends; small lists use the 20-second floor.
            </p>
          </div>

          {/* Start button */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            disabled={!canStart || createAndStartMutation.isPending}
            onClick={handleStart}
          >
            {createAndStartMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Starting campaign…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Start Campaign — {effectiveContacts.length.toLocaleString()} contact{effectiveContacts.length !== 1 ? "s" : ""}
                {recipientMode === "selected" && " (selected)"}
              </>
            )}
          </Button>

          {recipientMode === "selected" && selectedJids.size === 0 && !contactsQuery.isLoading && (
            <p className="text-xs text-center text-muted-foreground">
              Select contacts above to enable the campaign.
            </p>
          )}
          {recipientMode === "all" && contacts.length === 0 && !contactsQuery.isLoading && (
            <p className="text-xs text-center text-muted-foreground">
              The button will enable once contacts are loaded from your inbox history.
            </p>
          )}
          {mediaMode && !selectedMedia && (
            <p className="text-xs text-center text-muted-foreground">
              Select a file from the Media Library to enable the campaign.
            </p>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════
          CAMPAIGN HISTORY PANEL
         ══════════════════════════════════════════ */}
      <Card>
        <CardHeader
          className="pb-3 cursor-pointer select-none"
          onClick={() => setHistoryOpen((o) => !o)}
        >
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              Campaign History
            </CardTitle>
            {historyOpen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </div>
        </CardHeader>

        {historyOpen && (
          <CardContent className="pt-0 space-y-3">
            {historyQuery.isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading history…
              </div>
            )}
            {historyQuery.isError && (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Failed to load history
              </div>
            )}
            {historyQuery.data && historyQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">No campaigns yet.</p>
            )}
            {historyQuery.data && historyQuery.data.length > 0 && (
              <div className="space-y-2">
                {historyQuery.data.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-xs font-medium px-2 py-0.5 rounded-full border",
                        statusBadge(item.status),
                      )}>
                        {item.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(item.createdAt)}
                      </span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {item.sent}/{item.total} sent · {item.recipientMode === "selected" ? "selected" : "all"} contacts
                      </span>
                    </div>

                    {/* Media info in history */}
                    {item.mediaName && item.mediaMimeType && item.mediaSizeBytes && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 rounded px-2.5 py-1.5">
                        <MediaTypeIcon type={mimeToType(item.mediaMimeType)} className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate font-medium text-foreground">{item.mediaName}</span>
                        <span className="shrink-0">{formatBytes(item.mediaSizeBytes)}</span>
                        {item.mediaLibraryId && (
                          <a
                            href="#"
                            onClick={(e) => {
                              e.preventDefault();
                              apiFetchAuth(`/api/media-library/${item.mediaLibraryId}/download-url`)
                                .then((r) => r.json())
                                .then((d: { url: string }) => window.open(d.url, "_blank", "noopener,noreferrer"))
                                .catch(() => {});
                            }}
                            className="ml-auto shrink-0 text-blue-600 hover:text-blue-800"
                            title="Open file"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    )}
                    {item.mediaCaption && (
                      <p className="text-xs text-blue-700 italic px-1">"{item.mediaCaption}"</p>
                    )}

                    {item.message && (
                      <p className="text-xs text-muted-foreground truncate px-1">
                        "{item.message}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        )}
      </Card>

    </div>
  );
}
