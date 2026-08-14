"use client";

/**
 * Section 4: the reader runs the same comparison on the borough they care about.
 *
 * All five boroughs are summarised on the server and arrive with the page, so
 * changing the selection costs no request and cannot fail. The select is a
 * controlled element that is never unmounted - the previous build replaced its
 * container's innerHTML on every change, which destroyed keyboard focus and made
 * arrow-key selection impossible.
 *
 * Only a small status node is a live region. The charts are not: re-announcing
 * every axis label and table cell on each change is worse than announcing
 * nothing.
 */

import { useState } from "react";

import { ChartFigure } from "@/components/charts/ChartFrame";
import { DayTypeColumns } from "@/components/charts/DayTypeColumns";
import { HourlyLines } from "@/components/charts/HourlyLines";
import { formatNumber, formatSignedPercentage, hourLabel } from "@/lib/format";
import { BOROUGHS, type Borough } from "@/lib/config";
import type { Comparison, HourRow, HourlyGap } from "@/lib/analysis";

export type ExploreBorough = {
  borough: Borough;
  label: string;
  rangeDisplay: string;
  comparison: Comparison;
  weekdayDays: number;
  weekendDays: number;
  weekdayTotal: number;
  weekendTotal: number;
  totalComplaints: number;
  hours: HourRow[] | null;
  peak: HourlyGap;
};

export function ExploreBoroughs({ boroughs }: { boroughs: ExploreBorough[] }) {
  const [selected, setSelected] = useState<Borough>(boroughs[0]?.borough ?? "BROOKLYN");
  const active = boroughs.find((entry) => entry.borough === selected) ?? boroughs[0];

  if (!active) {
    return null;
  }

  return (
    <div className="explore">
      <div className="explore-control">
        <label htmlFor="borough-select">Borough</label>
        <select
          id="borough-select"
          value={selected}
          onChange={(event) => setSelected(event.target.value as Borough)}
        >
          {BOROUGHS.map((borough) => (
            <option key={borough.value} value={borough.value}>
              {borough.label}
            </option>
          ))}
        </select>
      </div>

      <p className="explore-status" role="status">
        Showing {active.label}, {active.rangeDisplay}.
      </p>

      {active.comparison.kind === "computed" ? (
        <p className="lede">
          {active.label} averaged {formatNumber(active.comparison.weekendAverage, 1)} residential
          noise complaints on a weekend day against{" "}
          {formatNumber(active.comparison.weekdayAverage, 1)} on a weekday —{" "}
          {formatSignedPercentage(active.comparison.percentageDifference)}, from{" "}
          {formatNumber(active.totalComplaints)} complaints.
        </p>
      ) : active.comparison.kind === "zero-baseline" ? (
        <p className="lede">
          {active.label} recorded no weekday complaints in this period, so no percentage difference
          can be formed.
        </p>
      ) : (
        <p className="lede">No complaints were returned for {active.label} in this period.</p>
      )}

      <div className="explore-charts">
        <ChartFigure caption={`${active.label}: average complaints per day`} table={null}>
          <DayTypeColumns
            comparison={active.comparison}
            weekdayDays={active.weekdayDays}
            weekendDays={active.weekendDays}
            label={`${active.label}, ${active.rangeDisplay}`}
            compact
          />
        </ChartFigure>

        {active.hours && (
          <ChartFigure
            caption={`${active.label}: average complaints per day by hour`}
            table={null}
            note={
              active.peak.kind === "gap" ? (
                <>
                  Widest gap at {hourLabel(active.peak.hour)}, {formatNumber(active.peak.gap, 1)}{" "}
                  more complaints per weekend day.
                </>
              ) : (
                <>No hour shows a positive weekend-weekday gap.</>
              )
            }
          >
            <HourlyLines
              hours={active.hours}
              peak={active.peak}
              label={`${active.label} by hour, ${active.rangeDisplay}`}
            />
          </ChartFigure>
        )}
      </div>

      <p className="boundary">
        Compare each borough against its own weekday baseline, not against another borough&rsquo;s
        counts. Brooklyn holds several times the households of Staten Island, so the raw daily
        numbers are not comparable across boroughs — only the within-borough difference is. The
        household-normalized comparison exists only for Brooklyn.
      </p>
    </div>
  );
}
