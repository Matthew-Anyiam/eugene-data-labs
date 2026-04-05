import { useQuery } from '@tanstack/react-query';
import { eugeneApi } from '../lib/api';

// ---------------------------------------------------------------------------
// NASA GIBS satellite imagery layers
// ---------------------------------------------------------------------------

interface GIBSLayer {
  key: string;
  layer_id: string;
  title: string;
  category: string;
  description: string;
  format: string;
}

interface GIBSTileConfig {
  key: string;
  layer_id: string;
  title: string;
  category: string;
  description: string;
  url_template: string;
  format: string;
  date: string;
  attribution: string;
  max_zoom: number;
  center?: { lat: number; lng: number };
}

export function useSatelliteLayers(category?: string) {
  return useQuery({
    queryKey: ['satellite-layers', category],
    queryFn: () =>
      eugeneApi<{ layers: GIBSLayer[]; count: number }>(
        '/v1/world/satellite/layers',
        category ? { category } : undefined,
      ),
    staleTime: 24 * 60 * 60 * 1000, // layers don't change — 24h
  });
}

export function useSatelliteTiles(layer: string, date?: string) {
  return useQuery({
    queryKey: ['satellite-tiles', layer, date],
    queryFn: () =>
      eugeneApi<GIBSTileConfig>('/v1/world/satellite/tiles', { layer, date }),
    staleTime: 60 * 60 * 1000, // 1h — tiles update daily
    enabled: !!layer,
  });
}

export function useSatelliteImagery(lat: number, lng: number, date?: string) {
  return useQuery({
    queryKey: ['satellite-imagery', lat, lng, date],
    queryFn: () =>
      eugeneApi<{ location: { lat: number; lng: number }; date: string; layers: GIBSTileConfig[] }>(
        '/v1/world/satellite/imagery',
        { lat, lng, date },
      ),
    staleTime: 60 * 60 * 1000,
    enabled: lat !== 0 || lng !== 0,
  });
}

// ---------------------------------------------------------------------------
// NASA EONET natural events
// ---------------------------------------------------------------------------

interface NASAEvent {
  id: string;
  title: string;
  category_id: string;
  category: string;
  lat: number;
  lng: number;
  date: string;
  geometry_type: string;
  observation_count: number;
  sources: { id: string; url: string }[];
  closed: string | null;
  type: string;
  source: string;
}

interface EONETCategory {
  id: string;
  title: string;
  description: string;
}

export function useNASAEvents(category?: string, days = 30, limit = 50) {
  return useQuery({
    queryKey: ['nasa-events', category, days, limit],
    queryFn: () =>
      eugeneApi<{ events: NASAEvent[]; count: number; title: string }>(
        '/v1/world/nasa/events',
        { category, days, limit },
      ),
    staleTime: 30 * 60 * 1000, // 30min
  });
}

export function useNASACategories() {
  return useQuery({
    queryKey: ['nasa-categories'],
    queryFn: () =>
      eugeneApi<{ categories: EONETCategory[] }>('/v1/world/nasa/categories'),
    staleTime: 24 * 60 * 60 * 1000, // 24h
  });
}
