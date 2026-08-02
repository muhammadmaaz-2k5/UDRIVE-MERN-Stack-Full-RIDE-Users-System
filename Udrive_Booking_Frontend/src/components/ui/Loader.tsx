import React from 'react';
import { Loader2 } from 'lucide-react';
import styles from './Loader.module.css';

interface LoaderProps {
  text?: string;
  fullScreen?: boolean;
  size?: number;
}

export const Loader: React.FC<LoaderProps> = ({ 
  text = 'Loading...', 
  fullScreen = false,
  size = 40 
}) => {
  return (
    <div className={`${styles.container} ${fullScreen ? styles.fullScreen : ''}`}>
      <Loader2 size={size} className={styles.spinner} />
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
};
