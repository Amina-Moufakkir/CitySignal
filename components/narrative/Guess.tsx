"use client";

/**
 * The reader's guess, asked before anything is revealed.
 *
 * State is deliberately tiny and local to these two sections. With scripting
 * disabled the buttons do nothing, the guess line never appears, and every
 * other word and number in both sections is unchanged - the guess is an
 * enhancement, never a gate.
 */

import { createContext, useContext, useMemo, useState, type ComponentProps, type ReactNode } from "react";

import { formatNumber, formatSignedPercentage } from "@/lib/format";
import { DayTypeColumns } from "@/components/charts/DayTypeColumns";

type DayTypeColumnsProps = ComponentProps<typeof DayTypeColumns>;

export const GUESS_OPTIONS = [10, 30, 60, 100] as const;

type GuessValue = (typeof GUESS_OPTIONS)[number];

type GuessState = {
  guess: GuessValue | null;
  setGuess: (value: GuessValue) => void;
};

const GuessContext = createContext<GuessState>({ guess: null, setGuess: () => {} });

export function GuessProvider({ children }: { children: ReactNode }) {
  const [guess, setGuess] = useState<GuessValue | null>(null);
  const value = useMemo(() => ({ guess, setGuess }), [guess]);

  return <GuessContext.Provider value={value}>{children}</GuessContext.Provider>;
}

export function useGuess(): GuessState {
  return useContext(GuessContext);
}

export function GuessInput() {
  const { guess, setGuess } = useGuess();

  return (
    <div className="guess">
      <div className="guess-options" role="radiogroup" aria-label="How much more do New Yorkers complain on weekends?">
        {GUESS_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={guess === option}
            className={guess === option ? "guess-option guess-option-active" : "guess-option"}
            onClick={() => setGuess(option)}
          >
            {formatSignedPercentage(option, 0)}
          </button>
        ))}
      </div>
      <p className="guess-status" role="status">
        {guess === null
          ? "Pick one. Nothing below changes either way — the answer is already on the page."
          : `You guessed ${formatSignedPercentage(guess, 0)}. Keep reading.`}
      </p>
    </div>
  );
}

/** Shown in the reveal once a guess exists. Absent, not zero, when it does not. */
export function GuessComparison({ actual }: { actual: number }) {
  const { guess } = useGuess();

  if (guess === null) {
    return null;
  }

  const gap = actual - guess;
  const closeness =
    Math.abs(gap) < 10 ? "close" : Math.abs(gap) < 30 ? "in the right region" : "some way off";

  return (
    <p className="guess-result">
      You guessed {formatSignedPercentage(guess, 0)}. The answer is{" "}
      {formatSignedPercentage(actual)} — {closeness}, {gap >= 0 ? "under" : "over"} by{" "}
      {formatNumber(Math.abs(gap), 1)} percentage points.
    </p>
  );
}

/**
 * The reveal chart, drawn with the reader's guess marked on the same axis when
 * one exists. Server-rendered without the guess line; the line appears after
 * hydration if the reader answered.
 */
export function GuessAwareColumns(props: Omit<DayTypeColumnsProps, "guessPercent">) {
  const { guess } = useGuess();

  return <DayTypeColumns {...props} guessPercent={guess} />;
}
