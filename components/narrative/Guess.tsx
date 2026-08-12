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

/**
 * The options bracket the answer rather than sitting entirely below it. With the
 * old set of 10/30/60/100 against roughly +78%, no option was close and every
 * answer got the same dismissal, which made the question unwinnable.
 */
export const GUESS_OPTIONS = [10, 30, 60, 80, 100] as const;

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

/**
 * Native radios rather than `role="radio"` buttons: the group is then one tab
 * stop and arrow keys move within it, which hand-rolled buttons only get with a
 * roving tabindex.
 */
export function GuessInput({ weekdayAverage }: { weekdayAverage: number | null }) {
  const { guess, setGuess } = useGuess();

  // The guess is turned back into the thing being guessed about. A percentage is
  // abstract; a number of complaints on a Saturday is not.
  const implied =
    guess === null || weekdayAverage === null ? null : weekdayAverage * (1 + guess / 100);

  return (
    <div className="guess">
      <fieldset className="guess-options">
        <legend className="visually-hidden">
          How much more do New Yorkers complain on weekends?
        </legend>
        {GUESS_OPTIONS.map((option) => (
          <div className="guess-option" key={option}>
            <input
              type="radio"
              id={`guess-${option}`}
              name="guess"
              value={option}
              checked={guess === option}
              onChange={() => setGuess(option)}
            />
            <label htmlFor={`guess-${option}`}>{formatSignedPercentage(option, 0)}</label>
          </div>
        ))}
      </fieldset>
      <p className="guess-status" role="status">
        {guess === null ? (
          "Pick one. Nothing below changes either way — the answer is already on the page."
        ) : implied === null ? (
          `You guessed ${formatSignedPercentage(guess, 0)}. Hold that number.`
        ) : (
          <>
            {formatSignedPercentage(guess, 0)} would put a weekend day at about{" "}
            <strong>{formatNumber(implied)}</strong> complaints, against{" "}
            {formatNumber(weekdayAverage ?? 0)} on a weekday. Hold that number.
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Shown in the reveal once a guess exists. Absent, not zero, when it does not.
 *
 * Which option counts as closest is computed against the live figure rather than
 * hardcoded, so it stays right if the data moves.
 */
export function GuessComparison({ actual }: { actual: number }) {
  const { guess } = useGuess();

  if (guess === null) {
    return null;
  }

  const closest = GUESS_OPTIONS.reduce((best, option) =>
    Math.abs(option - actual) < Math.abs(best - actual) ? option : best,
  );
  const gap = actual - guess;
  const magnitude = Math.abs(gap);

  return (
    <p className="guess-result">
      You guessed {formatSignedPercentage(guess, 0)}; the answer is{" "}
      {formatSignedPercentage(actual)}.{" "}
      {guess === closest
        ? `That is the closest of the ${GUESS_OPTIONS.length} — ${formatNumber(magnitude, 1)} percentage points ${gap >= 0 ? "under" : "over"}.`
        : `${formatNumber(magnitude, 1)} percentage points ${gap >= 0 ? "under" : "over"}; ${formatSignedPercentage(closest, 0)} was the closest option.`}
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
