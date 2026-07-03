import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Download, Printer } from "lucide-react";

interface BspRow {
  id: number;
  ticketNumber: string;
  pnr: string;
  airline: string;
  passenger: string;
  route: string;
  fare: number;
  currency: string;
  airlineCommission: number;
  commissionRate: number;
  netPayable: number;
  issuedAt: string | null;
  issuedByName: string | null;
  status: string;
}

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BspReportPage() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [airline, setAirline] = useState("");

  const params = new URLSearchParams();
  if (fromDate) params.set("fromDate", fromDate);
  if (toDate) params.set("toDate", toDate);
  if (airline) params.set("airline", airline);

  const { data: rows = [], isLoading } = useQuery<BspRow[]>({
    queryKey: ["bsp-report", fromDate, toDate, airline],
    queryFn: () =>
      fetch(`/api/bsp-report?${params}`, { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const totalFare = rows.reduce((s, r) => s + r.fare, 0);
  const totalCommission = rows.reduce((s, r) => s + r.airlineCommission, 0);
  const totalNet = rows.reduce((s, r) => s + r.netPayable, 0);

  function exportCsv() {
    const header = "Ticket No,PNR,Airline,Passenger,Route,Fare,Commission,Commission %,Net Payable,Issued At,Issued By,Status";
    const csvRows = rows.map((r) =>
      [
        r.ticketNumber, r.pnr, r.airline, r.passenger, r.route,
        r.fare, r.airlineCommission, r.commissionRate, r.netPayable,
        r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : "",
        r.issuedByName, r.status,
      ].join(",")
    );
    const blob = new Blob([[header, ...csvRows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bsp-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">BSP Settlement Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Airline-wise ticket settlement and commission tracking</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" /> Print
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="print:hidden">
        <CardContent className="pt-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Airline Code</Label>
              <Input value={airline} onChange={(e) => setAirline(e.target.value)} placeholder="e.g. PK, EK…" className="mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-base">
            Al Musafir International — BSP Settlement
            {fromDate && ` (${fromDate}${toDate ? ` to ${toDate}` : ""})`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No issued tickets found for selected filters</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticket No</TableHead>
                  <TableHead>PNR</TableHead>
                  <TableHead>Airline</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead className="text-right">Fare</TableHead>
                  <TableHead className="text-right">Commission</TableHead>
                  <TableHead className="text-right">Comm %</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                  <TableHead>Date Issued</TableHead>
                  <TableHead>Issued By</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-sm">{r.ticketNumber || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{r.pnr || "—"}</TableCell>
                    <TableCell>{r.airline || "—"}</TableCell>
                    <TableCell>{r.passenger}</TableCell>
                    <TableCell className="text-sm">{r.route}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.fare)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(r.airlineCommission)}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.commissionRate > 0 ? `${r.commissionRate}%` : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmt(r.netPayable)}</TableCell>
                    <TableCell className="text-sm">
                      {r.issuedAt ? new Date(r.issuedAt).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{r.issuedByName || "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${r.status === "refunded" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {r.status}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="font-bold">
                  <TableCell colSpan={5} className="text-right">TOTALS</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totalFare)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(totalCommission)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right tabular-nums">{fmt(totalNet)}</TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
