import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  MapPin, 
  Beer, 
  Navigation, 
  Settings, 
  ChevronRight, 
  ChevronLeft, 
  Loader2,
  GlassWater,
  Search,
  ArrowRight,
  Info,
  Dices
} from "lucide-react";
import { generatePubCrawl } from "../services/geminiService";
import { PubCrawl, Pub } from "../types";
import { cn } from "../lib/utils";
import DrinkGenerator from "./DrinkGenerator";

export default function PubCrawlPlanner() {
  const [location, setLocation] = useState("");
  const [numPubs, setNumPubs] = useState(4);
  const [maxDist, setMaxDist] = useState(500);
  const [loading, setLoading] = useState(false);
  const [crawl, setCrawl] = useState<PubCrawl | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Auto-detect location on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude}, ${longitude}`);
        },
        (err) => {
          console.warn("Geolocation failed", err);
        }
      );
    }
  }, []);

  const handleGenerate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!location) {
      setError("Please enter a location or allow geolocation.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const result = await generatePubCrawl(location, numPubs, maxDist);
      setCrawl(result);
      setCurrentIndex(0);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const nextPub = () => {
    if (crawl && currentIndex < crawl.pubs.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const prevPub = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const currentPub = crawl?.pubs[currentIndex];
  const nextVenue = crawl?.pubs[currentIndex + 1];

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/50 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Beer className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-xl tracking-tight">PubScout</span>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCrawl(null)}
              className="text-sm font-medium text-white/60 hover:text-white transition-colors"
            >
              New Plan
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {!crawl ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            <div className="text-center space-y-4">
              <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-b from-white to-white/50 bg-clip-text text-transparent">
                Your Next Adventure <br /> Starts Here.
              </h1>
              <p className="text-white/60 text-lg max-w-lg mx-auto">
                Discover the best local pubs and plan a seamless crawl with pre-order menus.
              </p>
            </div>

            <form onSubmit={handleGenerate} className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10 backdrop-blur-sm">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-white/40">Location</label>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input 
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Enter city or area..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Pubs Count</label>
                  <select 
                    value={numPubs}
                    onChange={(e) => setNumPubs(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
                  >
                    {[3, 4, 5, 6, 7, 8].map(n => (
                      <option key={n} value={n} className="bg-neutral-900">{n} Pubs</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-widest text-white/40">Max Distance (m)</label>
                  <select 
                    value={maxDist}
                    onChange={(e) => setMaxDist(Number(e.target.value))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/50 appearance-none"
                  >
                    {[200, 500, 1000, 2000].map(d => (
                      <option key={d} value={d} className="bg-neutral-900">{d}m</option>
                    ))}
                  </select>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-black font-bold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 group"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Generate Crawl
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              
              {error && (
                <p className="text-red-400 text-sm text-center font-medium">{error}</p>
              )}
            </form>
          </motion.div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar: Route Overview */}
            <div className="lg:col-span-4 space-y-6">
              <div className="bg-white/5 rounded-3xl border border-white/10 p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-xl">{crawl.name}</h2>
                  <span className="text-xs font-mono text-white/40">{crawl.totalDistance}m total</span>
                </div>
                
                <div className="space-y-4 relative">
                  {/* Vertical line connector */}
                  <div className="absolute left-4 top-4 bottom-4 w-px bg-white/10" />
                  
                  {crawl.pubs.map((pub, idx) => (
                    <button
                      key={pub.id}
                      onClick={() => setCurrentIndex(idx)}
                      className={cn(
                        "w-full flex items-start gap-4 p-3 rounded-2xl transition-all relative z-10",
                        currentIndex === idx ? "bg-orange-500 text-black" : "hover:bg-white/5 text-white/60"
                      )}
                    >
                      <div className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border",
                        currentIndex === idx ? "bg-black text-orange-500 border-black" : "bg-neutral-900 border-white/10"
                      )}>
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <p className="font-bold leading-tight">{pub.name}</p>
                        <p className={cn(
                          "text-xs mt-1",
                          currentIndex === idx ? "text-black/70" : "text-white/40"
                        )}>
                          {idx === 0 ? "Start" : `${pub.distanceFromPrevious}m from last`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Content: Active Pub & Next Pub */}
            <div className="lg:col-span-8 space-y-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {/* Current Pub Card */}
                  <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                    <div className="p-8 md:p-12 space-y-8">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-widest">
                            <MapPin className="w-4 h-4" />
                            Current Stop
                          </div>
                          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{currentPub?.name}</h1>
                          <p className="text-white/60 max-w-xl">{currentPub?.description}</p>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={prevPub}
                            disabled={currentIndex === 0}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-all"
                          >
                            <ChevronLeft className="w-6 h-6" />
                          </button>
                          <button 
                            onClick={nextPub}
                            disabled={currentIndex === crawl.pubs.length - 1}
                            className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 transition-all"
                          >
                            <ChevronRight className="w-6 h-6" />
                          </button>
                        </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        {/* Pre-order Menu */}
                        <div className="space-y-4">
                          <h3 className="flex items-center gap-2 font-bold text-lg">
                            <GlassWater className="w-5 h-5 text-orange-500" />
                            Order Ahead
                          </h3>
                          <div className="space-y-2">
                            {currentPub?.drinks.map((drink, i) => (
                              <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all group cursor-pointer">
                                <div>
                                  <p className="font-bold">{drink.name}</p>
                                  <p className="text-xs text-white/40">{drink.category}</p>
                                </div>
                                <div className="flex items-center gap-4">
                                  <span className="font-mono text-orange-500">{drink.price}</span>
                                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-orange-500 group-hover:text-black transition-all">
                                    <ChevronRight className="w-4 h-4" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Next Venue Preview */}
                        <div className="space-y-4">
                          <h3 className="flex items-center gap-2 font-bold text-lg">
                            <Navigation className="w-5 h-5 text-orange-500" />
                            Next Stop
                          </h3>
                          {nextVenue ? (
                            <div className="p-6 rounded-3xl bg-orange-500/10 border border-orange-500/20 space-y-4">
                              <div>
                                <p className="text-orange-500 font-bold">{nextVenue.name}</p>
                                <p className="text-sm text-white/60 line-clamp-2 mt-1">{nextVenue.description}</p>
                              </div>
                              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-widest text-white/40">
                                <span>{nextVenue.distanceFromPrevious}m away</span>
                                <span>•</span>
                                <span>~{Math.round(nextVenue.distanceFromPrevious / 80)} min walk</span>
                              </div>
                              <button 
                                onClick={nextPub}
                                className="w-full py-3 rounded-xl bg-orange-500 text-black font-bold text-sm hover:bg-orange-400 transition-all"
                              >
                                View Menu
                              </button>
                            </div>
                          ) : (
                            <div className="p-12 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-2">
                              <Info className="w-8 h-8 text-white/20" />
                              <p className="text-white/40 font-medium">Last stop! Enjoy your night.</p>
                            </div>
                          )}

                          {/* Drink Wheel for Next Venue */}
                          {nextVenue && (
                            <div className="mt-8 space-y-4">
                              <h3 className="flex items-center gap-2 font-bold text-lg">
                                <Dices className="w-5 h-5 text-orange-500" />
                                Indecisive?
                              </h3>
                              <DrinkGenerator drinks={nextVenue.drinks} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
