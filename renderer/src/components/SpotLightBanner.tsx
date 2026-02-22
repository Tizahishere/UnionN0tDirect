// renderer/src/components/SpotlightBanner.tsx
import React, { useEffect, useState, useMemo } from "react";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from "@/components/ui/carousel";

interface SpotlightProps {
  items: { appid: string; name: string; image: string; tagline?: string }[];
  autoPlayMs?: number;
}
// bro this shit doesnt even work  PLEASE UNION DIRECT REFINED STOP SHOWING POR-
const allowedGames = new Set([
  "Red Dead Redemption 1",
  "Undertale",
  "Deltarune",
  "Red Dead Redemption 2",
  "CyberPunk",
  "Grand Theft Auto V Enhanced",
  "Grand Theft Auto V Legacy"
]);

export const SpotlightBanner: React.FC<SpotlightProps> = ({ items, autoPlayMs = 7000 }) => {
  const [idx, setIdx] = useState(0);


  const filteredItems = useMemo(
    () => items.filter((it) => allowedGames.has(it.name)),
    [items]
  );

  useEffect(() => {
    if (!filteredItems.length) return;

    const t = setInterval(
      () => setIdx((p) => (p + 1) % filteredItems.length),
      autoPlayMs
    );

    return () => clearInterval(t);
  }, [filteredItems.length, autoPlayMs]);

  if (!filteredItems || filteredItems.length === 0) return null;

  return (
    <div className="rounded-2xl overflow-hidden mb-6">
      <Carousel opts={{ align: "center", loop: true, skipSnaps: false }}>
        <CarouselContent className="h-56 md:h-72">
          {filteredItems.map((it) => (
            <CarouselItem key={it.appid} className="h-56 md:h-72">
              <div
                className="w-full h-full bg-cover bg-center flex items-end"
                style={{ backgroundImage: `url(${it.image || "/banner.png"})` }}
              >
                <div className="bg-gradient-to-t from-black/70 to-transparent w-full p-6">
                  <h3 className="text-2xl font-bold text-white">{it.name}</h3>
                  {it.tagline && <div className="text-sm text-white/90 mt-1">{it.tagline}</div>}
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>

        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
};

export default SpotlightBanner;