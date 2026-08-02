import { create } from 'zustand';

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Ride {
  _id: string;
  vehicle: 'bike' | 'auto' | 'cabEconomy' | 'cabPremium';
  distance: number;
  pickup: Location;
  drop: Location;
  fare: number;
  status: 'SEARCHING_FOR_RIDER' | 'START' | 'ARRIVED' | 'COMPLETED';
  customer: string;
  rider?: string | null;
}

interface RideState {
  currentRide: Ride | null;
  isOnDuty: boolean; // For riders
  setCurrentRide: (ride: Ride | null) => void;
  setIsOnDuty: (status: boolean) => void;
  updateRideStatus: (status: Ride['status']) => void;
}

export const useRideStore = create<RideState>((set) => ({
  currentRide: null,
  isOnDuty: false,
  setCurrentRide: (ride) => set({ currentRide: ride }),
  setIsOnDuty: (status) => set({ isOnDuty: status }),
  updateRideStatus: (status) => set((state) => ({
    currentRide: state.currentRide ? { ...state.currentRide, status } : null
  })),
}));
