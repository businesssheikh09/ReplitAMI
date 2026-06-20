import React from "react";
import { useGetWebsiteConfig } from "@workspace/api-client-react";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { AboutSection } from "@/components/about-section";
import { PackagesSection } from "@/components/packages-section";
import { ExperienceSection } from "@/components/experience-section";
import { Footer } from "@/components/footer";
import { X } from "lucide-react";
import { useState } from "react";

export default function Landing() {
  const { data: config } = useGetWebsiteConfig();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const showBanner = config?.announcementEnabled && config?.announcementBanner && !bannerDismissed;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showBanner && (
        <div className="relative z-[60] bg-primary text-primary-foreground text-sm text-center py-2.5 px-10">
          {config.announcementBanner}
          <button
            onClick={() => setBannerDismissed(true)}
            className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100 transition-opacity"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <Navbar />
      <main className="flex-1">
        <HeroSection />
        <AboutSection />
        <PackagesSection />
        <ExperienceSection />
      </main>
      <Footer />
    </div>
  );
}
