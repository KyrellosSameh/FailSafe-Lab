import React, { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'glass';
  padding?: 'none' | 'small' | 'medium' | 'large';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  className = '',
  ...props
}) => {
  const combinedClassName = [
    styles.card,
    styles[`variant-${variant}`],
    styles[`padding-${padding}`],
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={combinedClassName} {...props}>
      {children}
    </div>
  );
};
