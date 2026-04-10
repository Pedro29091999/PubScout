export interface Drink {
  name: string;
  price: string;
  category: "Beer" | "Wine" | "Spirit" | "Cocktail" | "Soft Drink";
}

export interface Pub {
  id: string;
  name: string;
  address: string;
  description: string;
  distanceFromPrevious: number; // in meters or km
  drinks: Drink[];
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface PubCrawl {
  name: string;
  pubs: Pub[];
  totalDistance: number;
}
