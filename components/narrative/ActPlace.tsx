/**
 * Sections 10-12: where, whether it holds, and the explanations that failed.
 *
 * Section 12 is the centrepiece. Each hypothesis states what was predicted before
 * the data was examined and what came back. Sourcing is a citation line, not a
 * warning: some figures are recomputed here from committed data, some are
 * recorded from Phase 2-3 analyses that live outside this repository.
 */

import { BoardBars } from "@/components/charts/BoardBars";
import { boardDisplayName, BOARD_LABEL_SOURCE } from "@/lib/board-labels";
import { ChartFigure } from "@/components/charts/ChartFrame";
import { DayTypeColumns } from "@/components/charts/DayTypeColumns";
import { IntervalPlot } from "@/components/charts/IntervalPlot";
import { Boundary, KeyFigure, Section, SourceLine, Unavailable } from "./Section";
import { formatNumber, formatPercentage, formatSignedPercentage } from "@/lib/format";
import { describeFailure } from "@/lib/socrata";
import { comparedToThreshold } from "@/lib/uncertainty";
import type { BoardRate } from "@/lib/analysis";
import type { DescriptorBundle, PageData, RangeBundle } from "@/lib/data";
import { FAILED_HYPOTHESES, PHASE3_BOARD_DATASET, SOURCE_LABELS } from "@/lib/static-data";

export function WhereSection({
  boards,
  boardShare,
  descriptors,
  descriptor,
}: {
  boards: BoardRate[];
  boardShare: PageData["boardShare"];
  descriptors: DescriptorBundle;
  descriptor: string;
}) {
  const metadata = PHASE3_BOARD_DATASET.metadata;
  const top = boards[0];
  const bottom = boards[boards.length - 1];

  /**
   * The same quantity appears twice in this piece: the live descriptor query
   * counts it borough-wide, and this extract counts it per board. They do not
   * match exactly, so the difference is stated rather than left for a reader to
   * find by multiplying.
   */
  const { excess, summary } = descriptors;
  const liveTotal =
    excess.kind === "computed" && summary.status === "ok"
      ? (summary.value.weekdays.find((row) => row.weekday === excess.peakWeekday)?.byDescriptor[
          descriptor
        ] ?? null)
      : null;
  const shortfall = liveTotal === null ? null : liveTotal - boardShare.total;

  return (
    <Section id="where" title="So where?" wide>
      <p>
        A late-night, Saturday, loud-music pattern sounds like it should have an address. The
        honest version of that question is narrower: are some parts of Brooklyn reporting this more
        than others, once you account for how many households each one holds?
      </p>
      <p>
        Raw counts cannot answer it — a board with twice the households will file more of
        everything. Dividing by occupied households puts eighteen boards on one scale.
      </p>

      <KeyFigure value={formatNumber(top.complaintsPer1000Households, 1)}>
        Saturday-night complaints per 1,000 occupied households in{" "}
        {boardDisplayName(top.board)}, against{" "}
        {formatNumber(bottom.complaintsPer1000Households, 1)} in {boardDisplayName(bottom.board)}
      </KeyFigure>

      <ChartFigure
        caption="Saturday-night complaints per 1,000 occupied households, by community board"
        table={null}
        note={
          <>
            {boardDisplayName(top.board)} reports{" "}
            {formatNumber(top.complaintsPer1000Households, 1)} per 1,000 occupied households —
            about{" "}
            {formatNumber(top.complaintsPer1000Households / bottom.complaintsPer1000Households, 1)}{" "}
            times {boardDisplayName(bottom.board)}, the lowest. The three highest-count boards (
            {boardShare.boards.map((board) => boardDisplayName(board)).join("; ")}) hold{" "}
            {formatPercentage(boardShare.share)} of {formatNumber(boardShare.total)} complaints
            between them.
          </>
        }
      >
        <BoardBars boards={boards} highlight={top.board} />
      </ChartFigure>

      <SourceLine>
        <span className="note-block">
          <b className="note-head">Provenance.</b> Everything above this section is queried live. This chart is not: it is a fixed extract
          covering {metadata.complaintPeriod}, counting {metadata.descriptor}.
          {metadata.extractedOn
            ? ` Extracted ${metadata.extractedOn}.`
            : " The extraction date was not recorded."}{" "}
          Denominator: {metadata.denominatorSource}. Community-board normalization exists only for
          Brooklyn. District names are {BOARD_LABEL_SOURCE.publisher} Community District Tabulation
          Area names, from {BOARD_LABEL_SOURCE.dataset} (<code>{BOARD_LABEL_SOURCE.datasetId}</code>);
          a CDTA is DCP&rsquo;s approximation of a community district, not a neighbourhood boundary,
          and several cover more than one named neighbourhood.
        </span>
        {shortfall !== null && liveTotal !== null && (
          <span className="note-block">
            <b className="note-head">A discrepancy worth naming.</b> The live query counts{" "}
            {formatNumber(liveTotal)} of these complaints across the borough; this extract totals{" "}
            {formatNumber(boardShare.total)}, {formatNumber(Math.abs(shortfall))} fewer —{" "}
            {formatPercentage((Math.abs(shortfall) / liveTotal) * 100)} of the total. A board-level
            extract can only count complaints that carry a usable community board, so records
            missing one would drop out at exactly this step. That is the likely explanation rather
            than a verified one: the extract&rsquo;s own join is not committed to this repository,
            so it cannot be checked from here.
          </span>
        )}
      </SourceLine>

      <Boundary>
        {metadata.limitation} A board reporting more is a board reporting more. It is not a
        statement about what those neighbourhoods are like, and nothing here identifies a resident
        or a building.
      </Boundary>
    </Section>
  );
}

export function PersistenceSection({
  primary,
  stress,
}: {
  primary: RangeBundle;
  stress: RangeBundle;
}) {
  if (primary.daily.status === "failed" || stress.daily.status === "failed") {
    const failure =
      primary.daily.status === "failed" ? primary.daily.failure : stress.daily.status === "failed" ? stress.daily.failure : null;

    return (
      <Section id="persistence" title="A different year, same shape">
        <Unavailable>{failure ? describeFailure(failure) : "Not available."}</Unavailable>
      </Section>
    );
  }

  const a = primary.daily.value;
  const b = stress.daily.value;

  if (a.comparison.kind !== "computed" || b.comparison.kind !== "computed") {
    return (
      <Section id="persistence" title="A different year, same shape">
        <p>One of the two periods has no comparable data, so no persistence check is shown.</p>
      </Section>
    );
  }

  return (
    <Section id="persistence" title="A different year, same shape" wide>
      <p>
        A pattern found once in one year is a pattern found once. The same query over a second
        period that shares no days with the first is the cheapest test of whether it was a feature
        of that year.
      </p>

      <div className="small-multiples">
        {[
          { bundle: primary, summary: a },
          { bundle: stress, summary: b },
        ].map(({ bundle, summary }) => (
          <ChartFigure
            key={bundle.range.id}
            caption={summary.range.display}
            table={null}
            note={
              bundle.dailyInterval.kind === "interval" ? (
                <>
                  {formatSignedPercentage(
                    summary.comparison.kind === "computed" ? summary.comparison.percentageDifference : 0,
                  )}
                  , 95% interval {formatSignedPercentage(bundle.dailyInterval.lower)} to{" "}
                  {formatSignedPercentage(bundle.dailyInterval.upper)}
                </>
              ) : null
            }
          >
            <DayTypeColumns
              comparison={summary.comparison}
              weekdayDays={summary.weekdayDays}
              weekendDays={summary.weekendDays}
              label={`Brooklyn, ${summary.range.display}`}
              compact
            />
          </ChartFigure>
        ))}
      </div>

      <p className="lede">
        {formatSignedPercentage(a.comparison.percentageDifference)} in the first period,{" "}
        {formatSignedPercentage(b.comparison.percentageDifference)} in the second. Two
        non-overlapping years, {formatNumber(a.totalComplaints + b.totalComplaints)} complaints
        between them, and intervals that overlap almost entirely.
      </p>

      <Boundary>
        Recurring is not the same as continuing. This says the pattern was there both times it was
        looked for; it does not forecast the next period, and it still describes reporting rather
        than noise.
      </Boundary>
    </Section>
  );
}

export function FailedExplanationsSection({ pageData }: { pageData: PageData }) {
  const { boardShare, boardShareInterval } = pageData;
  const threshold = 40;
  const verdict = comparedToThreshold(boardShareInterval, threshold);

  return (
    <Section id="failed" title="Then the explanations ran out." wide>
      <p className="lede">
        The pattern is specific enough by now that it ought to have a cause. Four candidates were
        written down as predictions before the data was examined, most with a number attached, so
        they could come back wrong. All four did.
      </p>

      <ol className="ledger">
        {FAILED_HYPOTHESES.map((hypothesis, index) => {
          const headline =
            hypothesis.id === "concentration" && boardShareInterval.kind === "interval"
              ? {
                  value: formatPercentage(boardShare.share),
                  caption: `where at least ${formatPercentage(threshold, 0)} was predicted`,
                }
              : hypothesis.headline;

          return (
            <li key={hypothesis.id} className="ledger-row">
              <p className="ledger-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </p>

              <div className="ledger-cell">
                <p className="ledger-label">Predicted</p>
                <p className="ledger-text">{hypothesis.prediction}</p>
                <p className="ledger-aside">{hypothesis.rationale}</p>
              </div>

              <div className="ledger-cell ledger-cell-outcome">
                <p className="ledger-label">What came back</p>
                {headline && (
                  <p className="ledger-headline">
                    <span className="ledger-headline-value">{headline.value}</span>
                    <span className="ledger-headline-caption">{headline.caption}</span>
                  </p>
                )}
                <p className="ledger-text">{hypothesis.outcome}</p>
                <p className="ledger-source">{SOURCE_LABELS[hypothesis.source]}</p>
              </div>

              {hypothesis.id === "concentration" && (
                <div className="ledger-evidence">
                  <ChartFigure
                    caption="Top three boards' share, against the threshold predicted in advance"
                    table={null}
                    note={
                      boardShareInterval.kind === "interval" ? (
                        <>
                          <span className="note-block">
                            <b className="note-head">The interval.</b>{" "}
                            {formatPercentage(boardShare.share)} observed,{" "}
                            {formatPercentage(boardShareInterval.lower)} to{" "}
                            {formatPercentage(boardShareInterval.upper)} at 95%
                            {verdict === "entirely-below"
                              ? " — entirely below the threshold."
                              : verdict === "straddles"
                                ? " — straddling it, so the test does not resolve."
                                : "."}
                          </span>
                          <span className="note-block">
                            <b className="note-head">Why it is too narrow.</b> It treats every
                            complaint as independent, and they are not: reports cluster within a
                            night and within an address. The night-level counts needed to compute
                            the wider, correct interval are not in this repository.
                          </span>
                        </>
                      ) : null
                    }
                  >
                    <IntervalPlot
                      interval={boardShareInterval}
                      threshold={threshold}
                      thresholdLabel={`predicted at least ${formatPercentage(threshold, 0)}`}
                      label="Share of Saturday-night complaints held by the three highest-count boards"
                    />
                  </ChartFigure>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <p>
        Four plausible mechanisms, none supported. What survives is a pattern that is consistent,
        specific in time, spread across hundreds of addresses, and unexplained by the things that
        would most obviously explain it.
      </p>

      <Boundary>
        Unexplained is not unexplainable, and it is certainly not evidence for any particular
        alternative. It means the four things tested were not it.
      </Boundary>
    </Section>
  );
}
