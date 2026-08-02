import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useRideStore, Ride } from '../store/useRideStore';
import { initSocket, getSocket } from '../services/socket';
import { api } from '../services/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import styles from './RiderDashboard.module.css';

const center = { lat: 40.7128, lng: -74.0060 }; // Default NY

export const RiderDashboard: React.FC = () => {
  const { accessToken } = useAuthStore();
  const { isOnDuty, setIsOnDuty, currentRide, setCurrentRide, updateRideStatus } = useRideStore();
  
  const [rideOffer, setRideOffer] = useState<Ride | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
  });

  useEffect(() => {
    if (accessToken) {
      const socket = initSocket(accessToken);

      socket.on('rideOffer', (ride: Ride) => {
        if (!currentRide) {
          setRideOffer(ride);
        }
      });

      socket.on('rideCanceled', () => {
        setRideOffer(null);
        setCurrentRide(null);
      });
    }
  }, [accessToken, currentRide, setCurrentRide]);

  const handleDutyToggle = () => {
    const socket = getSocket();
    if (!socket) return;

    if (isOnDuty) {
      socket.emit('goOffDuty');
      setIsOnDuty(false);
    } else {
      socket.emit('goOnDuty', { latitude: center.lat, longitude: center.lng });
      setIsOnDuty(true);
    }
  };

  const handleAcceptRide = async () => {
    if (!rideOffer || !accessToken) return;
    
    setIsAccepting(true);
    try {
      const socket = getSocket();
      
      const res = await api.acceptRide(accessToken, rideOffer._id, {
        vehicle: rideOffer.vehicle
      });
      
      setCurrentRide(res.ride || rideOffer);
      setRideOffer(null);
      
      if (socket) {
        socket.emit('rideAccepted');
        
        // Start broadcasting location periodically (mocked)
        setInterval(() => {
          socket.emit('updateLocation', { latitude: center.lat, longitude: center.lng });
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to accept ride:', error);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleStatusUpdate = async (status: 'START' | 'ARRIVED' | 'COMPLETED') => {
    if (!currentRide || !accessToken) return;
    try {
      await api.updateRideStatus(accessToken, currentRide._id, status);
      updateRideStatus(status);
      if (status === 'COMPLETED') {
        setCurrentRide(null);
      }
    } catch (error) {
      console.error('Failed to update status', error);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.mapContainer}>
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={14}
            options={{
              disableDefaultUI: true,
              styles: [
                { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
                { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
              ]
            }}
          />
        ) : (
          <div className={styles.mapPlaceholder}>Loading Map...</div>
        )}
      </div>

      {!currentRide && (
        <div className={styles.floatingHeader}>
          <span className={styles.statusText}>
            {isOnDuty ? 'You are Online' : 'You are Offline'}
          </span>
          <label className={styles.switch}>
            <input 
              type="checkbox" 
              checked={isOnDuty} 
              onChange={handleDutyToggle} 
            />
            <span className={styles.slider}></span>
          </label>
        </div>
      )}

      {currentRide && (
        <div className={styles.activeRidePanel}>
          <h2>Current Ride</h2>
          <div className={styles.rideOfferDetails}>
            <div className={styles.detailRow}>
              <span className={styles.label}>Pickup</span>
              <span className={styles.value}>{currentRide.pickup.address}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Drop-off</span>
              <span className={styles.value}>{currentRide.drop.address}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.label}>Status</span>
              <span className={styles.value}>{currentRide.status}</span>
            </div>
          </div>

          <div className={styles.offerActions}>
            {currentRide.status === 'SEARCHING_FOR_RIDER' || currentRide.status === 'START' ? (
              <Button fullWidth onClick={() => handleStatusUpdate('ARRIVED')}>
                Mark as Arrived
              </Button>
            ) : currentRide.status === 'ARRIVED' ? (
              <Button fullWidth variant="primary" onClick={() => handleStatusUpdate('COMPLETED')}>
                Complete Ride
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <Modal 
        isOpen={!!rideOffer} 
        onClose={() => setRideOffer(null)} 
        title="New Ride Request!"
      >
        {rideOffer && (
          <>
            <div className={styles.rideOfferDetails}>
              <div className={styles.detailRow}>
                <span className={styles.label}>Pickup</span>
                <span className={styles.value}>{rideOffer.pickup.address}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Drop-off</span>
                <span className={styles.value}>{rideOffer.drop.address}</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Distance</span>
                <span className={styles.value}>{rideOffer.distance.toFixed(1)} km</span>
              </div>
              <div className={styles.detailRow}>
                <span className={styles.label}>Est. Fare</span>
                <span className={styles.value + ' ' + styles.fare}>${rideOffer.fare}</span>
              </div>
            </div>
            <div className={styles.offerActions}>
              <Button 
                variant="secondary" 
                fullWidth 
                onClick={() => setRideOffer(null)}
                disabled={isAccepting}
              >
                Decline
              </Button>
              <Button 
                variant="primary" 
                fullWidth 
                onClick={handleAcceptRide}
                isLoading={isAccepting}
              >
                Accept Ride
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
};
