import React, { useState, useEffect } from 'react';
import { stripDangerousCharacters } from '../utils/sanitizer';

export interface SanitizedInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string | number | undefined;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>, sanitizedValue: string) => void;
  sanitizeOn?: 'change' | 'blur' | 'both';
  trimOnBlur?: boolean;
  showSanitizeBadge?: boolean;
}

/**
 * SanitizedInput
 * A secure input wrapper that automatically prevents illegal characters, XSS injections,
 * and malicious scripts from entering the local database state during onChange and onBlur events.
 */
export const SanitizedInput: React.FC<SanitizedInputProps> = ({
  value,
  onChange,
  onBlur,
  sanitizeOn = 'both',
  trimOnBlur = true,
  showSanitizeBadge = false,
  className = '',
  id,
  type = 'text',
  ...rest
}) => {
  const [internalValue, setInternalValue] = useState<string>(value !== undefined && value !== null ? String(value) : '');
  const [wasCleaned, setWasCleaned] = useState<boolean>(false);

  // Keep internal state in sync with parent prop
  useEffect(() => {
    setInternalValue(value !== undefined && value !== null ? String(value) : '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    
    if (sanitizeOn === 'change' || sanitizeOn === 'both') {
      // Strip dangerous characters on input (e.g. <script>, javascript:, etc.)
      const cleaned = stripDangerousCharacters(rawVal);
      const isDirty = cleaned !== rawVal;
      if (isDirty) {
        setWasCleaned(true);
        setTimeout(() => setWasCleaned(false), 2000);
      }
      setInternalValue(cleaned);
      if (onChange) {
        onChange(e, cleaned);
      }
    } else {
      setInternalValue(rawVal);
      if (onChange) {
        onChange(e, rawVal);
      }
    }
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let finalVal = internalValue;

    if (trimOnBlur) {
      finalVal = finalVal.trim();
    }

    if (sanitizeOn === 'blur' || sanitizeOn === 'both') {
      const sanitized = stripDangerousCharacters(finalVal);
      if (sanitized !== finalVal) {
        setWasCleaned(true);
        setTimeout(() => setWasCleaned(false), 2000);
      }
      finalVal = sanitized;
    }

    setInternalValue(finalVal);

    // If value changed due to blur sanitization, notify parent
    if (finalVal !== (value !== undefined && value !== null ? String(value) : '') && onChange) {
      const syntheticEvent = {
        ...e,
        target: {
          ...e.target,
          value: finalVal,
          id: id || e.target.id,
        },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent, finalVal);
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  return (
    <div className="relative w-full">
      <input
        {...rest}
        id={id}
        type={type}
        value={internalValue}
        onChange={handleChange}
        onBlur={handleBlur}
        className={className}
      />
      {showSanitizeBadge && wasCleaned && (
        <span
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-bold text-emerald-700 bg-emerald-100 dark:bg-emerald-950/70 dark:text-emerald-300 px-1.5 py-0.5 rounded-md pointer-events-none transition-opacity"
          title="Input telah disanitasi secara otomatis"
        >
          Disanitasi
        </span>
      )}
    </div>
  );
};
