import { useState, useCallback } from 'react';
import { invoke } from '@/lib/tauri-api';

export interface ValidationConfig {
  profile_name: {
    min_length: number;
    max_length: number;
    allowed_chars: string;
  };
  password: {
    min_length: number;
    require_uppercase: boolean;
    require_lowercase: boolean;
    require_digit: boolean;
    require_special: boolean;
    disallow_common: boolean;
  };
}

export interface ValidationResult {
  is_valid: boolean;
  message: string;
  details?: string[];
}

export interface PasswordStrength {
  score: number; // 0-100
  feedback: string;
  is_common: boolean;
  has_uppercase: boolean;
  has_lowercase: boolean;
  has_digit: boolean;
  has_special: boolean;
  is_long_enough: boolean;
}

export function useValidation() {
  const [isLoading, setIsLoading] = useState(false);
  const [validationConfig, setValidationConfig] = useState<ValidationConfig | null>(null);

  const getValidationConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const config = await invoke<ValidationConfig>('get_validation_config');
      setValidationConfig(config);
      return config;
    } catch (error) {
      console.error('Error fetching validation config:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateValidationConfig = useCallback(async (config: ValidationConfig) => {
    setIsLoading(true);
    try {
      await invoke('update_validation_config', { config });
      setValidationConfig(config);
      return true;
    } catch (error) {
      console.error('Error updating validation config:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const validateProfileName = useCallback(async (name: string): Promise<ValidationResult> => {
    try {
      return await invoke<ValidationResult>('validate_profile_name', { name });
    } catch (error) {
      console.error('Error validating profile name:', error);
      return { is_valid: false, message: 'Error validating profile name' };
    }
  }, []);

  const validateUniqueProfileName = useCallback(async (name: string): Promise<ValidationResult> => {
    try {
      return await invoke<ValidationResult>('validate_unique_profile_name', { name });
    } catch (error) {
      console.error('Error validating unique profile name:', error);
      return { is_valid: false, message: 'Error checking name uniqueness' };
    }
  }, []);

  const validatePassword = useCallback(async (password: string): Promise<ValidationResult> => {
    try {
      return await invoke<ValidationResult>('validate_password', { password });
    } catch (error) {
      console.error('Error validating password:', error);
      return { is_valid: false, message: 'Error validating password' };
    }
  }, []);

  const checkPasswordStrength = useCallback(async (password: string): Promise<PasswordStrength> => {
    try {
      return await invoke<PasswordStrength>('check_password_strength_realtime', { password });
    } catch (error) {
      console.error('Error checking password strength:', error);
      return {
        score: 0,
        feedback: 'Error checking password strength',
        is_common: false,
        has_uppercase: false,
        has_lowercase: false,
        has_digit: false,
        has_special: false,
        is_long_enough: false
      };
    }
  }, []);

  const generatePasswordSuggestions = useCallback(async (count: number = 3): Promise<string[]> => {
    try {
      return await invoke<string[]>('generate_password_suggestions', { count });
    } catch (error) {
      console.error('Error generating password suggestions:', error);
      return [];
    }
  }, []);

  const validateProfileCreation = useCallback(async (name: string, password: string): Promise<ValidationResult> => {
    try {
      return await invoke<ValidationResult>('validate_profile_creation', { name, password });
    } catch (error) {
      console.error('Error validating profile creation:', error);
      return { is_valid: false, message: 'Error validating profile creation' };
    }
  }, []);

  const sanitizeInput = useCallback(async (input: string): Promise<string> => {
    try {
      // Try backend sanitization first
      return await invoke<string>('sanitize_input', { input });
    } catch (error) {
      console.error('Error sanitizing input via backend, using frontend fallback:', error);
      // Fallback to frontend sanitization
      const { sanitizeInput: frontendSanitize } = await import('@/lib/sanitize');
      return frontendSanitize(input);
    }
  }, []);

  return {
    isLoading,
    validationConfig,
    getValidationConfig,
    updateValidationConfig,
    validateProfileName,
    validateUniqueProfileName,
    validatePassword,
    checkPasswordStrength,
    generatePasswordSuggestions,
    validateProfileCreation,
    sanitizeInput
  };
}