import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download } from "lucide-react";

interface LogRow {
  id: number;
  ticketNumber: string;
  pnr: string;
  airline: string;
  passenger: string;
  route: string;
  amount: number;
  currency: string;
  status: string;
  issuedByName: string;
  issuedAt: string | null;
  cancelledAt: string | null;
  refundedAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  ticketed: "bg-green-100 text-green-700",
  issued: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refund_pending: "bg-yellow-100 text-yellow-700",
  refunded: "bg-blue-100 text-blue-700",
};

export default function StaffTicketLogPage() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [fromDate, setFromDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (statusFilter !== "all") params.set("status", statusFilter);

  const { data: rows = [], isLoading } = useQuery<LogRow[]>({
    queryKey: ["staff-ticket-log", fromDate, statusFilter],
    queryFn: () =>
      fetch(`/api/staff-ticket-log?${params}`, { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  function exportCsv() {
    const header = "Ticket No,PNR,Airline,Passenger,Route,Amount,Currency,Status,Issued By,Issued At,Cancelled At,Refunded At";
    const csvRows = rows.map((r) =>
      [
        r.ticketNumber, r.pnr, r.airline, r.passenger, r.route,
        r.amount, r.currency, r.status, r.issuedByName,
        r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : "",
        r.cancelledAt ? new Date(r.cancelledAt).toLocaleDateString() : "",
        r.refundedAt ? new Date(r.refundedAt).toLocaleDateString() : "",
      ].join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `staff-ticket-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  const totals = {
    issued: rows.filter((r) => ["ticketed", "issued"].includes(r.status)).length,
    cancelled: rows.filter((r) => r.status === "cancelled").length,
    refunded: rows.filter((r) => r.status === "refunded").length,
    totalAmount: rows.filter((r) => ["ticketed", "issued"].includes(r.status)).reduce((s, r) => s + r.amount, 0),
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Staff Ticket Log</h1>
          <p className="text-muted-foreground text-sm mt-1">Full history of issued, cancelled, and refunded tickets</p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Issued", value: totals.issued, color: "text-green-600" },
          { label: "Cancelled", value: totals.cancelled, color: "text-red-600" },
          { label: "Refunded", value: totals.refunded, color: "text-blue-600" },
          { label: "Revenue (PKR)", value: totals.totalAmount.toLocaleString(), color: "text-gray-900" },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div>
          <Label>From Date</Label>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1 w-40" />
        </div>
        <div className="w-40">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="ticketed">Ticketed</SelectItem>
              <SelectItem value="issued">Issued</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="refund_pending">Refund Pending</SelectItem>
              <SelectItem value="refunded">Refunded</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No tickets match the selected filters</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket / PNR</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Issued At</TableHead>
                  <TableHead>Cancelled At</TableHead>
                  <TableHead>Refunded At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-mono text-sm">{r.ticketNumber || "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.pnr || "—"}</div>
                    </TableCell>
                    <TableCell className="font-medium">{r.passenger}</TableCell>
                    <TableCell>{r.airline || "—"}</TableCell>
                    <TableCell className="text-sm">{r.route}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {r.amount.toLocaleString()} {r.currency}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[r.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {r.status.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">{r.issuedByName || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.cancelledAt ? new Date(r.cancelledAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.refundedAt ? new Date(r.refundedAt).toLocaleDateString() : "—"}
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
