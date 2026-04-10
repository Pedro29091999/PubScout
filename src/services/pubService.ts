import { PubCrawl, Pub, Drink } from "../types";

// Nominatim API for geocoding (City name -> Lat/Lng)
async function geocode(location: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`,
      {
        headers: {
          'User-Agent': 'PubScoutApp/1.0'
        }
      }
    );
    const data = await response.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon)
      };
    }
  } catch (error) {
    console.error("Geocoding failed:", error);
  }
  return null;
}

// Overpass API for fetching pubs
async function fetchPubs(lat: number, lng: number, radius: number): Promise<any[]> {
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"pub|bar"](around:${radius},${lat},${lng});
      way["amenity"~"pub|bar"](around:${radius},${lat},${lng});
      relation["amenity"~"pub|bar"](around:${radius},${lat},${lng});
    );
    out center;
  `;
  
  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: query
    });
    const data = await response.json();
    return data.elements || [];
  } catch (error) {
    console.error("Overpass API failed:", error);
    return [];
  }
}

function generateRandomDrinks(): Drink[] {
  const categories: Drink["category"][] = ["Beer", "Wine", "Spirit", "Cocktail", "Soft Drink"];
  const drinkNames = {
    "Beer": ["Local IPA", "Craft Lager", "Stout", "Pale Ale", "Pilsner", "Wheat Beer"],
    "Wine": ["House Red", "Sauvignon Blanc", "Rosé", "Prosecco", "Malbec", "Chardonnay"],
    "Spirit": ["Gin & Tonic", "Whiskey Neat", "Vodka Soda", "Rum & Coke", "Tequila Shot"],
    "Cocktail": ["Old Fashioned", "Negroni", "Margarita", "Espresso Martini", "Mojito"],
    "Soft Drink": ["Sparkling Water", "Cola", "Lemonade", "Ginger Beer", "Orange Juice"]
  };

  const menu: Drink[] = [];
  const numDrinks = 5 + Math.floor(Math.random() * 3);

  for (let i = 0; i < numDrinks; i++) {
    const category = categories[Math.floor(Math.random() * categories.length)];
    const names = drinkNames[category];
    const name = names[Math.floor(Math.random() * names.length)];
    const price = (4 + Math.random() * 8).toFixed(2);
    
    menu.push({
      name,
      price: `£${price}`,
      category
    });
  }

  return menu;
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

export async function generatePubCrawl(
  location: string,
  numPubs: number,
  maxDistanceBetween: number
): Promise<PubCrawl> {
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

  // Fetch pubs in a larger radius initially to ensure we have enough
  const elements = await fetchPubs(lat, lng, 3000);
  
  if (elements.length === 0) {
    throw new Error("No pubs found in this area.");
  }

  // Map to our Pub type
  const allPubs: Pub[] = elements.map(el => ({
    id: el.id.toString(),
    name: el.tags.name || "Unnamed Pub",
    address: el.tags["addr:street"] ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}` : "Address unknown",
    description: el.tags.description || `A local ${el.tags.amenity} in the heart of the neighborhood.`,
    distanceFromPrevious: 0,
    drinks: generateRandomDrinks(),
    coordinates: {
      lat: el.lat || el.center?.lat,
      lng: el.lon || el.center?.lon
    }
  })).filter(p => p.name !== "Unnamed Pub");

  // Simple greedy algorithm to find a route
  const selectedPubs: Pub[] = [];
  let currentLat = lat;
  let currentLng = lng;

  for (let i = 0; i < numPubs; i++) {
    if (allPubs.length === 0) break;

    // Find nearest pub
    let nearestIdx = -1;
    let minDist = Infinity;

    for (let j = 0; j < allPubs.length; j++) {
      const d = calculateDistance(currentLat, currentLng, allPubs[j].coordinates!.lat, allPubs[j].coordinates!.lng);
      if (d < minDist) {
        minDist = d;
        nearestIdx = j;
      }
    }

    if (nearestIdx !== -1) {
      const pub = allPubs.splice(nearestIdx, 1)[0];
      pub.distanceFromPrevious = minDist;
      selectedPubs.push(pub);
      currentLat = pub.coordinates!.lat;
      currentLng = pub.coordinates!.lng;
    }
  }

  const totalDistance = selectedPubs.reduce((sum, p) => sum + p.distanceFromPrevious, 0);

  return {
    name: `${location} Pub Crawl`,
    pubs: selectedPubs,
    totalDistance
  };
}
