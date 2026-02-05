/**
 * Real-time Translation Validator
 * Validates translations as they are typed with instant feedback
 */

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  id: string;
  type: string;
  severity: ValidationSeverity;
  message: string;
  suggestion?: string;
  position?: { start: number; end: number };
  autoFixable?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions: string[];
}

export interface ValidationRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: ValidationSeverity;
  validate: (source: string, target: string, context?: ValidationContext) => ValidationIssue | null;
}

export interface ValidationContext {
  sourceLanguage: string;
  targetLanguage: string;
  glossary?: Map<string, string>;
  previousTranslations?: Map<string, string>;
  maxLengthRatio?: number;
  preserveCase?: boolean;
}

// Built-in validation rules
const createRule = (
  id: string,
  name: string,
  severity: ValidationSeverity,
  validate: (source: string, target: string, context?: ValidationContext) => ValidationIssue | null
): ValidationRule => ({ id, name, enabled: true, severity, validate });

const BUILTIN_RULES: ValidationRule[] = [
  // Empty translation
  createRule('empty-target', 'Traduzione vuota', 'error', (source, target) => {
    if (source.trim() && !target.trim()) {
      return {
        id: 'empty-target',
        type: 'empty',
        severity: 'error',
        message: 'La traduzione è vuota',
        suggestion: 'Inserisci una traduzione per questa stringa',
      };
    }
    return null;
  }),

  // Same as source
  createRule('same-as-source', 'Uguale alla sorgente', 'warning', (source, target) => {
    if (source === target && source.length > 3) {
      return {
        id: 'same-as-source',
        type: 'unchanged',
        severity: 'warning',
        message: 'La traduzione è identica al testo sorgente',
        suggestion: 'Verifica se la traduzione è corretta o se necessita modifica',
      };
    }
    return null;
  }),

  // Missing placeholders
  createRule('missing-placeholder', 'Placeholder mancanti', 'error', (source, target) => {
    const placeholderPatterns = [
      /\{[^}]+\}/g,           // {name}, {0}
      /%[sd@]/g,              // %s, %d, %@
      /\$\d+/g,               // $1, $2
      /<[^>]+>/g,             // <b>, </b>
      /\[\[[^\]]+\]\]/g,      // [[variable]]
    ];

    for (const pattern of placeholderPatterns) {
      const sourcePlaceholders = source.match(pattern) || [];
      const targetPlaceholders = target.match(pattern) || [];

      const missing = sourcePlaceholders.filter(p => !targetPlaceholders.includes(p));
      if (missing.length > 0) {
        return {
          id: 'missing-placeholder',
          type: 'placeholder',
          severity: 'error',
          message: `Placeholder mancanti: ${missing.join(', ')}`,
          suggestion: 'Assicurati di includere tutti i placeholder nella traduzione',
          autoFixable: false,
        };
      }
    }
    return null;
  }),

  // Extra placeholders
  createRule('extra-placeholder', 'Placeholder extra', 'warning', (source, target) => {
    const pattern = /\{[^}]+\}|%[sd@]|\$\d+/g;
    const sourcePlaceholders = source.match(pattern) || [];
    const targetPlaceholders = target.match(pattern) || [];

    const extra = targetPlaceholders.filter(p => !sourcePlaceholders.includes(p));
    if (extra.length > 0) {
      return {
        id: 'extra-placeholder',
        type: 'placeholder',
        severity: 'warning',
        message: `Placeholder extra non presenti nella sorgente: ${extra.join(', ')}`,
        suggestion: 'Rimuovi i placeholder non necessari',
      };
    }
    return null;
  }),

  // Length ratio
  createRule('length-ratio', 'Lunghezza anomala', 'warning', (source, target, ctx) => {
    if (source.length < 10) return null; // Skip short strings
    
    const ratio = target.length / source.length;
    const maxRatio = ctx?.maxLengthRatio || 2.0;
    const minRatio = 0.3;

    if (ratio > maxRatio) {
      return {
        id: 'length-ratio-high',
        type: 'length',
        severity: 'warning',
        message: `Traduzione troppo lunga (${Math.round(ratio * 100)}% della sorgente)`,
        suggestion: 'Considera di accorciare la traduzione',
      };
    }
    if (ratio < minRatio) {
      return {
        id: 'length-ratio-low',
        type: 'length',
        severity: 'warning',
        message: `Traduzione troppo corta (${Math.round(ratio * 100)}% della sorgente)`,
        suggestion: 'Verifica che la traduzione sia completa',
      };
    }
    return null;
  }),

  // Trailing/leading spaces
  createRule('whitespace', 'Spazi anomali', 'info', (source, target) => {
    const sourceLeading = source.match(/^\s+/)?.[0] || '';
    const targetLeading = target.match(/^\s+/)?.[0] || '';
    const sourceTrailing = source.match(/\s+$/)?.[0] || '';
    const targetTrailing = target.match(/\s+$/)?.[0] || '';

    if (sourceLeading !== targetLeading || sourceTrailing !== targetTrailing) {
      return {
        id: 'whitespace-mismatch',
        type: 'whitespace',
        severity: 'info',
        message: 'Gli spazi iniziali/finali non corrispondono',
        suggestion: 'Uniforma gli spazi con il testo sorgente',
        autoFixable: true,
      };
    }
    return null;
  }),

  // Punctuation mismatch
  createRule('punctuation', 'Punteggiatura finale', 'info', (source, target) => {
    const sourcePunct = source.match(/[.!?:;]$/)?.[0];
    const targetPunct = target.match(/[.!?:;]$/)?.[0];

    if (sourcePunct && !targetPunct) {
      return {
        id: 'missing-punctuation',
        type: 'punctuation',
        severity: 'info',
        message: `Punteggiatura finale mancante: "${sourcePunct}"`,
        suggestion: `Aggiungi "${sourcePunct}" alla fine`,
        autoFixable: true,
      };
    }
    return null;
  }),

  // Capitalization
  createRule('capitalization', 'Maiuscole/minuscole', 'info', (source, target, ctx) => {
    if (ctx?.preserveCase === false) return null;
    
    const sourceStartsUpper = /^[A-Z]/.test(source);
    const targetStartsUpper = /^[A-Z\u00C0-\u00DC]/.test(target);

    if (sourceStartsUpper && !targetStartsUpper && target.length > 0) {
      return {
        id: 'capitalization-start',
        type: 'capitalization',
        severity: 'info',
        message: 'La traduzione dovrebbe iniziare con maiuscola',
        suggestion: 'Cambia la prima lettera in maiuscolo',
        autoFixable: true,
      };
    }
    return null;
  }),

  // Numbers consistency
  createRule('numbers', 'Numeri inconsistenti', 'warning', (source, target) => {
    const sourceNumbers = source.match(/\d+/g) || [];
    const targetNumbers = target.match(/\d+/g) || [];

    const missing = sourceNumbers.filter(n => !targetNumbers.includes(n));
    if (missing.length > 0) {
      return {
        id: 'missing-numbers',
        type: 'numbers',
        severity: 'warning',
        message: `Numeri mancanti nella traduzione: ${missing.join(', ')}`,
        suggestion: 'Verifica che tutti i numeri siano presenti',
      };
    }
    return null;
  }),

  // Double spaces
  createRule('double-spaces', 'Spazi doppi', 'info', (_, target) => {
    if (/\s{2,}/.test(target)) {
      return {
        id: 'double-spaces',
        type: 'formatting',
        severity: 'info',
        message: 'La traduzione contiene spazi doppi',
        suggestion: 'Rimuovi gli spazi duplicati',
        autoFixable: true,
      };
    }
    return null;
  }),

  // Glossary check
  createRule('glossary', 'Termine glossario', 'warning', (source, target, ctx) => {
    if (!ctx?.glossary) return null;

    for (const [term, translation] of ctx.glossary) {
      if (source.toLowerCase().includes(term.toLowerCase())) {
        if (!target.toLowerCase().includes(translation.toLowerCase())) {
          return {
            id: 'glossary-mismatch',
            type: 'glossary',
            severity: 'warning',
            message: `Il termine "${term}" dovrebbe essere tradotto come "${translation}"`,
            suggestion: `Usa "${translation}" per il termine "${term}"`,
          };
        }
      }
    }
    return null;
  }),
];

class TranslationValidator {
  private rules: ValidationRule[] = [...BUILTIN_RULES];
  private customRules: ValidationRule[] = [];

  // Validate a single translation
  validate(
    source: string,
    target: string,
    context?: ValidationContext
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    const allRules = [...this.rules, ...this.customRules].filter(r => r.enabled);

    for (const rule of allRules) {
      try {
        const issue = rule.validate(source, target, context);
        if (issue) {
          issues.push(issue);
        }
      } catch (error) {
        console.error(`[Validator] Rule "${rule.id}" failed:`, error);
      }
    }

    // Calculate score
    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;
    const infoCount = issues.filter(i => i.severity === 'info').length;

    let score = 100;
    score -= errorCount * 25;
    score -= warningCount * 10;
    score -= infoCount * 2;
    score = Math.max(0, Math.min(100, score));

    // Generate suggestions
    const suggestions = issues
      .filter(i => i.suggestion)
      .map(i => i.suggestion!);

    return {
      isValid: errorCount === 0,
      score,
      issues: issues.sort((a, b) => {
        const severityOrder = { error: 0, warning: 1, info: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      }),
      suggestions,
    };
  }

  // Auto-fix issues where possible
  autoFix(source: string, target: string): string {
    let fixed = target;

    // Fix whitespace
    const sourceLeading = source.match(/^\s*/)?.[0] || '';
    const sourceTrailing = source.match(/\s*$/)?.[0] || '';
    fixed = sourceLeading + fixed.trim() + sourceTrailing;

    // Fix double spaces
    fixed = fixed.replace(/\s{2,}/g, ' ');

    // Fix punctuation
    const sourcePunct = source.match(/[.!?:;]$/)?.[0];
    if (sourcePunct && !fixed.match(/[.!?:;]$/)) {
      fixed = fixed + sourcePunct;
    }

    // Fix capitalization
    if (/^[A-Z]/.test(source) && /^[a-z]/.test(fixed)) {
      fixed = fixed.charAt(0).toUpperCase() + fixed.slice(1);
    }

    return fixed;
  }

  // Add custom rule
  addRule(rule: ValidationRule): void {
    this.customRules.push(rule);
  }

  // Remove rule by ID
  removeRule(ruleId: string): void {
    this.customRules = this.customRules.filter(r => r.id !== ruleId);
  }

  // Enable/disable rule
  toggleRule(ruleId: string, enabled: boolean): void {
    const rule = [...this.rules, ...this.customRules].find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
    }
  }

  // Get all rules
  getRules(): ValidationRule[] {
    return [...this.rules, ...this.customRules];
  }

  // Batch validate
  validateBatch(
    items: Array<{ source: string; target: string }>,
    context?: ValidationContext
  ): Array<{ source: string; target: string; result: ValidationResult }> {
    return items.map(item => ({
      ...item,
      result: this.validate(item.source, item.target, context),
    }));
  }

  // Get validation summary
  getSummary(results: ValidationResult[]): {
    total: number;
    valid: number;
    invalid: number;
    averageScore: number;
    issuesByType: Record<string, number>;
  } {
    const issuesByType: Record<string, number> = {};
    
    results.forEach(r => {
      r.issues.forEach(i => {
        issuesByType[i.type] = (issuesByType[i.type] || 0) + 1;
      });
    });

    return {
      total: results.length,
      valid: results.filter(r => r.isValid).length,
      invalid: results.filter(r => !r.isValid).length,
      averageScore: Math.round(results.reduce((sum, r) => sum + r.score, 0) / results.length),
      issuesByType,
    };
  }
}

// Singleton
export const translationValidator = new TranslationValidator();

// React hook for real-time validation
import { useState, useEffect, useMemo, useCallback } from 'react';

export function useTranslationValidation(
  source: string,
  target: string,
  context?: ValidationContext,
  debounceMs: number = 300
) {
  const [result, setResult] = useState<ValidationResult | null>(null);

  useEffect(() => {
    if (!target) {
      setResult(null);
      return;
    }

    const timer = setTimeout(() => {
      setResult(translationValidator.validate(source, target, context));
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [source, target, context, debounceMs]);

  const autoFix = useCallback(() => {
    return translationValidator.autoFix(source, target);
  }, [source, target]);

  return {
    result,
    isValid: result?.isValid ?? true,
    score: result?.score ?? 100,
    issues: result?.issues ?? [],
    autoFix,
  };
}

export default translationValidator;
