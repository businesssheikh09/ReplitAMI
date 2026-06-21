import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, fromUnixTime } from "date-fns";
import {
  MessageSquare, CheckCheck, Link2, Trash2, RefreshCw, ChevronRight,
  Wifi, WifiOff, ScanLine, Loader2, AlertCircle, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import QRCode from "qrcode";

interface InboxGroup {
  group_jid: string;
  group_name: string;
  total: number;
  unread: number;
  last_ts: number;
  last_text: string | null;
  last_sender: string | null;
}

interface Message {
  id: number;
  groupJid: string;
  senderJid: string;
  senderName: string | null;
  text: string;
  waMessageId: string | null;
  timestamp: number;
  isRead: boolean;
  createdAt: string;
}

interface GroupLink {
  id: number;
  groupJid: string;
  entityType: string;
  entityId: number;
  linkedAt: string;
  linkedBy: number | null;
}

const ENTITY_TYPES = [
  { value: "flight_quotation", label: "Flight Quotation" },
  { value: "quotation", label: "Package Quotation" },
  { value: "hotel_request", label: "Hotel Request" },
  { value: "transport_booking", label: "Transport Booking" },
  { value: "invoice", label: "Invoice" },
  { value: "visa_application", label: "Visa Application" },
];

function shortJid(jid: string) {
  return jid.replace(/@.*$/, "");
}

function formatTs(ts: number) {
  const d = fromUnixTime(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return format(d, "HH:mm");
  return format(d, "dd MMM");
}

function apiFetch(path: string, init?: RequestInit) {
  return fetch(path, { credentials: "include", ...init }).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r;
  });
}

export default function WhatsAppInboxPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { token } = useAuth();
  const authHeaders = { Authorization: `Bearer ${token}` };

  // Shadow the module-level apiFetch with an auth-aware version
  // so every useQuery / useMutation call gets the Bearer token automatically.
  // eslint-disable-next-line @typescript-eslint/no-shadow
  function apiFetch(path: string, init?: RequestInit) {
    return fetch(path, {
      ...init,
      headers: { ...authHeaders, ...(init?.headers as Record<string, string> ?? {}) },
    }).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    });
  }

  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkEntityType, setLinkEntityType] = useState("flight_quotation");
  const [linkEntityId, setLinkEntityId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // ── WhatsApp connection state ────────────────────────────────────────────
  const [waStatus, setWaStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/group-tickets/status", { headers: authHeaders });
      if (res.ok) {
        const data = await res.json() as { whatsappStatus: "disconnected" | "connecting" | "connected" };
        setWaStatus(data.whatsappStatus);
      }
    } catch { /* silent */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchQR = useCallback(async () => {
    setQrLoading(true);
    try {
      const res = await fetch("/api/group-tickets/qr", { headers: authHeaders });
      if (!res.ok) { setQrError("Could not reach server."); return; }
      const data = await res.json() as { qr: string | null; status: string };
      if (data.status === "connected") {
        setWaStatus("connected");
        setQrOpen(false);
        toast({ title: "WhatsApp linked!", description: "Your phone is now connected." });
        return;
      }
      if (data.qr) {
        const url = await QRCode.toDataURL(data.qr, { width: 280, margin: 2 });
        setQrDataUrl(url);
        setQrError(null);
      }
    } catch { setQrError("Failed to load QR code."); }
    finally { setQrLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleDisconnect = async () => {
    if (!window.confirm("Disconnect the current WhatsApp account? You can scan a new QR code after.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/whatsapp/logout", { method: "POST", headers: authHeaders });
      if (res.ok) {
        setWaStatus("disconnected");
        toast({ title: "WhatsApp disconnected", description: "Scan QR to link a new number." });
      } else {
        toast({ title: "Disconnect failed", variant: "destructive" });
      }
    } catch { toast({ title: "Disconnect failed", variant: "destructive" }); }
    finally { setDisconnecting(false); }
  };

  // Poll status every 15 s
  useEffect(() => {
    void fetchStatus();
    const iv = setInterval(fetchStatus, 15_000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  // Poll QR while dialog is open (Baileys refreshes QR ~every 60 s)
  useEffect(() => {
    if (!qrOpen) { setQrDataUrl(null); setQrError(null); return; }
    void fetchQR();
    const iv = setInterval(fetchQR, 15_000);
    return () => clearInterval(iv);
  }, [qrOpen, fetchQR]);

  const groupsQuery = useQuery<InboxGroup[]>({
    queryKey: ["whatsapp-inbox-groups"],
    queryFn: () => apiFetch("/api/whatsapp-inbox/groups").then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["whatsapp-inbox-messages", selectedJid],
    queryFn: () =>
      apiFetch(`/api/whatsapp-inbox/messages/${encodeURIComponent(selectedJid!)}`).then((r) => r.json()),
    enabled: !!selectedJid,
    refetchInterval: 30_000,
  });

  const linksQuery = useQuery<GroupLink[]>({
    queryKey: ["whatsapp-inbox-links", selectedJid],
    queryFn: () =>
      apiFetch(`/api/whatsapp-inbox/links/${encodeURIComponent(selectedJid!)}`).then((r) => r.json()),
    enabled: !!selectedJid,
  });

  const markReadMutation = useMutation({
    mutationFn: (groupJid: string) =>
      apiFetch("/api/whatsapp-inbox/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupJid }),
      }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-groups"] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-messages", selectedJid] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-unread"] });
      toast({ description: "All messages marked as read." });
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: (data: { groupJid: string; entityType: string; entityId: number }) =>
      apiFetch("/api/whatsapp-inbox/links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-links", selectedJid] });
      setLinkDialogOpen(false);
      setLinkEntityId("");
      toast({ description: "Transaction linked successfully." });
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: (id: number) =>
      apiFetch(`/api/whatsapp-inbox/links/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-links", selectedJid] });
      toast({ description: "Link removed." });
    },
  });

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messagesQuery.data]);

  const groups = groupsQuery.data ?? [];
  const messages = (messagesQuery.data ?? []).slice().reverse();
  const links = linksQuery.data ?? [];
  const selectedGroup = groups.find((g) => g.group_jid === selectedJid);

  function handleSelectGroup(jid: string) {
    setSelectedJid(jid);
  }

  function handleMarkRead() {
    if (selectedJid) markReadMutation.mutate(selectedJid);
  }

  function handleAddLink() {
    const id = parseInt(linkEntityId, 10);
    if (!selectedJid || !id) {
      toast({ variant: "destructive", description: "Please enter a valid transaction ID." });
      return;
    }
    addLinkMutation.mutate({ groupJid: selectedJid, entityType: linkEntityType, entityId: id });
  }

  return (
    <>
    {/* ── QR Code Dialog ──────────────────────────────────────────────────── */}
    <Dialog open={qrOpen} onOpenChange={setQrOpen}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5 text-blue-900" />
            Link WhatsApp
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          {qrError ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="text-sm text-center text-red-600 font-medium">{qrError}</p>
            </div>
          ) : qrLoading && !qrDataUrl ? (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Generating QR code…</p>
            </div>
          ) : qrDataUrl ? (
            <>
              <img src={qrDataUrl} alt="WhatsApp QR Code" className="rounded-lg border border-gray-200" width={280} height={280} />
              <p className="text-xs text-muted-foreground text-center">
                Open WhatsApp → <strong>Settings → Linked Devices → Link a Device</strong>
              </p>
              <p className="text-xs text-blue-700 bg-blue-50 rounded px-3 py-1.5 text-center">
                QR refreshes every 15 s · Scanning connects the whole ERP
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Waiting for QR from server…</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    <div className="flex h-[calc(100vh-6rem)] gap-0 overflow-hidden rounded-lg border bg-background shadow-sm">

      {/* ── Left panel: group list ──────────────────────────────────────── */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r">
        {/* Title row */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-1.5">
            <h2 className="font-semibold text-sm">Groups</h2>
            <div className="flex items-center gap-1 text-xs">
              {waStatus === "connected" ? (
                <><Wifi className="h-3 w-3 text-green-500" /><span className="text-green-600">Connected</span></>
              ) : waStatus === "connecting" ? (
                <><Wifi className="h-3 w-3 text-amber-500 animate-pulse" /><span className="text-amber-600">Connecting…</span></>
              ) : (
                <><WifiOff className="h-3 w-3 text-gray-400" /><span className="text-gray-500">Not linked</span></>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => qc.invalidateQueries({ queryKey: ["whatsapp-inbox-groups"] })}
            title="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        {/* Connect / disconnect strip */}
        <div className="flex gap-1.5 border-b px-3 py-2 bg-gray-50/60">
          {waStatus !== "connected" ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 flex-1 text-xs border-green-600 text-green-700 hover:bg-green-50 gap-1.5"
              onClick={() => setQrOpen(true)}
            >
              <ScanLine className="h-3 w-3" /> Scan QR to Connect
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              <LogOut className="h-3 w-3" />
              {disconnecting ? "Disconnecting…" : "Disconnect"}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1">
          {groupsQuery.isLoading && (
            <div className="p-6 text-center text-sm text-muted-foreground">Loading groups…</div>
          )}
          {!groupsQuery.isLoading && groups.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No messages yet. Connect WhatsApp and messages will appear here.
            </div>
          )}
          {groups.map((g) => (
            <button
              key={g.group_jid}
              onClick={() => handleSelectGroup(g.group_jid)}
              className={cn(
                "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                selectedJid === g.group_jid && "bg-muted"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">{g.group_name}</span>
                <div className="flex flex-shrink-0 items-center gap-1.5">
                  {g.unread > 0 && (
                    <Badge className="h-5 min-w-5 rounded-full px-1 text-xs" variant="destructive">
                      {g.unread > 99 ? "99+" : g.unread}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {g.last_ts ? formatTs(Number(g.last_ts)) : ""}
                  </span>
                </div>
              </div>
              {g.last_text && (
                <p className="truncate text-xs text-muted-foreground">
                  {g.last_sender ? `${g.last_sender}: ` : ""}{g.last_text}
                </p>
              )}
            </button>
          ))}
        </ScrollArea>
      </div>

      {/* ── Right panel: message thread ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {!selectedJid ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
            <MessageSquare className="h-12 w-12 opacity-20" />
            <p className="text-sm">Select a group to view messages</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <h3 className="font-semibold text-sm">{selectedGroup?.group_name ?? shortJid(selectedJid)}</h3>
                <p className="text-xs text-muted-foreground">{selectedGroup?.total ?? 0} messages</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setLinkDialogOpen(true)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Link Transaction
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleMarkRead}
                  disabled={markReadMutation.isPending || (selectedGroup?.unread ?? 0) === 0}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark All Read
                </Button>
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-5 py-4">
              {messagesQuery.isLoading && (
                <div className="text-center text-sm text-muted-foreground">Loading messages…</div>
              )}
              {!messagesQuery.isLoading && messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground">No messages stored yet.</div>
              )}
              <div className="space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className="flex flex-col gap-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-emerald-700">
                        {msg.senderName ?? shortJid(msg.senderJid)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(fromUnixTime(msg.timestamp), "dd MMM HH:mm")}
                      </span>
                      {!msg.isRead && (
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" title="Unread" />
                      )}
                    </div>
                    <p className="rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed">{msg.text}</p>
                  </div>
                ))}
              </div>
              <div ref={bottomRef} />
            </ScrollArea>

            {/* Linked transactions */}
            {links.length > 0 && (
              <>
                <Separator />
                <div className="px-5 py-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Linked Transactions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {links.map((link) => {
                      const label = ENTITY_TYPES.find((e) => e.value === link.entityType)?.label ?? link.entityType;
                      return (
                        <span
                          key={link.id}
                          className="flex items-center gap-1.5 rounded-full border bg-muted px-3 py-1 text-xs"
                        >
                          <ChevronRight className="h-3 w-3 text-muted-foreground" />
                          {label} #{link.entityId}
                          <button
                            onClick={() => deleteLinkMutation.mutate(link.id)}
                            className="ml-1 text-muted-foreground hover:text-destructive"
                            title="Remove link"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* ── Link Transaction dialog ─────────────────────────────────────── */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Link to Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Transaction Type</Label>
              <Select value={linkEntityType} onValueChange={setLinkEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e.value} value={e.value}>
                      {e.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Transaction ID</Label>
              <Input
                type="number"
                placeholder="e.g. 42"
                value={linkEntityId}
                onChange={(e) => setLinkEntityId(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddLink} disabled={addLinkMutation.isPending}>
              {addLinkMutation.isPending ? "Linking…" : "Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}
