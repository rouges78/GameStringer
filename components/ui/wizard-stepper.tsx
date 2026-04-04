"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle2, ArrowRight } from "lucide-react"

// ═══════════════════════════════════════════════════════════════════
// WizardStepper — reusable step indicator for wizard flows
// ═══════════════════════════════════════════════════════════════════

export interface WizardStep {
  /** Unique step number (1-based) */
  num: number
  /** Short label displayed next to the number */
  label: string
  /** Optional icon override (defaults to the step number) */
  icon?: React.ReactNode
}

export interface WizardStepperProps {
  /** Array of step definitions */
  steps: WizardStep[]
  /** Currently active step number */
  currentStep: number
  /** Callback when user clicks a completed (past) step to navigate back */
  onStepClick?: (stepNum: number) => void
  /** Visual size variant */
  size?: "sm" | "md"
  /** Optional additional className for the container */
  className?: string
}

export function WizardStepper({
  steps,
  currentStep,
  onStepClick,
  size = "sm",
  className,
}: WizardStepperProps) {
  const isSm = size === "sm"

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-1 py-2",
        className
      )}
      role="navigation"
      aria-label="Wizard steps"
    >
      {steps.map((step, idx) => {
        const isPast = step.num < currentStep
        const isCurrent = step.num === currentStep
        const isFuture = step.num > currentStep
        const isClickable = isPast && !!onStepClick

        return (
          <div key={step.num} className="flex items-center">
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 rounded-full transition-all",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
                isSm ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
                isPast && "bg-cyan-600 text-white",
                isPast && isClickable && "cursor-pointer hover:bg-cyan-500",
                isCurrent && "bg-cyan-600 text-white",
                isFuture && "bg-slate-800/50 text-slate-500 border border-slate-700/50 cursor-default",
              )}
              onClick={() => isClickable && onStepClick(step.num)}
              tabIndex={isClickable ? 0 : -1}
              aria-current={isCurrent ? "step" : undefined}
              aria-label={`Step ${step.num}: ${step.label}${isPast ? " (completato)" : isCurrent ? " (corrente)" : ""}`}
              disabled={isFuture}
            >
              {isPast ? (
                <CheckCircle2 className={cn(isSm ? "h-3 w-3" : "h-3.5 w-3.5")} />
              ) : step.icon ? (
                step.icon
              ) : (
                <span className="font-bold">{step.num}</span>
              )}
              <span>{step.label}</span>
            </button>

            {idx < steps.length - 1 && (
              <ArrowRight
                className={cn(
                  "mx-1 text-slate-600",
                  isSm ? "h-3 w-3" : "h-3.5 w-3.5"
                )}
                aria-hidden="true"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
