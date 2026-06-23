import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, AlertCircle, Users, CheckCheck,
  RefreshCw, Play, Pause, Square, Clock, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

/* ── Types ────────────────────────────────────────────────────────── */

type BotContact = { jid: string; name: string | null };

type ActiveCampaign = {
  id: number;
  message: string;
  status: "idle" | "running" | "paused";
  total: number;
  sent: number;
  nextSendAt: string | null;
  delaySeconds: number;
  estimatedFinishAt: string | null;
  lastSent: { jid: string; name: string | null; sentAt: string } | null;
  createdAt: string;
};

/* ── Helpers ──────────────────────────────────────────────────────── */

function contactLabel(jid: string, name: string | null | undefined): string {
  const phone = jid.replace("@s.whatsapp.net", "");
  return name ? `${name} (${phone})` : phone;
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

function computeDynamicDelay(contactCount: number): number {
  return Math.max(20, Math.floor(172800 / Math.max(contactCount, 1)));
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

  /* ── Mutations ── */
  const createAndStartMutation = useMutation({
    mutationFn: async (payload: { message: string }) => {
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

  const canStart = message.trim().length > 0 && contacts.length > 0 && !isBusy;

  const previewDelay = computeDynamicDelay(contacts.length);

  /* ── Handlers ── */
  function handleStart() {
    if (!canStart) return;
    createAndStartMutation.mutate({ message: message.trim() });
  }

  /* ════════════════════════════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════════════════════════════ */
  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Send className="h-6 w-6 text-green-600" />
          Message Campaign
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Blast a single message to all contacts — delay is calculated automatically to spread sends evenly across 48 hours.
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
            <CardDescription className="text-xs mt-1 line-clamp-2">
              "{campaign!.message}"
            </CardDescription>
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

            {/* Last sent */}
            {campaign!.lastSent && (
              <div className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                <span className="font-medium">Last sent to: </span>
                {contactLabel(campaign!.lastSent.jid, campaign!.lastSent.name)}
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

          {/* Contacts panel */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4" />
                Contacts to blast
              </CardTitle>
            </CardHeader>
            <CardContent>
              {contactsQuery.isLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading contacts from inbox history…
                </div>
              )}

              {contactsQuery.isError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Failed to load contacts
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => contactsQuery.refetch()}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" /> Retry
                  </Button>
                </div>
              )}

              {!contactsQuery.isLoading && !contactsQuery.isError && contacts.length === 0 && (
                <div className="text-sm text-muted-foreground">
                  No individual contacts found in inbox history yet. Contacts appear here once someone messages you on WhatsApp.
                </div>
              )}

              {contacts.length > 0 && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-green-700">
                      <CheckCheck className="h-4 w-4 inline mr-1" />
                      {contacts.length.toLocaleString()} contacts ready
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => contactsQuery.refetch()}
                      disabled={contactsQuery.isFetching}
                    >
                      {contactsQuery.isFetching
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <RefreshCw className="h-3 w-3" />}
                    </Button>
                  </div>

                  {/* Dynamic delay preview */}
                  <div className="mb-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center gap-1.5">
                    <Timer className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      With {contacts.length.toLocaleString()} contacts, gap will be{" "}
                      <span className="font-semibold">{fmtDuration(previewDelay)}</span> between messages
                      {previewDelay === 20 ? " (minimum floor)" : " — spread evenly across 48 h"}.
                    </span>
                  </div>

                  <ScrollArea className="h-40 rounded-md border">
                    <div className="p-2 space-y-0.5">
                      {contacts.slice(0, 100).map((c) => (
                        <div
                          key={c.jid}
                          className="text-xs px-2 py-1 rounded hover:bg-muted/50 truncate"
                        >
                          {contactLabel(c.jid, c.name)}
                        </div>
                      ))}
                      {contacts.length > 100 && (
                        <div className="text-xs px-2 py-1 text-muted-foreground italic">
                          … and {(contacts.length - 100).toLocaleString()} more contacts
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </>
              )}
            </CardContent>
          </Card>

          {/* Message composer */}
          <div className="space-y-2">
            <Label htmlFor="bot-message">Message to send</Label>
            <Textarea
              id="bot-message"
              placeholder="Type your message here. Every contact will receive this exact text."
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
            {contacts.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Sends to {contacts.length.toLocaleString()} contacts with a {fmtDuration(previewDelay)} gap — total campaign duration ~{fmtDuration(contacts.length * previewDelay)}.
              </p>
            )}
          </div>

          {/* Safety notice */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Ban prevention — dynamic 48 h spread</p>
            <p>
              Gap is calculated at start:{" "}
              <code className="font-mono bg-amber-100 px-1 rounded">max(20 s, 172800 s ÷ contacts)</code>.
              Large lists get tens of minutes between sends; small lists use the 20-second floor.
              Pause / resume keeps the same gap throughout the campaign.
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
                Start Campaign — blast {contacts.length.toLocaleString()} contacts
              </>
            )}
          </Button>

          {contacts.length === 0 && !contactsQuery.isLoading && (
            <p className="text-xs text-center text-muted-foreground">
              The button will enable once contacts are loaded from your inbox history.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
