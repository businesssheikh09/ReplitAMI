import React from "react";
import heroBg from "@/assets/hero.png";
import patternBg from "@/assets/pattern.png";

export function HeroSection() {
  return (
    <section className="relative min-h-[95vh] flex items-center justify-center overflow-hidden pt-20">
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={heroBg} 
          alt="Kaaba at dawn" 
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-background"></div>
      </div>
      
      {/* Texture overlay */}
      <div 
        className="absolute inset-0 z-0 opacity-10 mix-blend-overlay pointer-events-none"
        style={{ backgroundImage: `url(${patternBg})`, backgroundSize: 'cover' }}
      ></div>

      <div className="container relative z-10 mx-auto px-4 md:px-6 flex flex-col items-center text-center mt-12">
        <span className="inline-block py-1 px-3 rounded-full bg-background/10 backdrop-blur-md border border-white/20 text-white text-sm font-medium tracking-widest uppercase mb-6">
          Sacred Journeys from Pakistan
        </span>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white font-medium tracking-tight mb-6 max-w-5xl text-shadow-lg">
          Answer the call to the House of Allah.
        </h1>
        <p className="text-lg md:text-xl text-white/90 max-w-2xl font-light mb-10 text-shadow">
          Curated Umrah experiences that remove every worldly distraction, 
          leaving you entirely present for the most profound journey of your life.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <a 
            href="#packages"
            className="inline-flex h-12 items-center justify-center rounded-md bg-white px-8 py-2 text-base font-medium text-primary shadow transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View Our Packages
          </a>
          <a 
            href="#about"
            className="inline-flex h-12 items-center justify-center rounded-md border border-white/30 bg-black/20 backdrop-blur-sm px-8 py-2 text-base font-medium text-white shadow-sm transition-colors hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Our Philosophy
          </a>
        </div>
      </div>
    </section>
  );
}
