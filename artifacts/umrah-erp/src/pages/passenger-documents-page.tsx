import PassengerDocumentsPanel from "./passenger-documents";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function PassengerDocumentsPage() {
  const [quotationId, setQuotationId] = useState<number | undefined>();
  const [inputVal, setInputVal] = useState("");

  function handleFilter() {
    const n = parseInt(inputVal);
    setQuotationId(isNaN(n) ? undefined : n);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Passenger Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Upload and manage passport / CNIC images with OCR extraction for flight passengers
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div>
          <Label>Filter by Flight Quotation ID (optional)</Label>
          <Input
            type="number"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Leave blank to see all"
            className="mt-1 w-52"
          />
        </div>
        <Button onClick={handleFilter}>Apply Filter</Button>
        {quotationId && (
          <Button variant="outline" onClick={() => { setQuotationId(undefined); setInputVal(""); }}>
            Clear Filter
          </Button>
        )}
      </div>

      <PassengerDocumentsPanel flightQuotationId={quotationId} />
    </div>
  );
}
