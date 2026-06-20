import React from "react";
import madinahImg from "@/assets/madinah.png";
import datesImg from "@/assets/dates.png";

export function ExperienceSection() {
  return (
    <section id="experience" className="py-24 bg-background">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div>
            <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-6">
              The tranquility of Madinah.
            </h2>
            <div className="space-y-4 text-lg text-muted-foreground font-light">
              <p>
                Transitioning from the awe of Makkah to the serenity of Madinah is a profound shift in the soul. We ensure this journey is seamless.
              </p>
              <p>
                Our transport arrangements are scheduled to maximize your time in the Prophet's Mosque. Whether by high-speed Haramain train or comfortable AC coaches, your arrival in the city of light is peaceful and dignified.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-full overflow-hidden shadow-xl max-w-[400px] mx-auto lg:ml-auto ring-4 ring-background outline outline-1 outline-border">
              <img src={madinahImg} alt="Masjid al-Nabawi" className="w-full h-full object-cover" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="order-2 lg:order-1 relative">
            <div className="aspect-[4/3] rounded-t-[100px] rounded-b-xl overflow-hidden shadow-xl">
              <img src={datesImg} alt="Ajwa dates and Zamzam" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="text-3xl md:text-5xl font-serif text-foreground mb-6">
              Details that honor the tradition.
            </h2>
            <div className="space-y-4 text-lg text-muted-foreground font-light">
              <p>
                We believe that premium service is found in the smallest, most thoughtful details. It is the cold bottle of water handed to you after a long journey, the guidance of knowledgeable scholars, and the authentic hospitality that welcomes you.
              </p>
              <p>
                From complimentary Ihram garments and instructional guides before departure, to ensuring premium dates and Zamzam water are accessible, we honor the traditions of hospitality that the region is known for.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
