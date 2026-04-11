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
  website?: string;
  phone?: string;
  openingHours?: string;
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

export interface Taxi {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  estimatedRate?: string;
}
