import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, FileText, Eye, CheckCircle, XCircle, Printer } from "lucide-react";

interface Voucher {
  id: number;
  voucherNumber: string;
  type: string;
  date: string;
  narration: string;
  status: string;
  partyName: string | null;
  vendorName: string | null;
  createdAt: string;
}

const TYPE_LABELS: Record<string, string> = {
  RV: "Receipt Voucher",
  PV: "Payment Voucher",
  JV: "Journal Voucher",
  CV: "Contra Voucher",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-700",
  posted: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

export default function VouchersPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const headers = { Authorization: `Bearer ${token}` };

  const { data: vouchers = [], isLoading } = useQuery<Voucher[]>({
    queryKey: ["vouchers", typeFilter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      return fetch(`/api/accounting/vouchers?${params}`, { headers }).then((r) => r.json());
    },
    enabled: !!token,
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/accounting/vouchers/${id}/approve`, { method: "POST", headers }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vouchers"] }); toast({ title: "Voucher approved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/accounting/vouchers/${id}/post`, { method: "POST", headers }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vouchers"] }); toast({ title: "Voucher posted to general journal" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/accounting/vouchers/${id}/cancel`, { method: "POST", headers }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vouchers"] }); toast({ title: "Voucher cancelled" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = vouchers.filter((v) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      v.voucherNumber.toLowerCase().includes(q) ||
      v.narration.toLowerCase().includes(q) ||
      (v.partyName?.toLowerCase() ?? "").includes(q) ||
      (v.vendorName?.toLowerCase() ?? "").includes(q)
    );
  });

  const totals = {
    total: filtered.length,
    draft: filtered.filter((v) => v.status === "draft").length,
    approved: filtered.filter((v) => v.status === "approved").length,
    posted: filtered.filter((v) => v.status === "posted").length,
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Vouchers</h1>
          <p className="text-sm text-muted-foreground">Receipt, Payment, Journal &amp; Contra vouchers</p>
        </div>
        <Button onClick={() => navigate("/accounting/vouchers/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Voucher
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total", value: totals.total, color: "text-gray-900" },
          { label: "Draft", value: totals.draft, color: "text-gray-600" },
          { label: "Approved", value: totals.approved, color: "text-blue-600" },
          { label: "Posted", value: totals.posted, color: "text-green-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search vouchers…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="RV">Receipt Voucher</SelectItem>
            <SelectItem value="PV">Payment Voucher</SelectItem>
            <SelectItem value="JV">Journal Voucher</SelectItem>
            <SelectItem value="CV">Contra Voucher</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Voucher #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Narration</TableHead>
                <TableHead>Party / Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No vouchers found</TableCell></TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-mono text-xs font-semibold">{v.voucherNumber}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{v.type}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{v.date}</TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{v.narration}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.partyName ?? v.vendorName ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {v.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/accounting/vouchers/${v.id}`}>
                          <Button variant="ghost" size="icon" title="View / Print"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        {v.status === "draft" && (
                          <Button variant="ghost" size="icon" title="Approve" onClick={() => approveMutation.mutate(v.id)}>
                            <CheckCircle className="h-4 w-4 text-blue-500" />
                          </Button>
                        )}
                        {v.status === "approved" && (
                          <Button variant="ghost" size="icon" title="Post to Journal" onClick={() => postMutation.mutate(v.id)}>
                            <FileText className="h-4 w-4 text-green-600" />
                          </Button>
                        )}
                        {(v.status === "draft" || v.status === "approved") && (
                          <Button variant="ghost" size="icon" title="Cancel" onClick={() => {
                            if (confirm(`Cancel voucher ${v.voucherNumber}?`)) cancelMutation.mutate(v.id);
                          }}>
                            <XCircle className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
