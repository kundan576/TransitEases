import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Navigation, AlertTriangle } from 'lucide-react';
import { BusLocation, BusStop } from '../types';
import { useAccessibility } from '../context/AccessibilityContext';

interface BusMapProps {
  location?: BusLocation | null;
  busNumber?: string;
  routePolyline?: [number, number][];
  stops?: BusStop[];
  staleWarning?: string | null;
  multiBuses?: Array<{
    busId: string;
    busNumber: string;
    routeNumber?: string;
    lat: number;
    lng: number;
    speed: number;
    heading: number;
    isStale?: boolean;
  }>;
  onSelectBus?: (busNumber: string) => void;
  className?: string;
  height?: string;
}

export const BusMap: React.FC<BusMapProps> = ({
  location,
  busNumber,
  routePolyline,
  stops = [],
  staleWarning,
  multiBuses,
  onSelectBus,
  className = '',
  height = '420px'
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const busMarkerRef = useRef<L.Marker | null>(null);
  const multiMarkersRef = useRef<Map<string, L.Marker>>(new Map());
  const polylineRef = useRef<L.Polyline | null>(null);
  const stopMarkersRef = useRef<L.LayerGroup | null>(null);

  const { lowBandwidthMode, t } = useAccessibility();

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const defaultCenter: [number, number] = location
        ? [location.lat, location.lng]
        : stops.length > 0
        ? [stops[0].lat, stops[0].lng]
        : [28.4688, 77.5052]; // Small city transit corridor center

      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 14,
        zoomControl: true
      });

      // OpenStreetMap standard tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapInstanceRef.current = map;
      stopMarkersRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (routePolyline && routePolyline.length > 0) {
      const poly = L.polyline(routePolyline, {
        color: '#2563eb',
        weight: 6,
        opacity: 0.85,
        lineCap: 'round',
        lineJoin: 'round'
      }).addTo(map);

      polylineRef.current = poly;
      if (!location) {
        map.fitBounds(poly.getBounds(), { padding: [40, 40] });
      }
    }
  }, [routePolyline]);

  // Update Stops
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !stopMarkersRef.current) return;

    stopMarkersRef.current.clearLayers();

    stops.forEach((stop, index) => {
      const stopHtml = `
        <div style="background-color: #ffffff; border: 2px solid #2563eb; border-radius: 9999px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2); font-weight: bold; font-size: 10px; color: #1e3a8a;">
          ${index + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-stop-marker',
        html: stopHtml,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon: customIcon });
      marker.bindPopup(`
        <div style="font-family: inherit; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a;">${stop.name}</div>
          <div style="font-size: 11px; color: #64748b; margin-top: 2px;">Stop Code: <span style="font-weight: 600; color: #2563eb;">${stop.code}</span></div>
          ${stop.landmark ? `<div style="font-size: 11px; color: #475569; margin-top: 2px;">📍 ${stop.landmark}</div>` : ''}
        </div>
      `);
      stopMarkersRef.current?.addLayer(marker);
    });
  }, [stops]);

  // Update Single Bus Marker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (location) {
      const isStale = location.isStale;
      const markerColor = isStale ? '#f59e0b' : '#10b981';

      const busHtml = `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background-color: ${markerColor}; opacity: 0.35;" class="pulse-ring"></div>
          <div style="position: relative; width: 34px; height: 34px; border-radius: 50%; background-color: ${markerColor}; border: 3px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.3); transform: rotate(${location.heading || 0}deg);">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: busHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      if (!busMarkerRef.current) {
        busMarkerRef.current = L.marker([location.lat, location.lng], { icon: customIcon }).addTo(map);
      } else {
        busMarkerRef.current.setLatLng([location.lat, location.lng]);
        busMarkerRef.current.setIcon(customIcon);
      }

      const timeStr = new Date(location.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      busMarkerRef.current.bindPopup(`
        <div style="font-family: inherit; padding: 4px; min-width: 150px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <span style="font-weight: 800; font-size: 14px; color: #0f172a;">${busNumber || 'Bus'}</span>
            <span style="background-color: ${isStale ? '#fef3c7' : '#d1fae5'}; color: ${isStale ? '#92400e' : '#065f46'}; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 9999px;">
              ${isStale ? 'Stale GPS' : 'LIVE'}
            </span>
          </div>
          <div style="font-size: 12px; color: #334155;">Speed: <strong>${location.speed} km/h</strong></div>
          <div style="font-size: 12px; color: #334155;">GPS Accuracy: <strong>±${location.accuracy}m</strong></div>
          <div style="font-size: 11px; color: #64748b; margin-top: 4px;">Updated: ${timeStr}</div>
        </div>
      `);

      map.panTo([location.lat, location.lng], { animate: true, duration: 0.8 });
    } else if (busMarkerRef.current) {
      map.removeLayer(busMarkerRef.current);
      busMarkerRef.current = null;
    }
  }, [location, busNumber]);

  // Update Multi-Buses (Fleet View)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !multiBuses) return;

    const currentIds = new Set(multiBuses.map(b => b.busId));

    // Remove markers that are no longer active
    multiMarkersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(marker);
        multiMarkersRef.current.delete(id);
      }
    });

    // Add or update markers
    multiBuses.forEach(b => {
      const markerColor = b.isStale ? '#f59e0b' : '#10b981';
      const busHtml = `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #0f172a; color: #ffffff; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; margin-bottom: 2px; white-space: nowrap; box-shadow: 0 1px 3px rgba(0,0,0,0.3);">
            ${b.busNumber}
          </div>
          <div style="width: 30px; height: 30px; border-radius: 50%; background-color: ${markerColor}; border: 2px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 6px rgba(0,0,0,0.25);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-1.1 0-2 .9-2 2v7c0 .6.4 1 1 1h2"/>
              <circle cx="7" cy="17" r="2"/>
              <path d="M9 17h6"/>
              <circle cx="17" cy="17" r="2"/>
            </svg>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-fleet-marker',
        html: busHtml,
        iconSize: [36, 44],
        iconAnchor: [18, 36]
      });

      let marker = multiMarkersRef.current.get(b.busId);
      if (!marker) {
        marker = L.marker([b.lat, b.lng], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          if (onSelectBus) onSelectBus(b.busNumber);
        });
        multiMarkersRef.current.set(b.busId, marker);
      } else {
        marker.setLatLng([b.lat, b.lng]);
        marker.setIcon(customIcon);
      }
    });
  }, [multiBuses, onSelectBus]);

  const handleCenterOnBus = () => {
    if (mapInstanceRef.current && location) {
      mapInstanceRef.current.setView([location.lat, location.lng], 15, { animate: true });
    }
  };

  const handleFitBounds = () => {
    if (!mapInstanceRef.current) return;
    if (polylineRef.current) {
      mapInstanceRef.current.fitBounds(polylineRef.current.getBounds(), { padding: [30, 30] });
    } else if (stops.length > 0) {
      const bounds = L.latLngBounds(stops.map(s => [s.lat, s.lng]));
      mapInstanceRef.current.fitBounds(bounds, { padding: [30, 30] });
    }
  };

  if (lowBandwidthMode) {
    return (
      <div className={`bg-slate-100 border border-slate-300 rounded-xl p-5 ${className}`}>
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-3">
          <Navigation className="w-5 h-5 text-emerald-600" />
          <span>{t('lowBandwidthToggle')} Active</span>
        </div>
        <p className="text-xs text-slate-600 mb-4">
          Map rendering disabled to conserve data. Viewing clean textual transit coordinates and upcoming stops.
        </p>
        {location ? (
          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm space-y-2 text-sm">
            <div className="flex justify-between font-bold text-slate-900">
              <span>{busNumber || 'Bus Location'}</span>
              <span className={location.isStale ? 'text-amber-600' : 'text-emerald-600'}>
                {location.isStale ? 'Stale GPS' : 'Live Tracking'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>Latitude: <span className="font-mono text-slate-900">{location.lat.toFixed(5)}</span></div>
              <div>Longitude: <span className="font-mono text-slate-900">{location.lng.toFixed(5)}</span></div>
              <div>Speed: <span className="font-bold text-slate-900">{location.speed} km/h</span></div>
              <div>Accuracy: <span className="font-bold text-slate-900">±{location.accuracy}m</span></div>
            </div>
            <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              Last GPS sync: {new Date(location.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ) : (
          <div className="text-xs text-slate-500 italic p-3 bg-white rounded border border-dashed border-slate-200">
            No active GPS location currently selected.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden border border-slate-200 shadow-2xs bg-slate-100 ${className}`}>
      {/* Map Element */}
      <div ref={mapContainerRef} style={{ height }} className="w-full" />

      {/* Stale Warning Overlay */}
      {staleWarning && (
        <div className="absolute top-3 left-3 right-3 sm:right-auto sm:max-w-md z-[500] bg-amber-600 text-white text-xs px-3 py-2 rounded-md shadow-xs border border-amber-700 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-200" />
          <span className="font-medium text-[11px] leading-tight">{staleWarning}</span>
        </div>
      )}

      {/* Control Buttons */}
      <div className="absolute bottom-3 right-3 z-[500] flex flex-col gap-1.5">
        {location && (
          <button
            onClick={handleCenterOnBus}
            title="Center on Bus"
            className="bg-white hover:bg-slate-50 text-slate-800 p-2 rounded-md shadow-2xs border border-slate-200 flex items-center gap-1.5 text-xs font-semibold transition cursor-pointer"
          >
            <Navigation className="w-3.5 h-3.5 text-emerald-700" />
            <span className="hidden sm:inline">Center Bus</span>
          </button>
        )}
        <button
          onClick={handleFitBounds}
          title="Fit Route Bounds"
          className="bg-white hover:bg-slate-50 text-slate-800 px-2.5 py-1.5 rounded-md shadow-2xs border border-slate-200 text-xs font-semibold transition cursor-pointer"
        >
          Fit Route
        </button>
      </div>
    </div>
  );
};
