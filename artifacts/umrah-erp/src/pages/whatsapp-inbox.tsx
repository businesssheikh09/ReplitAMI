import { useState, useEffect, useRef, useCallback, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, fromUnixTime } from "date-fns";
import {
  MessageSquare, CheckCheck, Link2, Trash2, RefreshCw, ChevronRight,
  Wifi, WifiOff, ScanLine, Loader2, AlertCircle, LogOut,
  Send, CornerUpLeft, X, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import QRCode from "qrcode";

/* ── Types ──────────────────────────────────────────────────────────────── */

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
  isSent: boolean;
  quotedWaId: string | null;
  quotedText: string | null;
  quotedSenderName: string | null;
}

interface GroupLink {
  id: number;
  groupJid: string;
  entityType: string;
  entityId: number;
  linkedAt: string;
  linkedBy: number | null;
}

interface QuoteState {
  waId: string;
  text: string;
  senderJid: string;
  senderName: string | null;
}

/* ── Constants ───────────────────────────────────────────────────────────── */

const ENTITY_TYPES = [
  { value: "flight_quotation", label: "Flight Quotation" },
  { value: "quotation", label: "Package Quotation" },
  { value: "hotel_request", label: "Hotel Request" },
  { value: "transport_booking", label: "Transport Booking" },
  { value: "invoice", label: "Invoice" },
  { value: "visa_application", label: "Visa Application" },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */

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

/* ── Quoted bubble strip ─────────────────────────────────────────────────── */

function QuotedStrip({
  senderName,
  text,
  isSent,
}: {
  senderName: string | null;
  text: string;
  isSent: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-1.5 rounded-md border-l-[3px] px-2 py-1 text-xs",
        isSent
          ? "border-white/60 bg-green-700/30 text-white/80"
          : "border-green-500 bg-black/5 text-muted-foreground",
      )}
    >
      <p className="font-semibold truncate">
        {senderName ?? "Unknown"}
      </p>
      <p className="truncate">{text}</p>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */

export default function WhatsAppInboxPage() {
  const qc = useQueryClient();
  const { token } = useAuth();
  const { toast } = useToast();

  /* --- state --- */
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkEntityType, setLinkEntityType] = useState(ENTITY_TYPES[0].value);
  const [linkEntityId, setLinkEntityId] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [compose, setCompose] = useState("");
  const [replyTo, setReplyTo] = useState<QuoteState | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<number | null>(null);
  const [groupSearch, setGroupSearch] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* Keep a mutable ref to the latest token — avoids stale-closure 401s in
     React Query polling callbacks that capture an older version of the closure. */
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  function apiFetchAuth(path: string, init?: RequestInit) {
    const hdrs: Record<string, string> = tokenRef.current
      ? { Authorization: `Bearer ${tokenRef.current}` }
      : {};
    return apiFetch(path, {
      ...init,
      headers: { ...hdrs, ...(init?.headers as Record<string, string> | undefined ?? {}) },
    });
  }

  /* ── WA status (polled via React Query) ── */
  const waStatusQuery = useQuery<{ status: string; connected: boolean; connecting: boolean }>({
    queryKey: ["whatsapp-status"],
    queryFn: () =>
      apiFetchAuth("/api/whatsapp/status")
        .then((r) => r.json())
        .catch(() => ({ status: "disconnected", connected: false, connecting: false })),
    refetchInterval: 8_000,
    retry: false,
  });
  const waStatus: "connected" | "connecting" | "disconnected" =
    waStatusQuery.data?.connected
      ? "connected"
      : waStatusQuery.data?.connecting
        ? "connecting"
        : "disconnected";

  /* ── QR code ── */
  const fetchQR = useCallback(async () => {
    setQrLoading(true);
    setQrError(null);
    try {
      const r = await apiFetchAuth("/api/whatsapp/qr");
      if (!r.ok) { setQrError("QR not available yet — make sure WhatsApp server is running."); return; }
      const { qr } = await r.json();
      if (!qr) { setQrError("No QR code available. Please wait or restart the server."); return; }
      const url = await QRCode.toDataURL(qr, { width: 280, margin: 1 });
      setQrDataUrl(url);
    } catch {
      setQrError("Failed to fetch QR code. Check server logs.");
    } finally {
      setQrLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!qrOpen) { setQrDataUrl(null); setQrError(null); return; }
    void fetchQR();
    const iv = setInterval(fetchQR, 15_000);
    return () => clearInterval(iv);
  }, [qrOpen, fetchQR]);

  /* ── Queries ── */
  const groupsQuery = useQuery<InboxGroup[]>({
    queryKey: ["whatsapp-inbox-groups"],
    queryFn: () => apiFetchAuth("/api/whatsapp-inbox/groups").then((r) => r.json()),
    refetchInterval: 8_000,
  });

  const messagesQuery = useQuery<Message[]>({
    queryKey: ["whatsapp-inbox-messages", selectedJid],
    queryFn: () =>
      apiFetchAuth(`/api/whatsapp-inbox/messages/${encodeURIComponent(selectedJid!)}`).then(
        (r) => r.json(),
      ),
    enabled: !!selectedJid,
    refetchInterval: 4_000,
  });

  const linksQuery = useQuery<GroupLink[]>({
    queryKey: ["whatsapp-inbox-links", selectedJid],
    queryFn: () =>
      apiFetchAuth(`/api/whatsapp-inbox/links/${encodeURIComponent(selectedJid!)}`).then(
        (r) => r.json(),
      ),
    enabled: !!selectedJid,
  });

  /* ── Mutations ── */
  const markReadMutation = useMutation({
    mutationFn: (groupJid: string) =>
      apiFetchAuth("/api/whatsapp-inbox/mark-read", {
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

  const sendMutation = useMutation({
    mutationFn: ({
      jid,
      text,
      quote,
    }: {
      jid: string;
      text: string;
      quote?: QuoteState | null;
    }) =>
      apiFetchAuth("/api/whatsapp-inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jid,
          text,
          quote: quote
            ? { waId: quote.waId, text: quote.text, senderJid: quote.senderJid, senderName: quote.senderName }
            : null,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      setCompose("");
      setReplyTo(null);
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-messages", selectedJid] });
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-groups"] });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", description: err.message ?? "Failed to send message." });
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: (data: { groupJid: string; entityType: string; entityId: number }) =>
      apiFetchAuth("/api/whatsapp-inbox/links", {
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
      apiFetchAuth(`/api/whatsapp-inbox/links/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-links", selectedJid] });
      toast({ description: "Link removed." });
    },
  });

  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true);
    try {
      await apiFetchAuth("/api/whatsapp/disconnect", { method: "POST" });
      setWaStatus("disconnected");
      toast({ description: "WhatsApp disconnected." });
    } catch {
      toast({ variant: "destructive", description: "Failed to disconnect." });
    } finally {
      setDisconnecting(false);
    }
  }, [token]);

  /* ── Scroll to bottom on new messages ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messagesQuery.data]);

  /* ── Auto-resize textarea ── */
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [compose]);

  /* ── Focus textarea when reply set ── */
  useEffect(() => {
    if (replyTo) textareaRef.current?.focus();
  }, [replyTo]);

  /* ── Derived values ── */
  const groups = groupsQuery.data ?? [];
  const filteredGroups = groupSearch.trim()
    ? groups.filter((g) =>
        g.group_name.toLowerCase().includes(groupSearch.trim().toLowerCase()),
      )
    : groups;
  const messages = (messagesQuery.data ?? []).slice().reverse();
  const links = linksQuery.data ?? [];
  const selectedGroup = groups.find((g) => g.group_jid === selectedJid);

  /* ── Handlers ── */
  function handleSelectGroup(jid: string) {
    setSelectedJid(jid);
    setReplyTo(null);
    setCompose("");
    setGroupSearch("");
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

  function handleSend() {
    if (!selectedJid || !compose.trim() || sendMutation.isPending) return;
    sendMutation.mutate({ jid: selectedJid, text: compose.trim(), quote: replyTo });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function handleReply(msg: Message) {
    setReplyTo({
      waId: msg.waMessageId ?? `id-${msg.id}`,
      text: msg.text,
      senderJid: msg.senderJid,
      senderName: msg.isSent ? "You" : (msg.senderName ?? shortJid(msg.senderJid)),
    });
    textareaRef.current?.focus();
  }

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */

  return (
    <>
      {/* ── QR Code Dialog ────────────────────────────────────────────── */}
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

        {/* ══ LEFT PANEL: group list ══════════════════════════════════════ */}
        <div className="flex w-80 flex-shrink-0 flex-col border-r">

          {/* Title / status bar */}
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

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Refresh groups"
                onClick={() => void qc.invalidateQueries({ queryKey: ["whatsapp-inbox-groups"] })}
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {waStatus !== "connected" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                  onClick={() => setQrOpen(true)}
                >
                  <ScanLine className="h-3 w-3" />
                  Scan QR
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
          </div>

          {/* Search bar */}
          <div className="border-b px-3 py-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={groupSearch}
                onChange={(e) => setGroupSearch(e.target.value)}
                placeholder="Search groups…"
                className="w-full rounded-md border bg-muted/40 py-1.5 pl-8 pr-8 text-sm outline-none placeholder:text-muted-foreground/60 focus:bg-background focus:ring-2 focus:ring-green-400"
              />
              {groupSearch && (
                <button
                  onClick={() => setGroupSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Group list */}
          <ScrollArea className="flex-1">
            {groupsQuery.isLoading && (
              <div className="p-6 text-center text-sm text-muted-foreground">Loading groups…</div>
            )}
            {!groupsQuery.isLoading && groups.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No messages yet. Connect WhatsApp and messages will appear here.
              </div>
            )}
            {!groupsQuery.isLoading && groups.length > 0 && filteredGroups.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No groups match "<span className="font-medium">{groupSearch}</span>"
              </div>
            )}
            {filteredGroups.map((g) => {
              const isSelected = selectedJid === g.group_jid;
              const hasUnread = g.unread > 0;
              return (
                <button
                  key={g.group_jid}
                  onClick={() => handleSelectGroup(g.group_jid)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left transition-colors hover:bg-muted/50",
                    isSelected && "bg-muted",
                    !isSelected && hasUnread && "bg-green-50/60 border-l-[3px] border-l-green-500",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        "truncate text-sm",
                        hasUnread ? "font-bold" : "font-medium",
                      )}
                    >
                      {g.group_name}
                    </span>
                    <div className="flex flex-shrink-0 items-center gap-1.5">
                      {hasUnread && (
                        <Badge className="h-5 min-w-5 rounded-full px-1 text-xs bg-green-500 hover:bg-green-500">
                          {g.unread > 99 ? "99+" : g.unread}
                        </Badge>
                      )}
                      <span className={cn("text-xs", hasUnread ? "text-foreground/70 font-medium" : "text-muted-foreground")}>
                        {g.last_ts ? formatTs(Number(g.last_ts)) : ""}
                      </span>
                    </div>
                  </div>
                  {g.last_text && (
                    <p className={cn("truncate text-xs", hasUnread ? "text-foreground/70" : "text-muted-foreground")}>
                      {g.last_sender ? `${g.last_sender}: ` : ""}
                      {g.last_text}
                    </p>
                  )}
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* ══ RIGHT PANEL: message thread ════════════════════════════════ */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {!selectedJid ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
              <MessageSquare className="h-12 w-12 opacity-20" />
              <p className="text-sm">Select a group to view messages</p>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div className="flex items-center justify-between border-b px-5 py-3 flex-shrink-0">
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
                    Link
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleMarkRead}
                    disabled={markReadMutation.isPending || (selectedGroup?.unread ?? 0) === 0}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Mark Read
                  </Button>
                </div>
              </div>

              {/* ── Messages ─────────────────────────────────────────────── */}
              <div
                className="flex-1 overflow-y-auto px-4 py-3"
                style={{ backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)", backgroundSize: "20px 20px", backgroundColor: "#f0f2f5" }}
              >
                {messagesQuery.isLoading && (
                  <div className="text-center text-sm text-muted-foreground py-8">Loading messages…</div>
                )}
                {!messagesQuery.isLoading && messages.length === 0 && (
                  <div className="text-center text-sm text-muted-foreground py-8">No messages stored yet.</div>
                )}

                <div className="flex flex-col gap-1.5">
                  {messages.map((msg, idx) => {
                    const isSent = msg.isSent;
                    const prevMsg = idx > 0 ? messages[idx - 1] : null;
                    const showSender = !isSent && msg.senderJid !== prevMsg?.senderJid;

                    return (
                      <div
                        key={msg.id}
                        className={cn("flex group", isSent ? "justify-end" : "justify-start")}
                        onMouseEnter={() => setHoveredMsgId(msg.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {/* Reply button (received, left) */}
                        {!isSent && (
                          <button
                            onClick={() => handleReply(msg)}
                            className={cn(
                              "self-end mb-1 mr-1 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/10 transition-opacity",
                              hoveredMsgId === msg.id ? "opacity-100" : "opacity-0",
                            )}
                            title="Reply"
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" />
                          </button>
                        )}

                        {/* Bubble */}
                        <div
                          className={cn(
                            "relative max-w-[75%] rounded-lg px-3 py-2 shadow-sm",
                            isSent
                              ? "bg-[#dcf8c6] rounded-tr-none"
                              : "bg-white rounded-tl-none",
                          )}
                        >
                          {/* Sender name (received only) */}
                          {showSender && (
                            <p className="text-xs font-semibold text-emerald-700 mb-0.5 truncate">
                              {msg.senderName ?? shortJid(msg.senderJid)}
                            </p>
                          )}

                          {/* Quoted message */}
                          {msg.quotedText && (
                            <QuotedStrip
                              senderName={msg.quotedSenderName}
                              text={msg.quotedText}
                              isSent={isSent}
                            />
                          )}

                          {/* Message text */}
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>

                          {/* Timestamp + read dot */}
                          <div className={cn("flex items-center gap-1 mt-0.5", isSent ? "justify-end" : "justify-start")}>
                            <span className="text-[10px] text-muted-foreground/70">
                              {format(fromUnixTime(msg.timestamp), "HH:mm")}
                            </span>
                            {!msg.isRead && !isSent && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" title="Unread" />
                            )}
                          </div>
                        </div>

                        {/* Reply button (sent, right) */}
                        {isSent && (
                          <button
                            onClick={() => handleReply(msg)}
                            className={cn(
                              "self-end mb-1 ml-1 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-black/10 transition-opacity",
                              hoveredMsgId === msg.id ? "opacity-100" : "opacity-0",
                            )}
                            title="Reply"
                          >
                            <CornerUpLeft className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div ref={bottomRef} className="h-1" />
              </div>

              {/* Linked transactions */}
              {links.length > 0 && (
                <>
                  <Separator />
                  <div className="px-5 py-2 flex-shrink-0">
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

              {/* ── Compose bar ──────────────────────────────────────────── */}
              <div className="flex-shrink-0 border-t bg-[#f0f2f5]">
                {/* Quote preview strip */}
                {replyTo && (
                  <div className="flex items-start gap-2 border-b border-green-200 bg-green-50 px-4 py-2">
                    <div className="flex-1 border-l-[3px] border-green-500 pl-2">
                      <p className="text-xs font-semibold text-green-700 truncate">{replyTo.senderName ?? replyTo.senderJid}</p>
                      <p className="text-xs text-muted-foreground truncate">{replyTo.text}</p>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      className="mt-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-end gap-2 px-4 py-2">
                  <textarea
                    ref={textareaRef}
                    value={compose}
                    onChange={(e) => setCompose(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      waStatus !== "connected"
                        ? "Connect WhatsApp to send messages…"
                        : "Type a message (Enter to send, Shift+Enter for newline)"
                    }
                    disabled={waStatus !== "connected" || sendMutation.isPending}
                    rows={1}
                    className={cn(
                      "flex-1 resize-none rounded-lg border bg-white px-3 py-2 text-sm leading-relaxed shadow-sm outline-none placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed",
                      "max-h-[120px] overflow-y-auto",
                    )}
                    style={{ minHeight: "40px" }}
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!compose.trim() || waStatus !== "connected" || sendMutation.isPending}
                    size="icon"
                    className="h-10 w-10 flex-shrink-0 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-sm disabled:opacity-40"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Link Transaction dialog ──────────────────────────────────── */}
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
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Transaction ID</Label>
              <Input
                type="number"
                placeholder="e.g. 1042"
                value={linkEntityId}
                onChange={(e) => setLinkEntityId(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLink} disabled={addLinkMutation.isPending}>
              {addLinkMutation.isPending ? "Linking…" : "Link"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
