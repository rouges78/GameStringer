'use client';

import React from 'react';

interface ToastContainerProps {
  maxToasts?: number;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  autoHideDuration?: number;
}

// Stub component - toast sono gestiti dal sistema sonner/toast esistente
const ToastContainer: React.FC<ToastContainerProps> = () => {
  return null;
};

export default ToastContainer;
