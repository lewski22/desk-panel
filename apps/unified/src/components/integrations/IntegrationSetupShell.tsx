import React from 'react';
import { useTranslation } from 'react-i18next';

interface Step {
  label:    string;
  sublabel: string;
}

interface Props {
  logo:          React.ReactNode;
  logoColor:     string;
  title:         string;
  subtitle:      string;
  steps:         Step[];
  currentStep:   number;
  children:      React.ReactNode;
  onBack?:       () => void;
  onNext?:       () => void;
  onCancel:      () => void;
  nextLabel?:    string;
  nextLoading?:  boolean;
  nextDisabled?: boolean;
  isLastStep?:   boolean;
}

export function IntegrationSetupShell({
  logo, logoColor, title, subtitle,
  steps, currentStep,
  children,
  onBack, onNext, onCancel,
  nextLoading, nextDisabled, isLastStep,
}: Props) {
  const { t } = useTranslation();
  const total = steps.length;

  return (
    <div className="border border-zinc-200 rounded-2xl overflow-hidden bg-white">

      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-zinc-100 bg-zinc-50">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: logoColor }}
        >
          {logo}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-zinc-800">{title}</p>
          <p className="text-xs text-zinc-400">{subtitle}</p>
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-start px-5 py-3 border-b border-zinc-100 bg-zinc-50 gap-0">
        {steps.map((step, i) => {
          const done   = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              {i < total - 1 && (
                <div
                  className="absolute top-[13px] h-px"
                  style={{
                    left: '50%', right: '-50%',
                    background: done ? '#10B981' : '#EDE8FA',
                    zIndex: 0,
                  }}
                />
              )}
              <div
                className="w-[26px] h-[26px] rounded-full flex items-center justify-center text-[11px] font-semibold relative z-10 shrink-0"
                style={
                  done
                    ? { background: '#d1fae5', color: '#065f46', border: '0.5px solid #10B981' }
                    : active
                    ? { background: '#B53578', color: '#fff' }
                    : { background: '#fff', color: '#9ca3af', border: '0.5px solid #DCD6EA' }
                }
              >
                {done ? '✓' : i + 1}
              </div>
              <p
                className="text-[10px] mt-1.5 text-center leading-tight"
                style={{ color: active ? '#B53578' : '#9ca3af', fontWeight: active ? 500 : 400 }}
              >
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="px-5 py-5">
        {children}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-100 bg-zinc-50">
        <div className="flex gap-1.5 items-center">
          {steps.map((_, i) => (
            <span
              key={i}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: i === currentStep ? 16 : 6,
                background: i === currentStep ? '#B53578' : '#DCD6EA',
              }}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="text-xs text-zinc-400 hover:text-zinc-600 px-1 py-1"
          >
            {t('btn.cancel')}
          </button>
          {onBack && currentStep > 0 && (
            <button
              onClick={onBack}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"
            >
              ← Wstecz
            </button>
          )}
          {onNext && (
            <button
              onClick={onNext}
              disabled={nextDisabled || nextLoading}
              className="text-xs px-4 py-1.5 rounded-lg bg-brand text-white font-semibold hover:bg-brand-hover disabled:opacity-40 transition-colors"
            >
              {nextLoading ? 'Zapisuję…' : isLastStep ? 'Zapisz i zakończ' : 'Dalej →'}
            </button>
          )}
        </div>
      </div>

      <div className="px-5 pb-2">
        <p className="text-[10px] text-zinc-300">
          {t('integrations.step_of', { current: currentStep + 1, total })}
        </p>
      </div>
    </div>
  );
}
