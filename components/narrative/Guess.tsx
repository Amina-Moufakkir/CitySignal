"use client";

/**
 * The reader's prediction, asked before the citywide chart.
 *
 * The question is which borough's weekend reporting rises furthest above its own
 * weekday baseline - a ratio within each borough, not a comparison between them.
 * That distinction is the whole reason the question is safe to ask: "which
 * borough rises most" has an answer in this data, while "which borough is
 * loudest" does not, and the feedback says so rather than leaving the reader to
 * infer it.
 *
 * The answer is read off the computed rows every time. Nothing here knows which
 * borough wins, and a tie or a period with too little data is answered as a tie
 * or as too little data rather than by picking someone.
 *
 * State is tiny and local. With scripting disabled the radios do nothing, the
 * result line never appears, and every number in both sections is unchanged: the
 * guess is an enhancement, never a gate.
 */

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { boroughLabel, CITYWIDE_BOROUGH_ORDER, type Borough } from "@/lib/config";
import { formatSignedPercentage } from "@/lib/format";
import type { LargestRise } from "@/lib/citywide";

type GuessState = {
  guess: Borough | null;
  setGuess: (value: Borough) => void;
};

const GuessContext = createContext<GuessState>({ guess: null, setGuess: () => {} });

export function GuessProvider({ children }: { children: ReactNode }) {
  const [guess, setGuess] = useState<Borough | null>(null);
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
export function BoroughGuessInput() {
  const { guess, setGuess } = useGuess();

  return (
    <div className="guess">
      <fieldset className="guess-options">
        <legend className="visually-hidden">
          Which borough do you expect to show the largest weekend rise against its own weekday
          baseline?
        </legend>
        {CITYWIDE_BOROUGH_ORDER.map((borough) => (
          <div className="guess-option" key={borough}>
            <input
              type="radio"
              id={`guess-${borough.replace(/\s+/g, "-").toLowerCase()}`}
              name="borough-guess"
              value={borough}
              checked={guess === borough}
              onChange={() => setGuess(borough)}
            />
            <label htmlFor={`guess-${borough.replace(/\s+/g, "-").toLowerCase()}`}>
              {boroughLabel(borough)}
            </label>
          </div>
        ))}
      </fieldset>
      <p className="guess-status" role="status">
        {guess === null
          ? "Pick one. Nothing below changes either way — the answer is already on the page."
          : `You picked ${boroughLabel(guess)}. Hold that.`}
      </p>
    </div>
  );
}

/**
 * Shown under the citywide chart once a guess exists. Absent, not wrong, when it
 * does not.
 */
export function BoroughGuessResult({ rise }: { rise: LargestRise }) {
  const { guess } = useGuess();

  if (guess === null) {
    return null;
  }

  if (rise.kind === "none") {
    return (
      <p className="guess-result">
        You picked {boroughLabel(guess)}. In this period no borough recorded more reporting on
        weekend days than on its own weekdays, so there is no largest rise to have guessed.
      </p>
    );
  }

  if (rise.kind === "tie") {
    const labels = rise.boroughs.map((row) => row.label);
    const correct = rise.boroughs.some((row) => row.borough === guess);

    return (
      <p className="guess-result">
        You picked {boroughLabel(guess)}.{" "}
        {labels.slice(0, -1).join(", ")} and {labels[labels.length - 1]} are level at the top of this
        period, both at {formatSignedPercentage(rise.percentageDifference)} against their own
        weekday baselines — {correct ? "yours among them" : "so neither pick was the single answer"}.
        This is the largest rise relative to a borough&rsquo;s own weekdays, not a ranking of how
        loud anywhere is and not a comparison of how many complaints each borough files.
      </p>
    );
  }

  const correct = rise.borough === guess;

  return (
    <p className="guess-result">
      You picked {boroughLabel(guess)}. {rise.label} shows the largest rise in this period, at{" "}
      {formatSignedPercentage(rise.percentageDifference)} above its own weekday baseline
      {correct ? " — your pick" : ""}. That is a comparison of each borough with itself: it is not a
      ranking of how loud anywhere is, and it is not a comparison of how many complaints each
      borough files.
    </p>
  );
}
