import { useEffect, useState, useRef } from 'react';
import { useLocation } from 'react-router-dom';

export function LoadingBar() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    // Start loading on route change
    setLoading(true);
    setProgress(0);
    setVisible(true);

    // Quickly advance to ~80%
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 15 + 5;
      if (current > 85) current = 85;
      setProgress(current);
    }, 80);

    // Complete after a short delay (simulating load)
    timerRef.current = setTimeout(() => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setProgress(100);
      setLoading(false);
      // Hide the bar after transition
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 200);
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [location.pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[60] h-[2px]"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
    >
      <div
        className="h-full bg-indigo-500 transition-all duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: loading ? 1 : 0,
          boxShadow: '0 0 8px rgba(99, 102, 241, 0.4)',
        }}
      />
    </div>
  );
}
