import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, fromUnixTime } from "date-fns";
import {
  MessageSquare, CheckCheck, Link2, Trash2, RefreshCw, ChevronRight,
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
  return fetch(path, { credentials: "include", ...init });
}

export default function WhatsAppInboxPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkEntityType, setLinkEntityType] = useState("flight_quotation");
  const [linkEntityId, setLinkEntityId] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

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
    <div className="flex h-[calc(100vh-6rem)] gap-0 overflow-hidden rounded-lg border bg-background shadow-sm">

      {/* ── Left panel: group list ──────────────────────────────────────── */}
      <div className="flex w-80 flex-shrink-0 flex-col border-r">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-sm">Groups</h2>
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
  );
}
