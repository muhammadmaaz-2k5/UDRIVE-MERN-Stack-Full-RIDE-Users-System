import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import styles from './Welcome.module.css';
import { Car, User } from 'lucide-react';

export const Welcome: React.FC = () => {
  const navigate = useNavigate();

  const handleRoleSelection = (role: 'customer' | 'rider') => {
    navigate(`/login?role=${role}`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.heroImage}>
        <div className={styles.heroOverlay}></div>
      </div>
      
      <div className={styles.content}>
        <h1 className={styles.logo}>UDRIVE</h1>
        <p className={styles.subtitle}>Premium rides at your fingertips. Where to next?</p>
        
        <div className={styles.actions}>
          <Button 
            variant="primary" 
            fullWidth 
            onClick={() => handleRoleSelection('customer')}
          >
            <User size={20} style={{ marginRight: '8px' }} />
            I need a ride
          </Button>
          
          <Button 
            variant="secondary" 
            fullWidth 
            onClick={() => handleRoleSelection('rider')}
          >
            <Car size={20} style={{ marginRight: '8px' }} />
            I want to drive
          </Button>
        </div>
      </div>
    </div>
  );
};
