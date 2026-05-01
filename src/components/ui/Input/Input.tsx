import React, { InputHTMLAttributes } from 'react';
import styles from './Input.module.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  fullWidth = false,
  className = '',
  ...props
}) => {
  const containerClass = [
    styles.container,
    fullWidth ? styles.fullWidth : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={containerClass}>
      {label && <label className={styles.label}>{label}</label>}
      <input 
        className={`${styles.input} ${error ? styles.inputError : ''}`} 
        {...props} 
      />
      {error && <span className={styles.errorMessage}>{error}</span>}
    </div>
  );
};
