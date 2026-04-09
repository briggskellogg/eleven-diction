import { Check } from 'lucide-react'
import type { AppStep } from '../lib/types'

const STEPS: { key: AppStep; label: string; num: number }[] = [
  { key: 'setup', label: 'Setup', num: 1 },
  { key: 'curate', label: 'Curate', num: 2 },
  { key: 'review', label: 'Review', num: 3 },
]

const STEP_ORDER: AppStep[] = ['setup', 'curate', 'review']

interface StepperProps {
  currentStep: AppStep
}

export default function Stepper({ currentStep }: StepperProps) {
  const currentIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div className="flex items-center gap-1.5">
      {STEPS.map((step, i) => {
        const isCompleted = i < currentIndex
        const isCurrent = i === currentIndex

        return (
          <div key={step.key} className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5">
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-medium transition-all ${
                  isCompleted
                    ? 'bg-el-accent text-white'
                    : isCurrent
                      ? 'bg-el-graphite text-white'
                      : 'bg-el-border-light text-el-text-muted'
                }`}
              >
                {isCompleted ? <Check className="h-3 w-3" strokeWidth={3} /> : step.num}
              </div>
              <span
                className={`text-xs ${
                  isCurrent
                    ? 'text-el-text font-medium'
                    : isCompleted
                      ? 'text-el-accent font-medium'
                      : 'text-el-text-muted'
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`h-px w-6 lg:w-8 ${
                  i < currentIndex ? 'bg-el-accent' : 'bg-el-border'
                }`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
