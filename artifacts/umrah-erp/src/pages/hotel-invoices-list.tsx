import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ExternalLink, Hotel } from "lucide-react";
import { useAuth } from "@/lib/auth";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  invoiced: "bg-blue-100 text-blue-700",
};

const WRITE_ROLES = ["accounts", "management", "admin"];

export default function HotelInvoicesListPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const canWrite = WRITE_ROLES.includes(user?.role ?? "");
  const [search, setSearch] = useState("");

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/invoices/hotel"],
    queryFn: () => fetch("/api/invoices/hotel").then(r => r.json()),
  });

  const q = search.toLowerCase();
  const filtered = q
    ? invoices.filter((inv) =>
        (inv.dnNumber || "").toLowerCase().includes(q) ||
        (inv.partyName || "").toLowerCase().includes(q) ||
        (inv.passengerName || "").toLowerCase().includes(q) ||
        (inv.hotelName || "").toLowerCase().includes(q) ||
        (inv.status || "").toLowerCase().includes(q)
      )
    : invoices;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Hotel className="h-6 w-6 text-blue-700" />
            Hotel Invoices (DN)
          </h2>
          <p className="text-muted-foreground text-sm">View hotel voucher invoices.</p>
        </div>
        {canWrite && (
          <Button onClick={() => setLocation("/accounting/hotel-invoice/new")} className="bg-blue-700 hover:bg-blue-800 text-white">
            New DN Invoice
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">{filtered.length} invoice{filtered.length !== 1 ? "s" : ""}</CardTitle>
            <Input
              placeholder="Search DN#, party, hotel, passenger, status…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs h-8 text-sm"
            />
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center text-muted-foreground">Loading…</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>DN #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Party/Client</TableHead>
                  <TableHead>Passenger</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Check In</TableHead>
                  <TableHead>Check Out</TableHead>
                  <TableHead className="text-center">Nights</TableHead>
                  <TableHead className="text-right">Recv SAR</TableHead>
                  <TableHead className="text-right">Pay SAR</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={12} className="text-center h-32 text-muted-foreground">
                      {q ? "No matching invoices." : "No hotel invoices yet."}
                    </TableCell>
                  </TableRow>
                ) : filtered.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="hover:bg-muted/50 cursor-pointer"
                    onClick={() => setLocation(`/accounting/hotel-invoice/${inv.id}`)}
                  >
                    <TableCell className="font-mono font-semibold text-blue-700">{inv.dnNumber}</TableCell>
                    <TableCell className="text-sm">{inv.invoiceDate}</TableCell>
                    <TableCell className="font-medium">{inv.partyName || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.passengerName || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.hotelName || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.checkIn || "—"}</TableCell>
                    <TableCell className="text-sm">{inv.checkOut || "—"}</TableCell>
                    <TableCell className="text-center">{inv.noOfNights ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.receivableSar != null ? Number(inv.receivableSar).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {inv.payableSar != null ? Number(inv.payableSar).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[inv.status] || "bg-gray-100"}`}>
                        {inv.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={e => { e.stopPropagation(); setLocation(`/accounting/hotel-invoice/${inv.id}`); }}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
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
