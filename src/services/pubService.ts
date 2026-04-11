import { PubCrawl, Pub, Drink, Taxi } from "../types";
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    console.log("Gemini: Initializing with API key present:", !!apiKey);
    if (!apiKey) {
      console.error("Gemini: GEMINI_API_KEY is missing from environment. Please add it to AI Studio Settings -> Secrets.");
      throw new Error("GEMINI_API_KEY is not defined.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Caching helpers
const CACHE_PREFIX = "pubscout_v2_";
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

// Overpass API helper
async function runOverpassQuery(query: string): Promise<any[]> {
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
        continue;
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        return data.elements || [];
      }
    } catch (error) {
      console.warn(`Overpass API request to ${endpoint} failed:`, error);
    }
  }
  return [];
}

// Overpass API for fetching pubs
async function fetchPubs(lat: number, lng: number, radius: number): Promise<any[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["amenity"~"pub|bar"](around:${radius},${lat},${lng});
      way["amenity"~"pub|bar"](around:${radius},${lat},${lng});
      relation["amenity"~"pub|bar"](around:${radius},${lat},${lng});
    );
    out center;
  `;
  
  return runOverpassQuery(query);
}

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
  // We return empty to force an accurate fetch or show the "No Menu" prompt
  return [];
}

export async function fetchAccurateMenu(pubName: string, address: string): Promise<Drink[]> {
  console.log(`Gemini: Fetching menu for ${pubName}...`);
  try {
    const ai = getAI();
    
    // Check if it's a Wetherspoons pub for targeted search
    const isWetherspoons = pubName.toLowerCase().includes("wetherspoon") || 
                          pubName.toLowerCase().includes("j d wetherspoon") ||
                          // Common Wetherspoons names often don't include the brand, 
                          // but the prompt can be adjusted to look for their specific menu structure.
                          true; 

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the current drink menu and prices for "${pubName}" ${address !== 'Address unknown' ? `at "${address}"` : ''}. 
      ${isWetherspoons ? 'This is likely a Wetherspoons venue; search for their official menu or app data.' : ''}
      Search for real beers, ales, cocktails, and spirits. 
      Return a JSON array of objects with "name", "price", and "category" (Beer, Wine, Spirit, Cocktail, or Soft Drink).
      If you find multiple menus, pick the most recent one. 
      If no specific menu is found after searching, return [].`,
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
              category: { 
                type: Type.STRING,
                enum: ["Beer", "Wine", "Spirit", "Cocktail", "Soft Drink"]
              }
            },
            required: ["name", "price", "category"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) {
      console.warn(`Gemini: Empty response for ${pubName}`);
      return [];
    }
    
    try {
      const drinks = JSON.parse(text);
      return Array.isArray(drinks) ? drinks : [];
    } catch (parseError) {
      console.error(`Gemini: Failed to parse menu JSON for ${pubName}:`, text);
      return [];
    }
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const errorStr = JSON.stringify(error);
    
    if (errorMsg.includes("leaked") || errorStr.includes("leaked")) {
      console.error("CRITICAL: Your Gemini API key has been flagged as leaked. Please update it in AI Studio Settings -> Secrets.");
    } else if (errorMsg.includes("expired") || errorMsg.includes("API_KEY_INVALID") || errorStr.includes("expired") || errorStr.includes("API_KEY_INVALID")) {
      console.error("CRITICAL: Your Gemini API key has expired or is invalid. Please provide a fresh key in AI Studio Settings -> Secrets.");
    } else if (errorMsg.includes("disturbed") || errorMsg.includes("locked")) {
      console.error("Gemini: Response body disturbed error. This can happen with network interruptions. Retrying might help.");
    }
    
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

export async function fetchAllAvailablePubs(location: string, searchRadius: number = 1500): Promise<{ pubs: Pub[], lat: number, lng: number }> {
  const cacheKey = `pubs_${location.toLowerCase().trim()}_${searchRadius}`;
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
    if (!coords) throw new Error("Could not find that location. Please try a more specific city or area name.");
    lat = coords.lat;
    lng = coords.lng;
  }

  // Fetch pubs in the requested radius, with fallbacks if none found
  console.log(`Searching for pubs/bars near ${lat}, ${lng} with radius ${searchRadius}m...`);
  let elements = await fetchPubs(lat, lng, searchRadius);
  if (elements.length === 0) {
    console.log(`No pubs in ${searchRadius}m, trying 3000m...`);
    elements = await fetchPubs(lat, lng, 3000);
  }
  if (elements.length === 0) {
    console.log(`No pubs in 3000m, trying 5000m...`);
    elements = await fetchPubs(lat, lng, 5000);
  }
  
  console.log(`Found ${elements.length} raw elements from Overpass.`);
  
  if (elements.length === 0) {
    throw new Error("No pubs or bars found in this area. Try searching for a more central location.");
  }

  const pubs: Pub[] = elements
    .filter(el => {
      if (!el.tags || !el.tags.name) return false;
      
      // Ensure we have coordinates
      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (lat === undefined || lng === undefined) return false;

      const name = el.tags.name.toLowerCase();
      const excludeKeywords = ["club", "nightclub", "disco", "gentlemen's club", "strip club", "hotel", "restaurant", "training", "provider", "academy", "school", "college", "office", "consultancy", "business center", "medical", "hospital", "clinic", "church", "mosque", "temple"];
      
      if (!["pub", "bar"].includes(el.tags.amenity)) return false;
      
      if (el.tags.disused === "yes" || el.tags.abandoned === "yes" || el.tags.closed === "yes" || el.tags.vacant === "yes" || el.tags.status === "closed" || el.tags.description?.toLowerCase().includes("permanently closed") || el.tags.note?.toLowerCase().includes("closed")) return false;
      
      if (excludeKeywords.some(k => name.includes(k) && !name.includes("pub") && !name.includes("bar"))) {
        if (!name.includes("pub") && !name.includes("bar")) return false;
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

  if (pubs.length === 0) {
    throw new Error("No suitable pubs or bars found in this area.");
  }

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

    if (nextIdx !== -1 && availablePubs[nextIdx]) {
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
  console.log(`Gemini: Fetching taxis for ${searchLocation}...`);
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
    
    let taxis;
    try {
      taxis = JSON.parse(text);
    } catch (parseError) {
      console.error("Gemini: Failed to parse taxi JSON:", text);
      throw new Error("Invalid JSON from Gemini");
    }
    
    if (!Array.isArray(taxis)) return [];
    
    return taxis.map((t: any, i: number) => ({
      ...t,
      id: `taxi-${i}-${Date.now()}`
    }));
  } catch (error: any) {
    const errorMsg = error?.message || "";
    const errorStr = JSON.stringify(error);
    
    if (errorMsg.includes("leaked") || errorStr.includes("leaked")) {
      console.error("CRITICAL: Your Gemini API key has been flagged as leaked. Please update it in AI Studio Settings -> Secrets.");
    } else if (errorMsg.includes("expired") || errorMsg.includes("API_KEY_INVALID") || errorStr.includes("expired") || errorStr.includes("API_KEY_INVALID")) {
      console.error("CRITICAL: Your Gemini API key has expired or is invalid. Please provide a fresh key in AI Studio Settings -> Secrets.");
    }
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
      const elements = await runOverpassQuery(query);
      const taxis: Taxi[] = elements.map((el: any) => ({
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
