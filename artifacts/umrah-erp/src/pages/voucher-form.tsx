import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, AlertCircle, ArrowLeft } from "lucide-react";

interface Account {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface Line {
  accountId: string;
  description: string;
  debitAmount: string;
  creditAmount: string;
  currency: string;
}

const VOUCHER_TYPES = [
  { value: "RV", label: "RV — Receipt Voucher" },
  { value: "PV", label: "PV — Payment Voucher" },
  { value: "JV", label: "JV — Journal Voucher" },
  { value: "CV", label: "CV — Contra/Cash Voucher" },
];

const CURRENCIES = ["PKR", "SAR", "USD", "AED", "GBP", "EUR"];

function emptyLine(): Line {
  return { accountId: "", description: "", debitAmount: "", creditAmount: "", currency: "PKR" };
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function VoucherFormPage() {
  const { token } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState("JV");
  const [date, setDate] = useState(today);
  const [narration, setNarration] = useState("");
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);

  const headers = { Authorization: `Bearer ${token}` };

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["chart-of-accounts"],
    queryFn: () => fetch("/api/accounting/accounts", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const createMutation = useMutation({
    mutationFn: (payload: any) =>
      fetch("/api/accounting/vouchers", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then(async (r) => {
        if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Failed"); }
        return r.json();
      }),
    onSuccess: (data) => {
      toast({ title: `Voucher ${data.voucherNumber} created` });
      navigate("/accounting/vouchers");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function updateLine(i: number, field: keyof Line, value: string) {
    setLines((ls) => ls.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  function addLine() {
    setLines((ls) => [...ls, emptyLine()]);
  }

  function removeLine(i: number) {
    if (lines.length <= 2) return;
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  const totalDr = lines.reduce((s, l) => s + (parseFloat(l.debitAmount) || 0), 0);
  const totalCr = lines.reduce((s, l) => s + (parseFloat(l.creditAmount) || 0), 0);
  const diff = Math.abs(totalDr - totalCr);
  const isBalanced = diff < 0.01;

  function handleSubmit() {
    if (!narration.trim()) { toast({ title: "Narration required", variant: "destructive" }); return; }
    if (!isBalanced) { toast({ title: "Voucher does not balance", description: `Difference: ${fmt(diff)}`, variant: "destructive" }); return; }
    const validLines = lines.filter((l) => l.accountId && (parseFloat(l.debitAmount) > 0 || parseFloat(l.creditAmount) > 0));
    if (validLines.length < 2) { toast({ title: "At least 2 lines required", variant: "destructive" }); return; }

    createMutation.mutate({ type, date, narration, lines: validLines });
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/accounting/vouchers")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">New Voucher</h1>
          <p className="text-sm text-muted-foreground">Create a new accounting voucher (saved as draft)</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label>Voucher Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {VOUCHER_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Date</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
        </div>
        <div className="col-span-1">
          <Label>Narration / Description</Label>
          <Textarea
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
            placeholder="Purpose of this voucher…"
            className="mt-1 h-10 resize-none"
          />
        </div>
      </div>

      <Card>
        <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Voucher Lines</CardTitle>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Add Line
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[280px]">Account</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-28">Currency</TableHead>
                <TableHead className="w-32 text-right">Debit</TableHead>
                <TableHead className="w-32 text-right">Credit</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Select value={l.accountId} onValueChange={(v) => updateLine(i, "accountId", v)}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Select account…" />
                      </SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => (
                          <SelectItem key={a.id} value={String(a.id)}>
                            {a.code} — {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm"
                      value={l.description}
                      onChange={(e) => updateLine(i, "description", e.target.value)}
                      placeholder="Optional note"
                    />
                  </TableCell>
                  <TableCell>
                    <Select value={l.currency} onValueChange={(v) => updateLine(i, "currency", v)}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm text-right tabular-nums"
                      value={l.debitAmount}
                      onChange={(e) => {
                        updateLine(i, "debitAmount", e.target.value);
                        if (e.target.value) updateLine(i, "creditAmount", "");
                      }}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      className="h-8 text-sm text-right tabular-nums"
                      value={l.creditAmount}
                      onChange={(e) => {
                        updateLine(i, "creditAmount", e.target.value);
                        if (e.target.value) updateLine(i, "debitAmount", "");
                      }}
                      placeholder="0.00"
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => removeLine(i)} disabled={lines.length <= 2}>
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Totals row */}
          <div className="border-t px-4 py-3 flex justify-end gap-8">
            <div className="text-sm">
              <span className="text-muted-foreground">Total Debit: </span>
              <span className="font-mono font-semibold">{fmt(totalDr)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Total Credit: </span>
              <span className="font-mono font-semibold">{fmt(totalCr)}</span>
            </div>
            {!isBalanced && totalDr + totalCr > 0 && (
              <div className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3.5 w-3.5" />
                <span>Difference: {fmt(diff)}</span>
              </div>
            )}
            {isBalanced && totalDr > 0 && (
              <div className="text-sm text-green-600 font-medium">✓ Balanced</div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/accounting/vouchers")}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={createMutation.isPending || !isBalanced || totalDr === 0}>
          {createMutation.isPending ? "Saving…" : "Save as Draft"}
        </Button>
      </div>
    </div>
  );
}
