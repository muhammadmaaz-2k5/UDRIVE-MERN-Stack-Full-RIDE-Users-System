import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore, type Ride } from '../store/useRideStore';
import { useSettingsStore } from '../store/useSettingsStore';
import { initSocket, getSocket } from '../services/socket';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import { MapPin, Navigation, Car, Bike, X, Settings } from 'lucide-react';
import styles from './CustomerDashboard.module.css';
import { GoogleMap, useJsApiLoader, Marker as GoogleMarker } from '@react-google-maps/api';
import { MapContainer, TileLayer, Marker as LeafletMarker } from 'react-leaflet';
import L from 'leaflet';

const center = { lat: 40.7128, lng: -74.0060 }; // Default to NY

const vehicles = [
  { id: 'bike', name: 'Bike', price: 5, icon: Bike },
  { id: 'auto', name: 'Auto', price: 10, icon: Car },
  { id: 'cabEconomy', name: 'Economy', price: 15, icon: Car },
  { id: 'cabPremium', name: 'Premium', price: 25, icon: Car },
];

const customIcon = new L.Icon({
  iconUrl: '/car-icon.svg',
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

export const CustomerDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken } = useAuthStore();
  const { currentRide, setCurrentRide } = useRideStore();
  const { mapProvider } = useSettingsStore();
  
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('cabEconomy');
  const [isLoading, setIsLoading] = useState(false);
  const [riderLocation, setRiderLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  
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
      setIsBookingModalOpen(false);
    } catch (error) {
      console.error('Failed to create ride:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <button className={styles.settingsButton} onClick={() => navigate('/settings')}>
        <Settings size={20} />
      </button>

      <div className={styles.mapContainer}>
        {mapProvider === 'google' ? (
          isLoaded ? (
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
                <GoogleMarker position={riderLocation} icon={{ url: '/car-icon.svg', scaledSize: new window.google.maps.Size(40, 40) }} />
              )}
            </GoogleMap>
          ) : (
            <div className={styles.mapPlaceholder}>Loading Google Maps...</div>
          )
        ) : (
          <MapContainer 
            center={riderLocation ? [riderLocation.lat, riderLocation.lng] : [center.lat, center.lng]} 
            zoom={14} 
            style={{ width: '100%', height: '100%', background: 'var(--bg-primary)' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {riderLocation && (
              <LeafletMarker position={[riderLocation.lat, riderLocation.lng]} icon={customIcon} />
            )}
          </MapContainer>
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
          <div className={styles.searchTrigger} onClick={() => setIsBookingModalOpen(true)}>
            <div className={styles.searchDot} />
            <span className={styles.searchText}>Where to?</span>
          </div>
        )}
      </div>

      <Modal isOpen={isBookingModalOpen} onClose={() => setIsBookingModalOpen(false)} title="Where to?">
        <form className={styles.form} onSubmit={handleCreateRide}>
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
      </Modal>
    </div>
  );
};
