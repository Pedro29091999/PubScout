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
  Dices,
  Globe,
  Phone,
  Clock,
  Car,
  CreditCard,
  RefreshCw,
  LocateFixed,
  ExternalLink,
  Sparkles
} from "lucide-react";
import { 
  fetchAllAvailablePubs, 
  createCrawlFromPubs, 
  fetchTaxis, 
  fetchAccurateMenu 
} from "../services/pubService";
import { PubCrawl, Pub, Taxi } from "../types";
import { cn } from "../lib/utils";
import DrinkGenerator from "./DrinkGenerator";
import MapComponent from "./MapComponent";

export default function PubCrawlPlanner() {
  const [location, setLocation] = useState("");
  const [numPubs, setNumPubs] = useState(4);
  const [maxDist, setMaxDist] = useState(500);
  const [loading, setLoading] = useState(false);
  const [crawl, setCrawl] = useState<PubCrawl | null>(null);
  const [allAvailablePubs, setAllAvailablePubs] = useState<Pub[]>([]);
  const [alternativeCrawls, setAlternativeCrawls] = useState<PubCrawl[]>([]);
  const [baseCoords, setBaseCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [showOverview, setShowOverview] = useState(false);
  const [taxis, setTaxis] = useState<Taxi[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<string | null>(null);

  const checkAI = async () => {
    setAiStatus("Testing...");
    const { testAI } = await import("../services/pubService");
    const result = await testAI();
    setAiStatus(result);
    setTimeout(() => setAiStatus(null), 5000);
  };

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
      const { pubs, lat, lng } = await fetchAllAvailablePubs(location, maxDist);
      setAllAvailablePubs(pubs);
      setBaseCoords({ lat, lng });

      // Generate 3 initial options
      const options: PubCrawl[] = [];
      for (let i = 0; i < 3; i++) {
        options.push(createCrawlFromPubs(pubs, lat, lng, numPubs, location, i > 0));
      }
      
      setAlternativeCrawls(options);
      setCrawl(options[0]);
      setShowOverview(true);
      
      // Fetch taxis based on the search location
      const taxiResults = await fetchTaxis(lat, lng, location);
      setTaxis(taxiResults);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleReshuffle = () => {
    if (!baseCoords || allAvailablePubs.length === 0) return;
    
    const newOptions: PubCrawl[] = [];
    for (let i = 0; i < 3; i++) {
      newOptions.push(createCrawlFromPubs(allAvailablePubs, baseCoords.lat, baseCoords.lng, numPubs, location, true));
    }
    setAlternativeCrawls(newOptions);
    setCrawl(newOptions[0]);
  };

  const [fetchingMenus, setFetchingMenus] = useState<Set<string>>(new Set());
  const fetchingRef = React.useRef<Set<string>>(new Set());

  const selectCrawl = (selected: PubCrawl) => {
    setCrawl(selected);
    setShowOverview(false);
    setCurrentIndex(0);
  };

  // Lazy fetch menu for current and next pub
  useEffect(() => {
    const fetchMenus = async () => {
      if (crawl && !showOverview) {
        // 1. Fetch current pub menu
        if (currentIndex < crawl.pubs.length) {
          const pub = crawl.pubs[currentIndex];
          if (pub.drinks.length === 0 && !fetchingRef.current.has(pub.id)) {
            performMenuFetch(pub);
          }
        }

        // 2. Pre-fetch next pub menu for speed
        if (currentIndex + 1 < crawl.pubs.length) {
          const nextPub = crawl.pubs[currentIndex + 1];
          if (nextPub.drinks.length === 0 && !fetchingRef.current.has(nextPub.id)) {
            performMenuFetch(nextPub);
          }
        }
      }
    };
    fetchMenus();
  }, [currentIndex, crawl?.name, showOverview]);

  const performMenuFetch = async (pub: Pub) => {
    if (fetchingRef.current.has(pub.id)) return;
    
    fetchingRef.current.add(pub.id);
    setFetchingMenus(prev => new Set(prev).add(pub.id));
    
    try {
      const accurateDrinks = await fetchAccurateMenu(pub.name, pub.address);
      if (accurateDrinks && accurateDrinks.length > 0) {
        setCrawl(prevCrawl => {
          if (!prevCrawl) return null;
          const newPubs = [...prevCrawl.pubs];
          const pIdx = newPubs.findIndex(p => p.id === pub.id);
          if (pIdx !== -1) {
            newPubs[pIdx] = { ...newPubs[pIdx], drinks: accurateDrinks };
          }
          return { ...prevCrawl, pubs: newPubs };
        });
      }
    } catch (err) {
      console.error(`Menu fetch failed for ${pub.name}`, err);
    } finally {
      fetchingRef.current.delete(pub.id);
      setFetchingMenus(prev => {
        const next = new Set(prev);
        next.delete(pub.id);
        return next;
      });
    }
  };

  const useCurrentLocation = () => {
    if ("geolocation" in navigator) {
      setLoading(true);
      setError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setLocation(`${latitude}, ${longitude}`);
          setLoading(false);
        },
        (err) => {
          console.error("Geolocation error:", err);
          let message = "Could not get your location.";
          
          if (err.code === 1) {
            message = "Location permission denied. Please enable it in your browser or try opening the app in a new tab.";
          } else if (err.code === 2) {
            message = "Location unavailable. Please enter it manually.";
          } else if (err.code === 3) {
            message = "Location request timed out. Please try again.";
          }
          
          setError(message);
          setLoading(false);
        },
        { timeout: 15000, enableHighAccuracy: true }
      );
    } else {
      setError("Geolocation is not supported by your browser.");
    }
  };

  const nextPub = () => {
    if (crawl && currentIndex < crawl.pubs.length) {
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
            <div className="flex flex-col">
              <span className="font-bold text-xl tracking-tight leading-none">PubScout</span>
              <span className="text-[8px] text-white/20 font-mono">Build: {new Date().toLocaleTimeString()}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {aiStatus && (
              <motion.div 
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-[10px] font-mono text-orange-500 bg-orange-500/10 px-2 py-1 rounded-md border border-orange-500/20 max-w-[150px] truncate"
              >
                {aiStatus}
              </motion.div>
            )}
            <button 
              onClick={checkAI}
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
              title="Test AI Connection"
            >
              <Sparkles className="w-5 h-5" />
            </button>
            <a 
              href={window.location.href} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-white/10 rounded-xl transition-colors text-white/40 hover:text-white"
              title="Open in new tab (Better for GPS)"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
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
                Discover the best local pubs and plan a seamless crawl with interactive maps.
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
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-14 focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all"
                  />
                  <button
                    type="button"
                    onClick={useCurrentLocation}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-2 hover:bg-white/10 rounded-xl transition-colors text-orange-500"
                    title="Use current location"
                  >
                    <LocateFixed className="w-5 h-5" />
                  </button>
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
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Searching Venues...</span>
                  </div>
                ) : (
                  <>
                    Generate Crawl
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
              
              {error && (
                <div className="space-y-4">
                  <p className="text-red-400 text-sm text-center font-medium">{error}</p>
                  <button 
                    type="button"
                    onClick={() => handleGenerate()}
                    className="w-full py-2 text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </form>
          </motion.div>
        ) : showOverview ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">Route Overview</h1>
                <p className="text-white/60">Choose your preferred route or reshuffle for more options.</p>
              </div>
              <button 
                onClick={handleReshuffle}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all text-orange-500 font-bold"
              >
                <RefreshCw className="w-5 h-5" />
                Reshuffle Route
              </button>
            </div>

            <div className="grid gap-6">
              {alternativeCrawls.map((alt, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-8 rounded-[2.5rem] border transition-all space-y-6",
                    idx === 0 ? "bg-orange-500/10 border-orange-500/30" : "bg-white/5 border-white/10 hover:border-white/20"
                  )}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h3 className="text-2xl font-bold">Option {idx + 1}</h3>
                      <p className="text-sm text-white/40">{alt.pubs.length} venues • {alt.totalDistance}m total distance</p>
                    </div>
                    <button 
                      onClick={() => selectCrawl(alt)}
                      disabled={loading}
                      className="px-8 py-3 bg-orange-500 text-black font-bold rounded-xl hover:bg-orange-400 transition-all flex items-center gap-2"
                    >
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Select This Route"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {alt.pubs.map((p, pIdx) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-500/60">{pIdx + 1}.</span>
                        <span className="text-sm font-medium text-white/80">{p.name}</span>
                        {pIdx < alt.pubs.length - 1 && <ArrowRight className="w-3 h-3 text-white/20" />}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
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

                  {/* Taxi Stop */}
                  <button
                    onClick={() => setCurrentIndex(crawl.pubs.length)}
                    className={cn(
                      "w-full flex items-start gap-4 p-3 rounded-2xl transition-all relative z-10",
                      currentIndex === crawl.pubs.length ? "bg-orange-500 text-black" : "hover:bg-white/5 text-white/60"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border",
                      currentIndex === crawl.pubs.length ? "bg-black text-orange-500 border-black" : "bg-neutral-900 border-white/10"
                    )}>
                      <Car className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold leading-tight">Get Home Safe</p>
                      <p className={cn(
                        "text-xs mt-1",
                        currentIndex === crawl.pubs.length ? "text-black/70" : "text-white/40"
                      )}>
                        Local Taxi Services
                      </p>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content: Active Pub & Next Pub */}
            <div className="lg:col-span-8 space-y-8">
              {/* Map View */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <MapComponent 
                  pubs={crawl.pubs} 
                  selectedPubIndex={currentIndex} 
                  onSelectPub={setCurrentIndex} 
                />
              </motion.div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8"
                >
                  {currentIndex < crawl.pubs.length ? (
                    <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                    <div className="p-8 md:p-12 space-y-8">
                      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-widest">
                            <MapPin className="w-4 h-4" />
                            Current Stop
                          </div>
                          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">{currentPub?.name}</h1>
                          <div className="flex flex-col gap-4">
                            <p className="text-white/60 max-w-xl">{currentPub?.description}</p>
                            
                            <div className="flex flex-wrap gap-4 text-sm text-white/40">
                              {currentPub?.openingHours && (
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-4 h-4 text-orange-500/60" />
                                  <span>{currentPub.openingHours}</span>
                                </div>
                              )}
                              {currentPub?.phone && (
                                <div className="flex items-center gap-1.5">
                                  <Phone className="w-4 h-4 text-orange-500/60" />
                                  <span>{currentPub.phone}</span>
                                </div>
                              )}
                              {currentPub?.website && (
                                <a 
                                  href={currentPub.website.startsWith('http') ? currentPub.website : `https://${currentPub.website}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-1.5 hover:text-orange-500 transition-colors"
                                >
                                  <Globe className="w-4 h-4 text-orange-500/60" />
                                  <span>Website</span>
                                </a>
                              )}
                              <a 
                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${currentPub?.name} ${currentPub?.address}`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 hover:text-orange-500 transition-colors"
                              >
                                <Navigation className="w-4 h-4 text-orange-500/60" />
                                <span>Directions</span>
                              </a>
                            </div>
                          </div>
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
                              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                              <ChevronRight className="w-6 h-6" />
                            </button>
                          </div>
                      </div>

                      <div className="grid md:grid-cols-2 gap-8">
                        {/* Menu & Prices */}
                        <div className="space-y-4">
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <h3 className="flex items-center gap-2 font-bold text-lg">
                                <GlassWater className="w-5 h-5 text-orange-500" />
                                Menu & Prices
                              </h3>
                              <a 
                                href={`https://www.google.com/search?q=${encodeURIComponent(`${currentPub?.name} ${currentPub?.address} menu`)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-orange-500 hover:bg-orange-500/10 hover:border-orange-500/30 transition-all flex items-center gap-1.5 group"
                              >
                                <Search className="w-3 h-3 transition-transform group-hover:scale-110" />
                                Search Official Menu
                              </a>
                            </div>
                            <p className="text-[10px] text-white/30 uppercase tracking-wider font-medium flex items-center gap-1.5">
                              <Globe className="w-3 h-3 text-orange-500/50" />
                              Verified via Google Search
                            </p>
                          </div>
                          <div className="space-y-2">
                            {fetchingMenus.has(currentPub?.id || "") ? (
                              <div className="p-10 rounded-[2rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-4 bg-white/[0.02]">
                                <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                                <p className="text-white/40 text-sm">Fetching accurate menu...</p>
                              </div>
                            ) : currentPub?.drinks && currentPub.drinks.length > 0 ? (
                              currentPub.drinks.map((drink, i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 transition-all">
                                  <div>
                                    <p className="font-bold">{drink.name}</p>
                                    <p className="text-xs text-white/40">{drink.category}</p>
                                  </div>
                                  <div className="flex items-center gap-4">
                                    <span className="font-mono text-orange-500">{drink.price}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="p-10 rounded-[2rem] border border-dashed border-white/10 flex flex-col items-center justify-center text-center space-y-6 bg-white/[0.02]">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                                  <GlassWater className="w-8 h-8 text-white/20" />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-white font-bold text-lg">No Menu Data Found</p>
                                  <p className="text-white/40 text-sm max-w-[200px] mx-auto">We couldn't find a verified menu for this venue online.</p>
                                </div>
                                <div className="flex flex-col gap-3 w-full max-w-[240px]">
                                  <button 
                                    onClick={() => currentPub && performMenuFetch(currentPub)}
                                    className="w-full py-3 rounded-2xl bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                    Retry Fetch
                                  </button>
                                  <a 
                                    href={`https://www.google.com/search?q=${encodeURIComponent(`${currentPub?.name} ${currentPub?.address} menu`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 rounded-2xl bg-orange-500 text-black font-bold text-sm hover:bg-orange-400 transition-all flex items-center justify-center gap-2"
                                  >
                                    <Search className="w-4 h-4" />
                                    Search Google
                                  </a>
                                </div>
                              </div>
                            )}
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
                                View Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-8 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex flex-col items-center justify-center text-center space-y-4">
                              <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                                <Car className="w-6 h-6 text-orange-500" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-white font-bold">Last stop! Enjoy your night.</p>
                                <p className="text-white/40 text-xs">Ready to head home? Check local taxis.</p>
                              </div>
                              <button 
                                onClick={nextPub}
                                className="w-full py-3 rounded-xl bg-orange-500 text-black font-bold text-sm hover:bg-orange-400 transition-all flex items-center justify-center gap-2"
                              >
                                <Car className="w-4 h-4" />
                                Get Home Safe
                              </button>
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
                  ) : (
                    /* Taxi Page */
                    <div className="bg-white/5 rounded-[2.5rem] border border-white/10 overflow-hidden">
                      <div className="p-8 md:p-12 space-y-8">
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-orange-500 text-xs font-bold uppercase tracking-widest">
                              <Car className="w-4 h-4" />
                              End of Route
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">Get Home Safe</h1>
                            <p className="text-white/60 max-w-xl">You've reached the end of the crawl! Here are some local taxi services to help you get home safely.</p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={prevPub}
                              className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                              <ChevronLeft className="w-6 h-6" />
                            </button>
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                          {taxis.map((taxi) => (
                            <div key={taxi.id} className="p-6 rounded-3xl bg-white/5 border border-white/10 hover:border-orange-500/30 transition-all space-y-4 group">
                              <div className="flex items-start justify-between">
                                <div className="space-y-1">
                                  <h3 className="font-bold text-xl group-hover:text-orange-500 transition-colors">{taxi.name}</h3>
                                  {taxi.address && <p className="text-sm text-white/40">{taxi.address}</p>}
                                </div>
                                <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                                  <Car className="w-5 h-5 text-orange-500" />
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                  <div className="flex items-center gap-2 text-sm text-white/60">
                                    <Phone className="w-4 h-4" />
                                    <span>{taxi.phone}</span>
                                  </div>
                                  <a 
                                    href={`tel:${taxi.phone?.replace(/\s/g, '')}`}
                                    className="text-xs font-bold text-orange-500 hover:underline"
                                  >
                                    Call Now
                                  </a>
                                </div>
                                
                                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                  <div className="flex items-center gap-2 text-sm text-white/60">
                                    <CreditCard className="w-4 h-4" />
                                    <span>Estimated Rate</span>
                                  </div>
                                  <span className="text-xs font-mono text-orange-500">{taxi.estimatedRate}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="p-8 rounded-3xl bg-orange-500/10 border border-orange-500/20 text-center space-y-4">
                          <h3 className="font-bold text-xl text-orange-500">Responsible Crawling</h3>
                          <p className="text-sm text-white/60 max-w-lg mx-auto">
                            Always travel with friends, keep your phone charged, and never drink and drive. 
                            Have a great night and get home safely!
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
