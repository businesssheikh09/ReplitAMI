import React from "react";
import aboutImg from "@/assets/about.png";

export function AboutSection() {
  return (
    <section id="about" className="py-24 md:py-32 bg-background relative overflow-hidden">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl relative">
              <img 
                src={aboutImg} 
                alt="Light through latticed windows" 
                className="w-full h-full object-cover transition-transform duration-700 hover:scale-105"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-2xl pointer-events-none"></div>
            </div>
            {/* Decorative block */}
            <div className="absolute -bottom-6 -right-6 w-48 h-48 bg-secondary rounded-2xl -z-10 opacity-50"></div>
            <div className="absolute -top-6 -left-6 w-32 h-32 border border-primary/20 rounded-2xl -z-10"></div>
          </div>
          
          <div className="order-1 lg:order-2 flex flex-col justify-center">
            <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-6">
              Your worship is your only focus.
            </h2>
            <div className="h-1 w-20 bg-primary mb-8 rounded-full"></div>
            <div className="space-y-6 text-lg text-muted-foreground font-light leading-relaxed">
              <p>
                The journey to Makkah and Madinah is not a vacation; it is a profound spiritual return. Yet, the logistics of travel can often cloud the quiet reverence of the heart.
              </p>
              <p>
                At Noor Al-Haram, we believe our duty is to carry the entire worldly burden of your journey. From the moment you leave your home in Pakistan to the moment you step onto the cool marble of the Haram, we manage every detail with invisible precision.
              </p>
              <p className="font-medium text-foreground">
                No worrying about transfers. No confusion over hotels. Just you, your prayers, and the profound peace of the sacred sanctuaries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
