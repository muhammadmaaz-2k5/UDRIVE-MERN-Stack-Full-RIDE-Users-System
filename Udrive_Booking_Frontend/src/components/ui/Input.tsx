import React from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className={`${styles.wrapper} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputContainer}>
        <input 
          className={`${styles.input} ${error ? styles.error : ''}`} 
          {...props} 
        />
      </div>
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
};
