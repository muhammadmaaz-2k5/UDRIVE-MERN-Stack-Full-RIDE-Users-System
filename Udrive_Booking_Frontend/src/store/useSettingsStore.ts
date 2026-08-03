import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type MapProvider = 'google' | 'osm';

interface SettingsState {
  mapProvider: MapProvider;
  setMapProvider: (provider: MapProvider) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      mapProvider: 'osm', // default to open street map as requested
      setMapProvider: (provider) => set({ mapProvider: provider }),
    }),
    {
      name: 'udrive-settings',
    }
  )
);
