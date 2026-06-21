import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Send, Loader2, AlertCircle, Users, CheckCheck,
  RefreshCw, X, Play, Pause, Square, Clock,
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
  lastSent: { jid: string; name: string | null; sentAt: string } | null;
  createdAt: string;
};

/* ── Helper to display a contact's label ──────────────────────────── */
function contactLabel(jid: string, name: string | null | undefined): string {
  const phone = jid.replace("@s.whatsapp.net", "");
  return name ? `${name} (${phone})` : phone;
}

/* ── Page component ───────────────────────────────────────────────── */

export default function BotCampaignPage() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  /* Keep a stable ref to the current token — prevents stale-closure 401s
     in React Query polling callbacks that close over an older value. */
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

      await apiFetchAuth(`/api/bot/campaign/${camp.id}/start`, { method: "POST" });
      return camp;
    },
    onSuccess: () => {
      void activeCampaignQuery.refetch();
      toast({ title: "Campaign started", description: "First message will send in 20–40 seconds." });
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
      toast({ title: "Campaign resumed", description: "Next message in 20–40 seconds." });
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

  /* ── Derived values — ALL declared before JSX ── */
  const contacts = contactsQuery.data ?? [];
  const isPaused = campaign?.status === "paused";
  const isIdle = campaign?.status === "idle";
  const hasActiveCampaign = campaign !== null;

  const progressPct = campaign
    ? Math.min(100, Math.round((campaign.sent / Math.max(campaign.total, 1)) * 100))
    : 0;

  const countdown =
    isRunning && campaign?.nextSendAt
      ? Math.max(0, Math.round((new Date(campaign.nextSendAt).getTime() - now) / 1000))
      : null;

  const isBusy =
    createAndStartMutation.isPending ||
    pauseMutation.isPending ||
    resumeMutation.isPending ||
    stopMutation.isPending;

  const canStart = message.trim().length > 0 && contacts.length > 0 && !isBusy;

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
          Blast a single message to all contacts — one every 20–40 seconds to stay safe.
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
          ACTIVE CAMPAIGN PANEL (running / paused / idle)
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
            </div>

            {/* Countdown */}
            {isRunning && countdown !== null && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Next message in{" "}
                <span className={cn(
                  "font-mono font-semibold tabular-nums",
                  countdown <= 5 ? "text-orange-600" : "text-foreground",
                )}>
                  {countdown}s
                </span>
              </div>
            )}

            {isPaused && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Pause className="h-4 w-4" />
                Paused at contact {campaign!.sent + 1} of {campaign!.total}
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
            <p className="text-xs text-muted-foreground">
              This message will be sent to each contact one at a time, with a random 20–40 second gap between sends.
            </p>
          </div>

          {/* Safety notice */}
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 space-y-1">
            <p className="font-semibold">Ban prevention is active</p>
            <p>Each message is sent with a randomized 20–40 second delay to mimic natural human behaviour. Do not close the server while a campaign is running.</p>
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
                Start Campaign — blast {contacts.length} contacts
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
