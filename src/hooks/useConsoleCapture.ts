/**
 * Console Capture Hook
 *
 * Captures console.error calls for bug reporting purposes.
 */

import { useEffect, useState, useRef } from 'react';

const MAX_ERRORS = 20;

export function useConsoleCapture(): string[] {
  const [errors, setErrors] = useState<string[]>([]);
  const errorsRef = useRef<string[]>([]);

  useEffect(() => {
    // Store original console.error
    const originalError = console.error;

    // Override console.error
    console.error = (...args: unknown[]) => {
      // Call original
      originalError.apply(console, args);

      // Capture error message
      const message = args
        .map((arg) => {
          if (arg instanceof Error) {
            return `${arg.message}\n${arg.stack || ''}`;
          }
          return String(arg);
        })
        .join(' ');

      // Add to captured errors (keep last MAX_ERRORS)
      const newErrors = [...errorsRef.current, message].slice(-MAX_ERRORS);
      errorsRef.current = newErrors;
      setErrors(newErrors);
    };

    // Capture unhandled errors
    const handleError = (event: ErrorEvent) => {
      const message = `Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
      const newErrors = [...errorsRef.current, message].slice(-MAX_ERRORS);
      errorsRef.current = newErrors;
      setErrors(newErrors);
    };

    // Capture unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      const message = `Unhandled promise rejection: ${event.reason}`;
      const newErrors = [...errorsRef.current, message].slice(-MAX_ERRORS);
      errorsRef.current = newErrors;
      setErrors(newErrors);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    // Cleanup
    return () => {
      console.error = originalError;
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return errors;
}
