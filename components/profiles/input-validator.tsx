import { useState, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isInputSafe } from '@/lib/sanitize';

interface InputValidatorProps {
  value: string;
  onChange: (value: string) => void;
  onValidationChange?: (isValid: boolean, sanitizedValue?: string) => void;
  className?: string;
  label?: string;
  placeholder?: string;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  customValidator?: (value: string) => Promise<{ isValid: boolean; message: string }>;
  showSecurityIndicator?: boolean;
}

export function InputValidator({
  value,
  onChange,
  onValidationChange,
  className,
  label,
  placeholder,
  type = 'text',
  autoComplete,
  required = false,
  minLength,
  maxLength,
  pattern,
  customValidator,
  showSecurityIndicator = true,
}: InputValidatorProps) {
  const [validationState, setValidationState] = useState<{
    isValid: boolean;
    message: string;
    isSafe: boolean;
  }>({ isValid: true, message: '', isSafe: true });
  const [isValidating, setIsValidating] = useState(false);

  const validateInput = useCallback(async (inputValue: string) => {
    if (!inputValue && !required) {
      setValidationState({ isValid: true, message: '', isSafe: true });
      onValidationChange?.(true, inputValue);
      return;
    }

    if (!inputValue && required) {
      setValidationState({ 
        isValid: false, 
        message: `${label || 'Campo'} è richiesto`, 
        isSafe: true 
      });
      onValidationChange?.(false);
      return;
    }

    setIsValidating(true);

    try {
      // Check for XSS and malicious content
      const isSafe = isInputSafe(inputValue);
      if (!isSafe) {
        setValidationState({
          isValid: false,
          message: 'Input contiene contenuto potenzialmente pericoloso',
          isSafe: false
        });
        onValidationChange?.(false);
        return;
      }

      // Length validation
      if (minLength && inputValue.length < minLength) {
        setValidationState({
          isValid: false,
          message: `Minimo ${minLength} caratteri richiesti`,
          isSafe: true
        });
        onValidationChange?.(false);
        return;
      }

      if (maxLength && inputValue.length > maxLength) {
        setValidationState({
          isValid: false,
          message: `Massimo ${maxLength} caratteri consentiti`,
          isSafe: true
        });
        onValidationChange?.(false);
        return;
      }

      // Pattern validation
      if (pattern && !pattern.test(inputValue)) {
        setValidationState({
          isValid: false,
          message: 'Formato non valido',
          isSafe: true
        });
        onValidationChange?.(false);
        return;
      }

      // Custom validation
      if (customValidator) {
        const customResult = await customValidator(inputValue);
        if (!customResult.isValid) {
          setValidationState({
            isValid: false,
            message: customResult.message,
            isSafe: true
          });
          onValidationChange?.(false);
          return;
        }
      }

      // All validations passed
      setValidationState({
        isValid: true,
        message: 'Input valido',
        isSafe: true
      });
      onValidationChange?.(true, inputValue);

    } catch (error) {
      console.error('Error during validation:', error);
      setValidationState({
        isValid: false,
        message: 'Errore durante la validazione',
        isSafe: true
      });
      onValidationChange?.(false);
    } finally {
      setIsValidating(false);
    }
  }, [label, required, minLength, maxLength, pattern, customValidator, onValidationChange]);

  // Debounced validation
  useEffect(() => {
    const timer = setTimeout(() => {
      validateInput(value);
    }, 300);

    return () => clearTimeout(timer);
  }, [value, validateInput]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    
    // Immediate basic safety check
    if (!isInputSafe(newValue)) {
      // Don't update the value if it's unsafe
      return;
    }
    
    onChange(newValue);
  };

  const getInputClassName = () => {
    if (isValidating) return 'opacity-70';
    if (!value) return '';
    if (!validationState.isSafe) return 'border-red-600 bg-red-50';
    if (!validationState.isValid) return 'border-red-500';
    return 'border-green-500';
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <div className="flex items-center gap-2">
          <Label htmlFor={label.toLowerCase().replace(/\s+/g, '-')}>
            {label}
          </Label>
          {showSecurityIndicator && validationState.isSafe && value && (
            <Shield className="h-3 w-3 text-green-500" title="Input sicuro" />
          )}
        </div>
      )}
      
      <Input
        id={label?.toLowerCase().replace(/\s+/g, '-')}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        className={cn(getInputClassName())}
        disabled={isValidating}
        autoComplete={autoComplete}
      />

      {/* Security Warning */}
      {value && !validationState.isSafe && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="ml-2 text-sm">Contenuto non sicuro</AlertTitle>
          <AlertDescription className="ml-2 text-xs">
            L'input contiene caratteri o pattern potenzialmente pericolosi
          </AlertDescription>
        </Alert>
      )}

      {/* Validation Error */}
      {value && validationState.isSafe && !validationState.isValid && (
        <Alert variant="destructive" className="py-2">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="ml-2 text-sm">Input non valido</AlertTitle>
          <AlertDescription className="ml-2 text-xs">
            {validationState.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Success State */}
      {value && validationState.isValid && validationState.isSafe && !isValidating && (
        <Alert variant="default" className="py-2 bg-green-50 border-green-500 text-green-700">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertTitle className="ml-2 text-sm">Input valido</AlertTitle>
          <AlertDescription className="ml-2 text-xs">
            {validationState.message}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}