import { useListDocuments } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Files, Download, FileText, Receipt, Plane } from "lucide-react";

const DOC_ICONS: Record<string, React.ElementType> = {
  quotation: FileText,
  invoice: Receipt,
  itinerary: Plane,
};

export default function DocumentsPage() {
  const { data: documents = [], isLoading } = useListDocuments({});
  const docs = documents as any[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Documents</h2>
        <p className="text-muted-foreground">Generated quotations, invoices, and itineraries.</p>
      </div>

      {isLoading ? (
        <div className="h-40 flex items-center justify-center text-muted-foreground">Loading...</div>
      ) : docs.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 text-center">
            <Files className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No documents generated yet.</p>
            <p className="text-sm text-muted-foreground mt-1">Documents are auto-generated when you send quotations or invoices.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {docs.map((d: any) => {
            const Icon = DOC_ICONS[d.type] || Files;
            return (
              <Card key={d.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-4 flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-blue-100"><Icon className="h-5 w-5 text-blue-600" /></div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{d.title}</div>
                    {d.clientName && <div className="text-xs text-muted-foreground">{d.clientName}</div>}
                    <Badge variant="outline" className="mt-1 text-xs">{d.type}</Badge>
                  </div>
                  <a href={d.url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost"><Download className="h-4 w-4" /></Button>
                  </a>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
