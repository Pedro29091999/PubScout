import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Drink } from "../types";
import { Sparkles, RefreshCcw, Trophy } from "lucide-react";

interface DrinkWheelProps {
  drinks: Drink[];
}

export default function DrinkGenerator({ drinks }: DrinkWheelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedDrink, setSelectedDrink] = useState<Drink | null>(null);
  const [displayIndex, setDisplayIndex] = useState(0);

  const generate = async () => {
    if (isGenerating || drinks.length === 0) return;

    setIsGenerating(true);
    setSelectedDrink(null);

    // Shuffling effect
    const shuffleCount = 20;
    const duration = 2000; // 2 seconds
    const interval = duration / shuffleCount;

    for (let i = 0; i < shuffleCount; i++) {
      await new Promise(resolve => setTimeout(resolve, interval));
      setDisplayIndex(Math.floor(Math.random() * drinks.length));
    }

    const finalIndex = Math.floor(Math.random() * drinks.length);
    setSelectedDrink(drinks[finalIndex]);
    setIsGenerating(false);
  };

  return (
    <div className="flex flex-col gap-4 p-6 bg-white/5 rounded-3xl border border-white/10">
      <div className="relative h-48 flex items-center justify-center bg-black/40 rounded-2xl border border-white/5 overflow-hidden">
        <AnimatePresence mode="wait">
          {isGenerating ? (
            <motion.div
              key="shuffling"
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="text-center space-y-2"
            >
              <p className="text-2xl font-bold text-white/80">{drinks[displayIndex]?.name}</p>
              <p className="text-xs font-bold uppercase tracking-widest text-white/20">Shuffling...</p>
            </motion.div>
          ) : selectedDrink ? (
            <motion.div
              key="selected"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center space-y-3 p-6"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 bg-orange-500 rounded-full mb-2">
                <Trophy className="w-6 h-6 text-black" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-1">The Choice</p>
                <p className="text-2xl font-bold">{selectedDrink.name}</p>
                <p className="text-sm text-white/60">{selectedDrink.price} • {selectedDrink.category}</p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center space-y-4"
            >
              <div className="w-16 h-16 mx-auto bg-white/5 rounded-full flex items-center justify-center">
                <RefreshCcw className="w-8 h-8 text-white/20" />
              </div>
              <p className="text-white/40 text-sm italic px-8">
                Can't decide? Let the generator pick your next round.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Decorative elements */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-8 bg-gradient-to-b from-black/40 to-transparent" />
          <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-black/40 to-transparent" />
        </div>
      </div>

      <button
        onClick={generate}
        disabled={isGenerating}
        className="w-full py-4 rounded-2xl bg-orange-500 hover:bg-orange-400 disabled:bg-orange-500/50 text-black font-bold transition-all flex items-center justify-center gap-2 group"
      >
        <Sparkles className={cn("w-5 h-5", isGenerating && "animate-pulse")} />
        {isGenerating ? "Generating..." : selectedDrink ? "Try Again" : "Pick My Drink"}
      </button>
    </div>
  );
}

// Helper for conditional classes since I used it above
function cn(...classes: any[]) {
  return classes.filter(Boolean).join(" ");
}
