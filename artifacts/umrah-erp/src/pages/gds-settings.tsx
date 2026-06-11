import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plane, CheckCircle2, XCircle, Loader2, Settings2, AlertCircle } from "lucide-react";

const PROVIDERS = [
  {
    id: "amadeus",
    name: "Amadeus GDS",
    description: "Amadeus Global Distribution System — Flight Offers Search API",
    pcc: "ISBPK3367",
    logo: "✈",
    color: "from-blue-600 to-blue-800",
    fields: ["clientId", "clientSecret"],
    fieldLabels: { clientId: "API Key (Client ID)", clientSecret: "API Secret (Client Secret)" },
    docs: "https://developers.amadeus.com",
    notes: "Get credentials from Amadeus for Developers portal. Test environment available for free.",
  },
  {
    id: "sabre",
    name: "Sabre GDS",
    description: "Sabre Global Distribution System — Bargain Finder Max API",
    pcc: "V948",
    logo: "🌐",
    color: "from-red-600 to-red-800",
    fields: ["clientId", "clientSecret"],
    fieldLabels: { clientId: "Client ID (EPR)", clientSecret: "Client Secret" },
    docs: "https://developer.sabre.com",
    notes: "Uses OAuth2. PCC V948 is your Sabre pseudo city code. Test: api.cert.sabre.com",
  },
  {
    id: "galileo",
    name: "Galileo / Travelport",
    description: "Travelport Universal API (Galileo GDS)",
    pcc: "3PX1",
    logo: "🌍",
    color: "from-emerald-600 to-emerald-800",
    fields: ["username", "password"],
    fieldLabels: { username: "Username", password: "Password" },
    docs: "https://developer.travelport.com",
    notes: "Uses HTTP Basic Auth. PCC 3PX1 is your Galileo access group. Test: americas.universal-api.pp.travelport.com",
  },
];

type ProviderForm = {
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  pcc: string;
  iataCode: string;
  environment: string;
  isActive: boolean;
};

const DEFAULT_FORM: ProviderForm = {
  clientId: "", clientSecret: "", username: "", password: "",
  pcc: "", iataCode: "", environment: "test", isActive: false,
};

export default function GdsSettingsPage() {
  const { toast } = useToast();
  const [forms, setForms] = useState<Record<string, ProviderForm>>(
    Object.fromEntries(PROVIDERS.map(p => [p.id, { ...DEFAULT_FORM, pcc: p.pcc }]))
  );
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string } | null>>({});

  useEffect(() => {
    PROVIDERS.forEach(async (p) => {
      try {
        const r = await fetch(`/api/gds-settings/${p.id}`);
        if (r.ok) {
          const data = await r.json();
          if (data) {
            setForms(prev => ({
              ...prev,
              [p.id]: {
                clientId: data.clientId || "",
                clientSecret: data.clientSecret || "",
                username: data.username || "",
                password: data.password || "",
                pcc: data.pcc || p.pcc,
                iataCode: data.iataCode || "",
                environment: data.environment || "test",
                isActive: data.isActive || false,
              },
            }));
          }
        }
      } catch { /* ignore */ }
    });
  }, []);

  const handleSave = async (providerId: string) => {
    setSaving(prev => ({ ...prev, [providerId]: true }));
    try {
      const r = await fetch(`/api/gds-settings/${providerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(forms[providerId]),
      });
      if (!r.ok) throw new Error("Save failed");
      toast({ title: `${PROVIDERS.find(p => p.id === providerId)?.name} settings saved` });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally {
      setSaving(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const handleTest = async (providerId: string) => {
    setTesting(prev => ({ ...prev, [providerId]: true }));
    setTestResults(prev => ({ ...prev, [providerId]: null }));
    try {
      const r = await fetch(`/api/gds-settings/${providerId}/test`, { method: "POST" });
      const data = await r.json();
      setTestResults(prev => ({ ...prev, [providerId]: data }));
    } catch {
      setTestResults(prev => ({ ...prev, [providerId]: { success: false, message: "Connection failed" } }));
    } finally {
      setTesting(prev => ({ ...prev, [providerId]: false }));
    }
  };

  const setField = (provider: string, field: string, value: string | boolean) => {
    setForms(prev => ({ ...prev, [provider]: { ...prev[provider], [field]: value } }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Settings2 className="h-6 w-6" />
          GDS Settings
        </h2>
        <p className="text-muted-foreground mt-1">
          Configure your Amadeus, Sabre, and Galileo GDS credentials for live flight search.
          Use <strong>Test</strong> environment until you're ready to go live.
        </p>
      </div>

      <div className="grid gap-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <strong>Test Mode Active</strong> — When credentials are not configured or inactive, the search engine returns
            realistic sample fares for testing. Toggle <em>Active</em> and save your credentials to enable live GDS queries.
            Your PCCs are pre-filled: Sabre <code className="bg-amber-100 px-1 rounded">V948</code> · Amadeus <code className="bg-amber-100 px-1 rounded">ISBPK3367</code> · Galileo <code className="bg-amber-100 px-1 rounded">3PX1</code>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1">
        {PROVIDERS.map((provider) => {
          const form = forms[provider.id] || DEFAULT_FORM;
          const testResult = testResults[provider.id];
          return (
            <Card key={provider.id} className="overflow-hidden">
              <div className={`bg-gradient-to-r ${provider.color} p-4 text-white`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{provider.logo}</span>
                    <div>
                      <h3 className="font-bold text-lg">{provider.name}</h3>
                      <p className="text-white/80 text-sm">{provider.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className={form.isActive ? "bg-green-400 text-green-900" : "bg-white/20 text-white"}>
                      {form.isActive ? "Active" : "Inactive"}
                    </Badge>
                    <Switch
                      checked={form.isActive}
                      onCheckedChange={(v) => setField(provider.id, "isActive", v)}
                    />
                  </div>
                </div>
              </div>

              <CardContent className="pt-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {provider.fields.map((field) => (
                    <div key={field} className="space-y-1.5">
                      <Label>{(provider.fieldLabels as any)[field]}</Label>
                      <Input
                        type={field.toLowerCase().includes("secret") || field === "password" ? "password" : "text"}
                        value={(form as any)[field]}
                        onChange={e => setField(provider.id, field, e.target.value)}
                        placeholder={field === "clientId" || field === "username" ? `Enter ${(provider.fieldLabels as any)[field]}` : "Enter secret"}
                      />
                    </div>
                  ))}

                  <div className="space-y-1.5">
                    <Label>PCC (Pseudo City Code)</Label>
                    <Input
                      value={form.pcc}
                      onChange={e => setField(provider.id, "pcc", e.target.value)}
                      placeholder={provider.pcc}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>IATA Code</Label>
                    <Input
                      value={form.iataCode}
                      onChange={e => setField(provider.id, "iataCode", e.target.value)}
                      placeholder="e.g. PKX3367"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Environment</Label>
                    <Select value={form.environment} onValueChange={v => setField(provider.id, "environment", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="test">Test / Sandbox</SelectItem>
                        <SelectItem value="production">Production (Live)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
                  {provider.notes} — <a href={provider.docs} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{provider.docs}</a>
                </div>

                {testResult && (
                  <div className={`flex items-center gap-2 text-sm p-2 rounded ${testResult.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                    {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    {testResult.message}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t">
                  <Button variant="outline" onClick={() => handleTest(provider.id)} disabled={testing[provider.id]}>
                    {testing[provider.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Test Connection
                  </Button>
                  <Button onClick={() => handleSave(provider.id)} disabled={saving[provider.id]}>
                    {saving[provider.id] ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Save Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
