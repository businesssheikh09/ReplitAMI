import React from "react";
import { Navbar } from "@/components/navbar";
import { HeroSection } from "@/components/hero-section";
import { AboutSection } from "@/components/about-section";
import { PackagesSection } from "@/components/packages-section";
import { ExperienceSection } from "@/components/experience-section";
import { Footer } from "@/components/footer";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
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
