import { useState } from "react";
import { Link } from "wouter";
import { useListQuotations, useCreateQuotation, useListClients } from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Plus, Search, Eye, FileText, Package } from "lucide-react";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default function QuotationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ clientId: "", title: "", validUntil: "", currency: "USD", notes: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const { token } = useAuth();

  const { data: pkgInquiries = [] } = useQuery<{ quotationId: number | null }[]>({
    queryKey: ["package-inquiries-all-for-badge", token],
    queryFn: () =>
      fetch("/api/package-inquiries?status=all", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json()),
    enabled: !!token,
    staleTime: 60_000,
  });
  const fromPackageIds = new Set(
    (pkgInquiries as { quotationId: number | null }[]).filter((p) => p.quotationId != null).map((p) => p.quotationId as number)
  );

  const { data: quotations = [], isLoading } = useListQuotations({ search: search || undefined, status: statusFilter !== "all" ? statusFilter : undefined });
  const { data: clients = [] } = useListClients({});
  const createQuotation = useCreateQuotation({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/quotations"] });
        setOpen(false);
        setForm({ clientId: "", title: "", validUntil: "", currency: "USD", notes: "" });
        toast({ title: "Quotation created" });
      }
    }
  });

  const handleCreate = () => {
    if (!form.clientId || !form.validUntil) { toast({ title: "Select a client and valid-until date", variant: "destructive" }); return; }
    createQuotation.mutate({ data: { ...form, clientId: Number(form.clientId) } });
  };

  const qs = quotations as any[];
  const totalValue = qs.reduce((s: number, q: any) => s + (q.totalAmount || 0), 0);
  const sent = qs.filter((q: any) => q.status === "sent").length;
  const accepted = qs.filter((q: any) => q.status === "accepted").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Quotations</h2>
          <p className="text-muted-foreground">Build and manage client quotations.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Quotation</Button></DialogTrigger>
          <DialogContent className="sm:max-w-[480px]">
            <DialogHeader><DialogTitle>Create Quotation</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Client</Label>
                <Select value={form.clientId} onValueChange={v => setForm(p => ({ ...p, clientId: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>{(clients as any[]).map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Title</Label>
                <Input className="col-span-3" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Umrah Package 10 Days" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Valid Until</Label>
                <Input className="col-span-3" type="date" value={form.validUntil} onChange={e => setForm(p => ({ ...p, validUntil: e.target.value }))} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Currency</Label>
                <Select value={form.currency} onValueChange={v => setForm(p => ({ ...p, currency: v }))}>
                  <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
                  <SelectContent>{["USD","GBP","EUR","SAR","AED","PKR","MYR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={createQuotation.isPending}>Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Quotations", value: qs.length, color: "text-slate-700" },
          { label: "Sent", value: sent, color: "text-blue-600" },
          { label: "Accepted", value: accepted, color: "text-green-600" },
          { label: "Total Value", value: `$${Math.round(totalValue).toLocaleString()}`, color: "text-purple-600" },
        ].map(s => (
          <Card key={s.label}><CardContent className="pt-6"><div className="text-xs text-muted-foreground">{s.label}</div><div className={`text-2xl font-bold ${s.color}`}>{s.value}</div></CardContent></Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by reference..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="flex gap-1">
              {[
                { value: "all",      label: "All" },
                { value: "draft",    label: "Drafts" },
                { value: "sent",     label: "Sent" },
                { value: "accepted", label: "Accepted" },
                { value: "rejected", label: "Rejected" },
                { value: "expired",  label: "Expired" },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setStatusFilter(value)}
                  className={`px-3 py-1.5 text-xs rounded-md font-medium transition-colors border ${
                    statusFilter === value
                      ? value === "draft"    ? "bg-slate-700 text-white border-slate-700"
                      : value === "sent"     ? "bg-blue-600 text-white border-blue-600"
                      : value === "accepted" ? "bg-green-600 text-white border-green-600"
                      : value === "rejected" ? "bg-red-600 text-white border-red-600"
                      : value === "expired"  ? "bg-amber-500 text-white border-amber-500"
                      : "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center h-32 text-muted-foreground"><FileText className="mx-auto h-8 w-8 mb-2" />No quotations found</TableCell></TableRow>
                ) : qs.map((q: any) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-mono text-sm font-medium">{q.referenceNo}</TableCell>
                    <TableCell>{q.clientName}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span>{q.title || "—"}</span>
                      {fromPackageIds.has(q.id) && (
                        <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Package className="h-3 w-3" />From Package
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-semibold">{q.currency} {(q.totalAmount || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{new Date(q.validUntil).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[q.status] || "bg-gray-100"}`}>{q.status}</span>
                    </TableCell>
                    <TableCell>
                      <Link href={`/quotations/${q.id}`}><Button size="sm" variant="ghost"><Eye className="h-4 w-4" /></Button></Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
