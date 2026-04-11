import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Pub } from '../types';
import { MapPin, Navigation } from 'lucide-react';

interface MapComponentProps {
  pubs: Pub[];
  selectedPubIndex: number;
  onSelectPub: (index: number) => void;
}

// Component to handle map centering and bounds
function MapBounds({ pubs }: { pubs: Pub[] }) {
  const map = useMap();

  useEffect(() => {
    if (pubs.length > 0) {
      const bounds = L.latLngBounds(pubs.map(p => [p.coordinates!.lat, p.coordinates!.lng]));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [pubs, map]);

  return null;
}

const MapComponent: React.FC<MapComponentProps> = ({ pubs, selectedPubIndex, onSelectPub }) => {
  const validPubs = pubs.filter(p => 
    p.coordinates && 
    typeof p.coordinates.lat === 'number' && 
    typeof p.coordinates.lng === 'number' &&
    !isNaN(p.coordinates.lat) &&
    !isNaN(p.coordinates.lng)
  );

  useEffect(() => {
    // Trigger resize to fix Leaflet rendering in dynamic containers
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 200);
    return () => clearTimeout(timer);
  }, [validPubs.length]);

  if (validPubs.length === 0) return null;

  const polylinePositions = validPubs.map(p => [p.coordinates!.lat, p.coordinates!.lng] as [number, number]);

  return (
    <div className="h-[400px] w-full rounded-3xl overflow-hidden border border-white/10 relative z-0">
      <MapContainer
        center={[validPubs[0].coordinates!.lat, validPubs[0].coordinates!.lng]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapBounds pubs={validPubs} />

        <Polyline 
          positions={polylinePositions} 
          color="#f97316" 
          weight={4} 
          opacity={0.6} 
          dashArray="10, 10"
        />

        {validPubs.map((pub, index) => (
          <Marker 
            key={pub.id} 
            position={[pub.coordinates!.lat, pub.coordinates!.lng]}
            eventHandlers={{
              click: () => onSelectPub(index),
            }}
            icon={L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div class="relative">
                  <div class="w-8 h-8 bg-neutral-900 border-2 ${index === selectedPubIndex ? 'border-orange-500 scale-125' : 'border-white/20'} rounded-full flex items-center justify-center text-white font-bold text-xs transition-all shadow-xl">
                    ${index + 1}
                  </div>
                  ${index === selectedPubIndex ? '<div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-orange-500 rotate-45"></div>' : ''}
                </div>
              `,
              iconSize: [32, 32],
              iconAnchor: [16, 32],
            })}
          >
            <Popup className="custom-popup">
              <div className="p-2 min-w-[150px]">
                <h4 className="font-bold text-neutral-900">{pub.name}</h4>
                <p className="text-xs text-neutral-600 mb-2">{pub.address}</p>
                <button 
                  onClick={() => onSelectPub(index)}
                  className="w-full bg-orange-500 text-white text-[10px] font-bold py-1.5 rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-1"
                >
                  <Navigation className="w-3 h-3" />
                  View Details
                </button>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MapComponent;
