import { PubCrawl, Pub, Drink, Taxi } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined. Please add it to your environment variables.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Caching helpers
const CACHE_PREFIX = "pubscout_v1_";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getFromCache<T>(key: string): T | null {
  try {
    const item = localStorage.getItem(CACHE_PREFIX + key);
    if (!item) return null;
    const entry = JSON.parse(item);
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return entry.data;
  } catch (e) {
    return null;
  }
}

function saveToCache<T>(key: string, data: T) {
  try {
    const entry = { data, timestamp: Date.now() };
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch (e) {
    // If quota exceeded, clear old cache and try once more
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      localStorage.clear();
    }
  }
}

// Nominatim API for geocoding (City name -> Lat/Lng)
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  const cacheKey = `geo_${location.toLowerCase().trim()}`;
  const cached = getFromCache<{ lat: number; lng: number }>(cacheKey);
  if (cached) return cached;

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        headers: {
          'User-Agent': 'PubScoutApp/1.0'
        }
      }
    );

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await response.json();
      if (data && data.length > 0) {
        const result = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
        saveToCache(cacheKey, result);
        return result;
      }
    }
  } catch (error) {
    console.error("Geocoding failed:", error);
  }
  return null;
}

// Overpass API for fetching pubs
async function fetchPubs(lat: number, lng: number, radius: number): Promise<any[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["amenity"="pub"](around:${radius},${lat},${lng});
      way["amenity"="pub"](around:${radius},${lat},${lng});
      relation["amenity"="pub"](around:${radius},${lat},${lng});
    );
    out center;
  `;
  
  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://z.overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter"
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `data=${encodeURIComponent(query)}`
      });

      if (!response.ok) {
        const text = await response.text();
        console.warn(`Overpass API error from ${endpoint} (${response.status}):`, text.substring(0, 200));
        continue; // Try next endpoint
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        return data.elements || [];
      } else {
        const text = await response.text();
        console.warn(`Overpass API from ${endpoint} returned non-JSON response:`, text.substring(0, 200));
        continue; // Try next endpoint
      }
    } catch (error) {
      console.warn(`Overpass API request to ${endpoint} failed:`, error);
      continue; // Try next endpoint
    }
  }

  console.error("All Overpass API endpoints failed.");
  return [];
}

// Real-world menu templates for popular pub chains and styles
const REAL_MENUS: Record<string, Drink[]> = {
  "brewdog": [
    { name: "Punk IPA", price: "£6.20", category: "Beer" },
    { name: "Hazy Jane", price: "£6.50", category: "Beer" },
    { name: "Elvis Juice", price: "£6.40", category: "Beer" },
    { name: "Lost Lager", price: "£5.80", category: "Beer" },
    { name: "Dead Pony Club", price: "£5.90", category: "Beer" },
    { name: "Alcohol Free Punk", price: "£4.50", category: "Soft Drink" }
  ],
  "wetherspoon": [
    { name: "Abbot Ale", price: "£3.45", category: "Beer" },
    { name: "Greene King IPA", price: "£2.95", category: "Beer" },
    { name: "Foster's", price: "£3.20", category: "Beer" },
    { name: "Strongbow", price: "£3.50", category: "Beer" },
    { name: "Jack Daniel's & Coke", price: "£4.80", category: "Spirit" },
    { name: "Pepsi Max", price: "£2.10", category: "Soft Drink" }
  ],
  "irish": [
    { name: "Guinness", price: "£6.10", category: "Beer" },
    { name: "Jameson Ginger & Lime", price: "£8.50", category: "Spirit" },
    { name: "Magners Cider", price: "£5.80", category: "Beer" },
    { name: "Baby Stout Shot", price: "£4.50", category: "Spirit" },
    { name: "Irish Coffee", price: "£7.50", category: "Cocktail" },
    { name: "Club Orange", price: "£3.20", category: "Soft Drink" }
  ],
  "craft": [
    { name: "Neck Oil Session IPA", price: "£6.80", category: "Beer" },
    { name: "Gamma Ray APA", price: "£7.00", category: "Beer" },
    { name: "Cloudwater Pale", price: "£7.20", category: "Beer" },
    { name: "Sour Ale", price: "£7.50", category: "Beer" },
    { name: "Negroni", price: "£11.00", category: "Cocktail" },
    { name: "Artisan Tonic", price: "£3.50", category: "Soft Drink" }
  ],
  "traditional": [
    { name: "London Pride", price: "£5.40", category: "Beer" },
    { name: "Doom Bar", price: "£5.20", category: "Beer" },
    { name: "Peroni", price: "£6.20", category: "Beer" },
    { name: "Gordon's Gin & Tonic", price: "£7.50", category: "Spirit" },
    { name: "Pimms & Lemonade", price: "£8.00", category: "Cocktail" },
    { name: "J2O Orange & Passionfruit", price: "£3.80", category: "Soft Drink" }
  ],
  "cocktail": [
    { name: "Espresso Martini", price: "£12.50", category: "Cocktail" },
    { name: "Pornstar Martini", price: "£13.00", category: "Cocktail" },
    { name: "Old Fashioned", price: "£12.00", category: "Cocktail" },
    { name: "Margarita", price: "£11.50", category: "Cocktail" },
    { name: "Aperol Spritz", price: "£10.50", category: "Cocktail" },
    { name: "Virgin Mojito", price: "£7.50", category: "Soft Drink" }
  ],
  "sam_smiths": [
    { name: "Taddy Lager", price: "£4.80", category: "Beer" },
    { name: "Alpine Lager", price: "£4.50", category: "Beer" },
    { name: "Old Brewery Bitter", price: "£4.20", category: "Beer" },
    { name: "Pure Brewed Lager", price: "£5.20", category: "Beer" },
    { name: "Sovereign Bitter", price: "£4.40", category: "Beer" },
    { name: "Celebrity Ginger Beer", price: "£3.50", category: "Soft Drink" }
  ],
  "greene_king": [
    { name: "Greene King IPA", price: "£4.80", category: "Beer" },
    { name: "Abbot Ale", price: "£5.20", category: "Beer" },
    { name: "Old Speckled Hen", price: "£5.40", category: "Beer" },
    { name: "Ice Breaker Pale Ale", price: "£5.80", category: "Beer" },
    { name: "Yardbird Lager", price: "£5.50", category: "Beer" },
    { name: "Belhaven Best", price: "£4.90", category: "Beer" }
  ],
  "fullers": [
    { name: "London Pride", price: "£5.80", category: "Beer" },
    { name: "ESB", price: "£6.20", category: "Beer" },
    { name: "Seafarers", price: "£5.90", category: "Beer" },
    { name: "Frontier Lager", price: "£6.40", category: "Beer" },
    { name: "Honey Dew", price: "£6.10", category: "Beer" },
    { name: "Cornish Orchards Cider", price: "£6.00", category: "Beer" }
  ]
};

function generateDescription(tags: any): string {
  if (tags.description) return tags.description;

  const parts: string[] = [];
  
  // Start with basic type
  const type = tags.amenity === "pub" ? "traditional pub" : "lively bar";
  parts.push(`A ${type}`);

  // Add cuisine/style if available
  if (tags.cuisine) {
    parts.push(`specializing in ${tags.cuisine}`);
  } else if (tags.brewery) {
    parts.push(`featuring brews from ${tags.brewery}`);
  } else if (tags.bar === "cocktail") {
    parts.push("specializing in craft cocktails");
  }

  // Add features
  const features: string[] = [];
  if (tags.outdoor_seating === "yes") features.push("outdoor seating");
  if (tags.real_ale === "yes") features.push("real ales");
  if (tags.food === "yes") features.push("a full food menu");
  if (tags.wheelchair === "yes") features.push("wheelchair access");
  if (tags.live_music === "yes") features.push("live music");

  if (features.length > 0) {
    parts.push(`with ${features.join(", ")}`);
  }

  // Closing context
  if (tags.operator) {
    parts.push(`operated by ${tags.operator}`);
  } else {
    parts.push("popular with locals and visitors alike");
  }

  return parts.join(" ") + ".";
}

function getRealisticDrinks(pubName: string, tags: any): Drink[] {
  const name = pubName.toLowerCase();
  const operator = tags.operator?.toLowerCase() || "";
  
  // Match specific chains (High confidence)
  if (name.includes("brewdog") || operator.includes("brewdog")) return REAL_MENUS.brewdog;
  if (name.includes("wetherspoon") || name.includes("moon under water") || operator.includes("wetherspoon")) return REAL_MENUS.wetherspoon;
  if (name.includes("sam smith") || operator.includes("samuel smith")) return REAL_MENUS.sam_smiths;
  if (name.includes("greene king") || operator.includes("greene king")) return REAL_MENUS.greene_king;
  if (name.includes("fuller") || operator.includes("fuller")) return REAL_MENUS.fullers;
  
  // Match by style/tags (Medium confidence)
  if (name.includes("irish") || name.includes("o'") || name.includes("shamrock") || name.includes("dublin") || tags.cuisine === "irish") return REAL_MENUS.irish;
  if (name.includes("craft") || name.includes("tap") || name.includes("brewery") || name.includes("hop") || name.includes("ale house") || tags.brewery) return REAL_MENUS.craft;
  if (name.includes("cocktail") || name.includes("lounge") || tags.cuisine === "cocktail" || tags.bar === "cocktail") return REAL_MENUS.cocktail;
  
  // Only return "traditional" if we are reasonably sure it's a standard pub
  // Otherwise return empty to avoid "random" feeling
  if (tags.amenity === "pub") {
    // If it has a very generic name, it might be better to show no menu than a fake one
    // But for now, traditional is a safe fallback for "amenity=pub"
    return REAL_MENUS.traditional;
  }
  
  if (tags.amenity === "bar") return REAL_MENUS.craft;
  
  return [];
}

export async function fetchAccurateMenu(pubName: string, address: string): Promise<Drink[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the current drink menu and prices for "${pubName}" at "${address}". 
      Focus on popular drinks like beers, cocktails, and spirits. 
      If exact prices are not found, provide realistic estimates based on the venue's style and location.
      Return the data as a list of drinks with name, price, and category.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              price: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["name", "price", "category"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    const drinks = JSON.parse(text);
    return drinks;
  } catch (error) {
    console.error(`Failed to fetch accurate menu for ${pubName}:`, error);
    return [];
  }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return Math.round(R * c);
}

export async function fetchAllAvailablePubs(location: string): Promise<{ pubs: Pub[], lat: number, lng: number }> {
  const cacheKey = `pubs_${location.toLowerCase().trim()}`;
  const cached = getFromCache<{ pubs: Pub[], lat: number, lng: number }>(cacheKey);
  if (cached) return cached;

  let lat: number, lng: number;

  // Check if location is already coordinates
  const coordMatch = location.match(/^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/);
  if (coordMatch) {
    lat = parseFloat(coordMatch[1]);
    lng = parseFloat(coordMatch[2]);
  } else {
    const coords = await geocode(location);
    if (!coords) throw new Error("Could not find that location.");
    lat = coords.lat;
    lng = coords.lng;
  }

  // Fetch pubs in a moderate radius initially
  let elements = await fetchPubs(lat, lng, 1500);
  if (elements.length === 0) {
    elements = await fetchPubs(lat, lng, 3000);
  }
  
  if (elements.length === 0) {
    throw new Error("No pubs found in this area.");
  }

  const pubs: Pub[] = elements
    .filter(el => {
      if (!el.tags || !el.tags.name) return false;
      const name = el.tags.name.toLowerCase();
      const excludeKeywords = ["club", "nightclub", "disco", "gentlemen's club", "strip club", "hotel", "restaurant", "training", "provider", "academy", "school", "college", "office", "consultancy", "business center", "medical", "hospital", "clinic", "church", "mosque", "temple"];
      if (el.tags.amenity !== "pub") return false;
      if (el.tags.disused === "yes" || el.tags.abandoned === "yes" || el.tags.closed === "yes" || el.tags.vacant === "yes" || el.tags.status === "closed" || el.tags.description?.toLowerCase().includes("permanently closed") || el.tags.note?.toLowerCase().includes("closed")) return false;
      if (excludeKeywords.some(k => name.includes(k) && !name.includes("pub"))) {
        if (!name.includes("pub")) return false;
      }
      return true;
    })
    .map(el => ({
      id: el.id.toString(),
      name: el.tags.name,
      address: el.tags["addr:street"] ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}` : "Address unknown",
      description: generateDescription(el.tags),
      distanceFromPrevious: 0,
      drinks: getRealisticDrinks(el.tags.name, el.tags),
      website: el.tags.website || el.tags.url,
      phone: el.tags.phone || el.tags["contact:phone"],
      openingHours: el.tags.opening_hours,
      coordinates: {
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon
      }
    }));

  const result = { pubs, lat, lng };
  saveToCache(cacheKey, result);
  return result;
}

export function createCrawlFromPubs(
  allPubs: Pub[], 
  startLat: number, 
  startLng: number, 
  numPubs: number, 
  locationName: string,
  randomize: boolean = false
): PubCrawl {
  const availablePubs = [...allPubs];
  const selectedPubs: Pub[] = [];
  let currentLat = startLat;
  let currentLng = startLng;

  for (let i = 0; i < numPubs; i++) {
    if (availablePubs.length === 0) break;

    let nextIdx = -1;
    if (randomize) {
      // Pick a random pub from the 5 nearest ones to add variety
      const distances = availablePubs.map((p, idx) => ({
        idx,
        dist: calculateDistance(currentLat, currentLng, p.coordinates!.lat, p.coordinates!.lng)
      })).sort((a, b) => a.dist - b.dist);
      
      const poolSize = Math.min(5, distances.length);
      const randomChoice = Math.floor(Math.random() * poolSize);
      nextIdx = distances[randomChoice].idx;
    } else {
      // Standard nearest neighbor
      let minDist = Infinity;
      for (let j = 0; j < availablePubs.length; j++) {
        const d = calculateDistance(currentLat, currentLng, availablePubs[j].coordinates!.lat, availablePubs[j].coordinates!.lng);
        if (d < minDist) {
          minDist = d;
          nextIdx = j;
        }
      }
    }

    if (nextIdx !== -1) {
      const pub = { ...availablePubs.splice(nextIdx, 1)[0] };
      pub.distanceFromPrevious = calculateDistance(currentLat, currentLng, pub.coordinates!.lat, pub.coordinates!.lng);
      selectedPubs.push(pub);
      currentLat = pub.coordinates!.lat;
      currentLng = pub.coordinates!.lng;
    }
  }

  const totalDistance = selectedPubs.reduce((sum, p) => sum + p.distanceFromPrevious, 0);

  return {
    name: `${locationName} Route ${Math.floor(Math.random() * 1000)}`,
    pubs: selectedPubs,
    totalDistance
  };
}

export async function generatePubCrawl(
  location: string,
  numPubs: number,
  maxDistanceBetween: number
): Promise<PubCrawl> {
  const { pubs, lat, lng } = await fetchAllAvailablePubs(location);
  const crawl = createCrawlFromPubs(pubs, lat, lng, numPubs, location);

  // Fetch accurate menus for selected pubs in parallel
  await Promise.all(
    crawl.pubs.map(async (pub) => {
      const accurateDrinks = await fetchAccurateMenu(pub.name, pub.address);
      if (accurateDrinks && accurateDrinks.length > 0) {
        pub.drinks = accurateDrinks;
      }
    })
  );

  return crawl;
}

export async function fetchTaxis(lat: number, lng: number, searchLocation: string): Promise<Taxi[]> {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find 3-4 real, active local taxi companies or private hire services in or near "${searchLocation}". 
      The specific coordinates are ${lat}, ${lng}. 
      Include their name, phone number, and address if available. 
      Also provide a realistic estimated flat rate or fare range for a short trip (2-5 miles) in this specific area.
      Return the data as a list of taxi services.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              phone: { type: Type.STRING },
              address: { type: Type.STRING },
              estimatedRate: { type: Type.STRING }
            },
            required: ["name", "phone", "estimatedRate"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No taxi data from Gemini");
    const taxis = JSON.parse(text);
    return taxis.map((t: any, i: number) => ({
      ...t,
      id: `taxi-${i}-${Date.now()}`
    }));
  } catch (error) {
    console.error("Gemini taxi fetch failed, falling back to Overpass:", error);
    
    // Fallback to Overpass if Gemini fails
    const query = `
      [out:json][timeout:30];
      (
        node["amenity"="taxi"](around:5000,${lat},${lng});
        way["amenity"="taxi"](around:5000,${lat},${lng});
        node["office"="taxi"](around:5000,${lat},${lng});
        way["office"="taxi"](around:5000,${lat},${lng});
      );
      out center;
    `;

    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
      });
      
      if (!response.ok) throw new Error("Overpass fallback failed");
      
      const data = await response.json();
      const taxis: Taxi[] = (data.elements || []).map((el: any) => ({
        id: el.id.toString(),
        name: el.tags.name || "Local Taxi Service",
        phone: el.tags.phone || el.tags["contact:phone"] || "Contact via App",
        address: el.tags["addr:street"] ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}` : undefined,
        estimatedRate: "Metered (Typical local fare)"
      }));

      if (taxis.length > 0) return taxis;
    } catch (fallbackError) {
      console.error("Overpass fallback also failed:", fallbackError);
    }

    // Final hardcoded fallback with generic but helpful info
    return [
      { id: "gen1", name: "Local Taxi Search", phone: "Search Google", estimatedRate: "Check local rates" },
      { id: "gen2", name: "Uber / Bolt / FreeNow", phone: "Use Mobile App", estimatedRate: "App-based pricing" }
    ];
  }
}
