import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, CheckCircle, FileText, XCircle, RotateCcw } from "lucide-react";
import { useBranding } from "@/components/print-layout";
import { amountToWords } from "@/lib/amount-in-words";

interface VoucherLine {
  id: number;
  accountId: number;
  description: string | null;
  debitAmount: number;
  creditAmount: number;
  currency: string;
  account: { id: number; code: string; name: string; type: string } | null;
}

interface Voucher {
  id: number;
  voucherNumber: string;
  type: string;
  date: string;
  narration: string;
  status: string;
  partyName: string | null;
  vendorName: string | null;
  totalDebit: number;
  totalCredit: number;
  lines: VoucherLine[];
  createdAt: string;
  approvedAt: string | null;
  postedAt: string | null;
  reversalOf: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-700",
  posted: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
};

const TYPE_FULL: Record<string, string> = {
  RV: "Receipt Voucher",
  PV: "Payment Voucher",
  JV: "Journal Voucher",
  CV: "Contra/Cash Voucher",
};

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, navigate] = useLocation();

  const headers = { Authorization: `Bearer ${token}` };

  const { data: voucher, isLoading } = useQuery<Voucher>({
    queryKey: ["voucher", id],
    queryFn: () => fetch(`/api/accounting/vouchers/${id}`, { headers }).then((r) => r.json()),
    enabled: !!token && !!id,
  });

  const approveMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/accounting/vouchers/${id}/approve`, { method: "POST", headers }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); } return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voucher", id] }); toast({ title: "Voucher approved" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const postMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/accounting/vouchers/${id}/post`, { method: "POST", headers }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); } return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voucher", id] }); toast({ title: "Voucher posted to journal" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/accounting/vouchers/${id}/cancel`, { method: "POST", headers }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); } return r.json();
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["voucher", id] }); toast({ title: "Voucher cancelled" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const reverseMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/accounting/vouchers/${id}/reverse`, { method: "POST", headers }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); } return r.json();
      }),
    onSuccess: (data) => {
      toast({ title: "Reversal voucher created", description: `${data.voucherNumber} — approve and post to finalise` });
      navigate("/accounting/vouchers");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const branding = useBranding();

  if (isLoading) return <div className="p-6 text-center text-muted-foreground">Loading…</div>;
  if (!voucher) return <div className="p-6 text-center text-muted-foreground">Voucher not found</div>;

  const canPrint = voucher.status !== "cancelled";
  const logoSrc = branding.printLogoUrl || branding.logoUrl;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 print:p-2">
      {/* Header — hidden on print */}
      <div className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/vouchers")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold">{voucher.voucherNumber}</h1>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[voucher.status]}`}>
            {voucher.status}
          </span>
        </div>
        <div className="flex gap-2">
          {voucher.status === "draft" && (
            <Button size="sm" variant="outline" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
            </Button>
          )}
          {voucher.status === "approved" && (
            <Button size="sm" onClick={() => postMutation.mutate()} disabled={postMutation.isPending}>
              <FileText className="h-3.5 w-3.5 mr-1" /> Post to Journal
            </Button>
          )}
          {voucher.status === "posted" && (
            <Button size="sm" variant="outline" onClick={() => {
              if (confirm("Create a reversal entry for this voucher?")) reverseMutation.mutate();
            }} disabled={reverseMutation.isPending}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverse
            </Button>
          )}
          {(voucher.status === "draft" || voucher.status === "approved") && (
            <Button size="sm" variant="outline" className="text-red-600" onClick={() => {
              if (confirm("Cancel this voucher?")) cancelMutation.mutate();
            }} disabled={cancelMutation.isPending}>
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          )}
          {canPrint && (
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Print
            </Button>
          )}
        </div>
      </div>

      {/* Voucher document */}
      <Card className="print:shadow-none print:border-none overflow-hidden">
        {/* ── Print-only AMI branding header ── */}
        <div className="hidden print:block border-b-4 border-blue-900 pb-3 pt-4 px-6">
          <div className="flex items-center justify-between">
            <div className="w-24 h-14 flex items-center">
              {logoSrc ? (
                <img src={logoSrc} alt="Logo" className="max-h-12 max-w-full object-contain" />
              ) : (
                <div className="h-12 w-20 bg-blue-900 rounded flex items-center justify-center text-white text-xs font-bold text-center leading-tight px-1">
                  {branding.companyName}
                </div>
              )}
            </div>
            <div className="text-center flex-1 px-4">
              <div className="text-base font-bold text-blue-900 uppercase tracking-wide">{branding.companyName}</div>
              {branding.companyAddress && <div className="text-xs text-gray-600 mt-0.5">{branding.companyAddress}</div>}
              {branding.companyPhone && <div className="text-xs text-gray-500">{branding.companyPhone}</div>}
            </div>
            <div className="text-right text-xs text-gray-500 w-24">
              <div>Date: <strong className="text-gray-800">{voucher.date}</strong></div>
            </div>
          </div>
        </div>

        <CardHeader className="border-b pb-4">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 print:hidden">{branding.companyName}</div>
              <h2 className="text-xl font-bold">{TYPE_FULL[voucher.type] ?? voucher.type}</h2>
              <p className="font-mono text-sm font-semibold text-muted-foreground">{voucher.voucherNumber}</p>
            </div>
            <div className="text-right text-sm space-y-1">
              <div className="print:hidden"><span className="text-muted-foreground">Date: </span><strong>{voucher.date}</strong></div>
              <div><span className="text-muted-foreground">Status: </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[voucher.status]}`}>
                  {voucher.status}
                </span>
              </div>
              {voucher.reversalOf && (
                <div className="text-red-600 text-xs">Reversal of #{voucher.reversalOf}</div>
              )}
            </div>
          </div>
          {(voucher.partyName || voucher.vendorName) && (
            <div className="mt-3 text-sm">
              <span className="text-muted-foreground">{voucher.partyName ? "Party: " : "Vendor: "}</span>
              <strong>{voucher.partyName ?? voucher.vendorName}</strong>
            </div>
          )}
          <div className="mt-2 text-sm">
            <span className="text-muted-foreground">Narration: </span>{voucher.narration}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-24">Currency</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right pr-4">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {voucher.lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="pl-4 text-sm">
                    <div className="font-medium">{l.account?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{l.account?.code}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{l.description ?? "—"}</TableCell>
                  <TableCell className="text-sm">{l.currency}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{l.debitAmount > 0 ? fmt(l.debitAmount) : "—"}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm pr-4">{l.creditAmount > 0 ? fmt(l.creditAmount) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell colSpan={3} className="pl-4 text-right">TOTAL</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(voucher.totalDebit)}</TableCell>
                <TableCell className="text-right tabular-nums pr-4">{fmt(voucher.totalCredit)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>

        {/* Amount in words */}
        <div className="border-t px-4 py-2 text-sm">
          <span className="text-muted-foreground text-xs">Amount in Words: </span>
          <span className="italic font-medium">
            {amountToWords(voucher.totalDebit, voucher.lines[0]?.currency ?? "PKR")}
          </span>
        </div>

        <div className="border-t px-4 py-4 grid grid-cols-3 gap-8 text-sm print:mt-12">
          {["Prepared By", "Checked By", "Approved By"].map((label) => (
            <div key={label} className="text-center">
              <div className="border-b border-dashed border-gray-400 h-8 mb-1"></div>
              <div className="text-muted-foreground text-xs">{label}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Timeline */}
      <div className="print:hidden text-xs text-muted-foreground space-y-1">
        <div>Created: {new Date(voucher.createdAt).toLocaleString()}</div>
        {voucher.approvedAt && <div>Approved: {new Date(voucher.approvedAt).toLocaleString()}</div>}
        {voucher.postedAt && <div>Posted: {new Date(voucher.postedAt).toLocaleString()}</div>}
      </div>
    </div>
  );
}
