import { useState, useEffect } from "react";
import { useGetWebsiteConfig, useUpdateWebsiteConfig } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Globe, Save, Loader2, RefreshCw, ExternalLink } from "lucide-react";

type ConfigDraft = {
  siteName: string;
  heroBadge: string;
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutBody: string;
  packagesTitle: string;
  packagesSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactWhatsapp: string;
  announcementBanner: string;
  announcementEnabled: boolean;
};

export default function WebsiteSettingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: config, isLoading } = useGetWebsiteConfig();
  const updateConfig = useUpdateWebsiteConfig({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/website-config"] });
        toast({ title: "Website settings saved", description: "Changes are now live on the public website." });
      },
      onError: () => {
        toast({ title: "Failed to save", variant: "destructive" });
      },
    },
  });

  const [draft, setDraft] = useState<ConfigDraft | null>(null);

  useEffect(() => {
    if (config && !draft) {
      setDraft({
        siteName: config.siteName,
        heroBadge: config.heroBadge,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        aboutTitle: config.aboutTitle,
        aboutBody: config.aboutBody,
        packagesTitle: config.packagesTitle,
        packagesSubtitle: config.packagesSubtitle,
        contactEmail: config.contactEmail,
        contactPhone: config.contactPhone,
        contactWhatsapp: config.contactWhatsapp,
        announcementBanner: config.announcementBanner,
        announcementEnabled: config.announcementEnabled,
      });
    }
  }, [config, draft]);

  const set = (field: keyof ConfigDraft, value: string | boolean) =>
    setDraft(prev => prev ? { ...prev, [field]: value } : prev);

  const handleSave = () => {
    if (!draft) return;
    updateConfig.mutate({ data: draft });
  };

  const handleReset = () => {
    if (config) {
      setDraft({
        siteName: config.siteName,
        heroBadge: config.heroBadge,
        heroTitle: config.heroTitle,
        heroSubtitle: config.heroSubtitle,
        aboutTitle: config.aboutTitle,
        aboutBody: config.aboutBody,
        packagesTitle: config.packagesTitle,
        packagesSubtitle: config.packagesSubtitle,
        contactEmail: config.contactEmail,
        contactPhone: config.contactPhone,
        contactWhatsapp: config.contactWhatsapp,
        announcementBanner: config.announcementBanner,
        announcementEnabled: config.announcementEnabled,
      });
    }
  };

  if (isLoading || !draft) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Website Settings
          </h2>
          <p className="text-muted-foreground">Edit the public website content. Changes go live instantly.</p>
        </div>
        <div className="flex gap-2">
          <a href="/frontend/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview Site
            </Button>
          </a>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={handleSave} disabled={updateConfig.isPending}>
            {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Announcement Banner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Announcement Banner</CardTitle>
              <CardDescription>Displays a notice at the top of the public website.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="announcement-toggle" className="text-sm text-muted-foreground">
                {draft.announcementEnabled ? "Visible" : "Hidden"}
              </Label>
              <Switch
                id="announcement-toggle"
                checked={draft.announcementEnabled}
                onCheckedChange={v => set("announcementEnabled", v)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Input
            value={draft.announcementBanner}
            onChange={e => set("announcementBanner", e.target.value)}
            placeholder="e.g. Ramadan special: 15% off all packages — Book before April 30"
          />
        </CardContent>
      </Card>

      {/* Brand & Site Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Brand Identity</CardTitle>
          <CardDescription>The site name shown in the navbar and browser tab.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Site / Brand Name</Label>
            <Input value={draft.siteName} onChange={e => set("siteName", e.target.value)} placeholder="Noor Al-Haram" />
          </div>
        </CardContent>
      </Card>

      {/* Hero Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Hero Section
            <Badge variant="outline" className="text-xs font-normal">Full-screen banner at the top</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Badge Text <span className="text-xs text-muted-foreground">(small label above headline)</span></Label>
            <Input value={draft.heroBadge} onChange={e => set("heroBadge", e.target.value)} placeholder="Sacred Journeys from Pakistan" />
          </div>
          <div className="space-y-2">
            <Label>Headline</Label>
            <Input value={draft.heroTitle} onChange={e => set("heroTitle", e.target.value)} placeholder="Answer the call to the House of Allah." />
          </div>
          <div className="space-y-2">
            <Label>Subheadline</Label>
            <Textarea rows={3} value={draft.heroSubtitle} onChange={e => set("heroSubtitle", e.target.value)} placeholder="Curated Umrah experiences..." />
          </div>
        </CardContent>
      </Card>

      {/* About Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            About / Our Promise Section
            <Badge variant="outline" className="text-xs font-normal">Second section on the page</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input value={draft.aboutTitle} onChange={e => set("aboutTitle", e.target.value)} placeholder="Your worship is your only focus." />
          </div>
          <div className="space-y-2">
            <Label>Body Text</Label>
            <Textarea rows={4} value={draft.aboutBody} onChange={e => set("aboutBody", e.target.value)} placeholder="Describe the agency's mission..." />
          </div>
        </CardContent>
      </Card>

      {/* Packages Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Packages Section Header
            <Badge variant="outline" className="text-xs font-normal">Above the package cards</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Section Title</Label>
            <Input value={draft.packagesTitle} onChange={e => set("packagesTitle", e.target.value)} placeholder="Curated Journeys" />
          </div>
          <div className="space-y-2">
            <Label>Section Subtitle</Label>
            <Textarea rows={2} value={draft.packagesSubtitle} onChange={e => set("packagesSubtitle", e.target.value)} placeholder="Carefully structured packages..." />
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Information</CardTitle>
          <CardDescription>Shown in the website footer and contact sections.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" value={draft.contactEmail} onChange={e => set("contactEmail", e.target.value)} placeholder="info@nooralharam.com" />
            </div>
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input value={draft.contactPhone} onChange={e => set("contactPhone", e.target.value)} placeholder="+92 21 3456 7890" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>WhatsApp Number <span className="text-xs text-muted-foreground">(with country code, no spaces)</span></Label>
            <Input value={draft.contactWhatsapp} onChange={e => set("contactWhatsapp", e.target.value)} placeholder="+923001234567" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end pb-8">
        <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg">
          {updateConfig.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
    </div>
  );
}
