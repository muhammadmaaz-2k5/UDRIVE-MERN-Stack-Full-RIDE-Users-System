import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettingsStore } from '../store/useSettingsStore';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import styles from './Settings.module.css';

export const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { mapProvider, setMapProvider } = useSettingsStore();

  return (
    <div className={styles.container}>
      <button className={styles.backButton} onClick={() => navigate(-1)}>
        <ArrowLeft size={24} />
      </button>

      <div className={styles.content}>
        <h1 className={styles.title}>Settings</h1>
        <p className={styles.subtitle}>Manage your app preferences.</p>

        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>Map Provider</h2>
          
          <div 
            className={`${styles.optionCard} ${mapProvider === 'osm' ? styles.selected : ''}`}
            onClick={() => setMapProvider('osm')}
          >
            <div className={styles.optionInfo}>
              <span className={styles.optionName}>OpenStreetMap (Free)</span>
              <span className={styles.optionDesc}>Community-driven open data map provider. Works out of the box.</span>
            </div>
            {mapProvider === 'osm' && <CheckCircle2 color="var(--accent-primary)" size={24} />}
          </div>

          <div 
            className={`${styles.optionCard} ${mapProvider === 'google' ? styles.selected : ''}`}
            onClick={() => setMapProvider('google')}
          >
            <div className={styles.optionInfo}>
              <span className={styles.optionName}>Google Maps (Premium)</span>
              <span className={styles.optionDesc}>High-quality commercial maps. Requires API Key.</span>
            </div>
            {mapProvider === 'google' && <CheckCircle2 color="var(--accent-primary)" size={24} />}
          </div>
        </div>
      </div>
    </div>
  );
};
