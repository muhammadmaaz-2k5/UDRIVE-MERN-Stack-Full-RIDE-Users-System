import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore, Ride } from '../store/useRideStore';
import { initSocket, getSocket } from '../services/socket';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { MapPin, Navigation, Car, Bike, X } from 'lucide-react';
import styles from './CustomerDashboard.module.css';
import { GoogleMap, useJsApiLoader, Marker } from '@react-google-maps/api';

const center = { lat: 40.7128, lng: -74.0060 }; // Default to NY

const vehicles = [
  { id: 'bike', name: 'Bike', price: 5, icon: Bike },
  { id: 'auto', name: 'Auto', price: 10, icon: Car },
  { id: 'cabEconomy', name: 'Economy', price: 15, icon: Car },
  { id: 'cabPremium', name: 'Premium', price: 25, icon: Car },
];

export const CustomerDashboard: React.FC = () => {
  const { user, accessToken } = useAuthStore();
  const { currentRide, setCurrentRide } = useRideStore();
  
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('cabEconomy');
  const [isLoading, setIsLoading] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{lat: number, lng: number} | null>(null);
  
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  useEffect(() => {
    if (accessToken) {
      const socket = initSocket(accessToken);
      
      // Emit zone subscription (mock location for now)
      socket.emit('subscribeToZone', { latitude: center.lat, longitude: center.lng });

      socket.on('nearbyriders', (riders) => {
        console.log('Nearby riders:', riders);
      });

      socket.on('rideAccepted', (data) => {
        console.log('Ride accepted!', data);
        setCurrentRide(data.ride);
        // Subscribe to this specific rider's location updates
        if (data.ride.rider) {
          socket.emit('subscribeToriderLocation', data.ride.rider._id || data.ride.rider);
        }
      });

      socket.on('riderLocationUpdate', (data) => {
        setRiderLocation({ lat: data.coords.latitude, lng: data.coords.longitude });
      });

      socket.on('rideCanceled', () => {
        setCurrentRide(null);
        setRiderLocation(null);
        alert("The ride was canceled.");
      });
      
      // Additional status updates could be handled by a generic rideData update event 
      // but for now we'll assume the client fetches or listens.
      socket.on('rideData', (rideData) => {
        setCurrentRide(rideData);
      });
    }
  }, [accessToken, setCurrentRide]);

  const handleCancelRide = () => {
    const socket = getSocket();
    if (socket && currentRide) {
      socket.emit('cancelRide');
      setCurrentRide(null);
      setRiderLocation(null);
    }
  };

  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup || !dropoff || !accessToken) return;

    setIsLoading(true);
    try {
      // Mocking coordinates for the ride payload since we don't have Places API hooked up
      const ridePayload = {
        vehicle: selectedVehicle,
        distance: 5.2, // mock km
        fare: vehicles.find(v => v.id === selectedVehicle)?.price || 10,
        pickup: { address: pickup, latitude: center.lat, longitude: center.lng },
        drop: { address: dropoff, latitude: center.lat + 0.05, longitude: center.lng + 0.05 },
      };

      const res = await api.createRide(accessToken, ridePayload);
      setCurrentRide(res.ride);
      
      // Notify socket server
      const socket = getSocket();
      if (socket) {
        socket.emit('searchrider', res.ride._id);
      }
    } catch (error) {
      console.error('Failed to create ride:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mapContainer}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={riderLocation || center}
            zoom={14}
            options={{
              disableDefaultUI: true,
              styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              ]
            }}
          >
            {riderLocation && (
              <Marker position={riderLocation} icon={{ url: '/car-icon.svg', scaledSize: new window.google.maps.Size(40, 40) }} />
            )}
          </GoogleMap>
        ) : (
          <div className={styles.mapPlaceholder}>Loading Map...</div>
        )}
      </div>

      <div className={styles.floatingPanel}>
        {currentRide ? (
          <div>
            <div className={styles.headerRow}>
              <h2 className={styles.title}>
                {currentRide.status === 'SEARCHING_FOR_RIDER' ? 'Finding a driver...' : 
                 currentRide.status === 'START' ? 'Driver is on the way' : 
                 currentRide.status === 'ARRIVED' ? 'Driver has arrived!' : 'Ride in progress'}
              </h2>
              <button className={styles.cancelButton} onClick={handleCancelRide}><X size={20} /></button>
            </div>
            
            {currentRide.status === 'SEARCHING_FOR_RIDER' ? (
              <Loader text="Waiting for driver to accept" size={30} />
            ) : (
              <div className={styles.rideInfo}>
                <div className={styles.infoRow}><Car size={18} /> <span>{currentRide.vehicle.toUpperCase()}</span></div>
                <div className={styles.infoRow}><MapPin size={18} /> <span>{currentRide.pickup.address}</span></div>
                <div className={styles.infoRow}><Navigation size={18} /> <span>{currentRide.drop.address}</span></div>
              </div>
            )}
          </div>
        ) : (
          <form className={styles.form} onSubmit={handleCreateRide}>
            <h2 className={styles.title}>Where to?</h2>
            
            <Input 
              placeholder="Pickup Location" 
              value={pickup}
              onChange={(e) => setPickup(e.target.value)}
              required
            />
            
            <Input 
              placeholder="Destination" 
              value={dropoff}
              onChange={(e) => setDropoff(e.target.value)}
              required
            />

            <div className={styles.vehicleSelection}>
              {vehicles.map((v) => {
                const Icon = v.icon;
                return (
                  <div 
                    key={v.id} 
                    className={`${styles.vehicleCard} ${selectedVehicle === v.id ? styles.selected : ''}`}
                    onClick={() => setSelectedVehicle(v.id)}
                  >
                    <Icon size={24} color={selectedVehicle === v.id ? 'var(--accent-primary)' : 'var(--text-secondary)'} />
                    <span className={styles.vehicleName}>{v.name}</span>
                    <span className={styles.vehiclePrice}>${v.price}</span>
                  </div>
                );
              })}
            </div>

            <Button type="submit" fullWidth isLoading={isLoading}>
              Request Ride
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};
