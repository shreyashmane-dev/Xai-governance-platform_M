"use client";

import { useState, useEffect } from 'react';
import { ApiService } from '@/services/api-service';

export function useHealth() {
  const [status, setStatus] = useState<'online' | 'offline' | 'loading'>('loading');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const res = await ApiService.checkHealth();
        if (isMounted) {
          setStatus(res.status === 'ok' ? 'online' : 'offline');
          setData(res);
        }
      } catch (err) {
        if (isMounted) {
          setStatus('offline');
        }
      }
    }

    check();
    const interval = setInterval(check, 30000); // Check every 30s

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return { status, data };
}
