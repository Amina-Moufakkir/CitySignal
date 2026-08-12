/**
 * Static, committed datasets.
 *
 * Everything in this file was produced by a Phase 3 analysis that is not itself
 * committed to this repository. The values are recorded here verbatim from the
 * original static build (`legacy/app.js`) so they remain auditable, and each
 * carries the provenance needed to say plainly where it came from.
 */

export type BoardRow = {
  board: string;
  occupiedHouseholds: number;
  saturdayNightComplaints: number;
};

export type DatasetProvenance = {
  /** What the complaint counts actually count. */
  descriptor: string;
  /** Where the denominator came from. */
  denominatorSource: string;
  /** The complaint period the counts cover. */
  complaintPeriod: string;
  /** When the extract was taken. Null when it was never recorded. */
  extractedOn: string | null;
  /** The known boundary caveat, surfaced in the UI rather than buried. */
  limitation: string;
};

export type BoardDataset = {
  metadata: DatasetProvenance;
  rows: readonly BoardRow[];
};

export const PHASE3_BOARD_DATASET: BoardDataset = {
  metadata: {
    descriptor: "Loud Music/Party complaints, Saturday nights only",
    denominatorSource: "2024 ACS 5-year estimates aggregated to DCP CDTAs",
    complaintPeriod: "2024-01-01 through 2024-12-29",
    extractedOn: null,
    limitation:
      "CDTAs approximate, but are not identical to, legal community-district boundaries, so the complaint numerator and the household denominator are drawn on slightly different geographies.",
  },
  rows: [
    { board: "BK01", occupiedHouseholds: 85708, saturdayNightComplaints: 1256 },
    { board: "BK02", occupiedHouseholds: 61250, saturdayNightComplaints: 355 },
    { board: "BK03", occupiedHouseholds: 71580, saturdayNightComplaints: 1042 },
    { board: "BK04", occupiedHouseholds: 45491, saturdayNightComplaints: 1394 },
    { board: "BK05", occupiedHouseholds: 71948, saturdayNightComplaints: 1128 },
    { board: "BK06", occupiedHouseholds: 52116, saturdayNightComplaints: 240 },
    { board: "BK07", occupiedHouseholds: 41131, saturdayNightComplaints: 313 },
    { board: "BK08", occupiedHouseholds: 48537, saturdayNightComplaints: 407 },
    { board: "BK09", occupiedHouseholds: 40499, saturdayNightComplaints: 398 },
    { board: "BK10", occupiedHouseholds: 49275, saturdayNightComplaints: 239 },
    { board: "BK11", occupiedHouseholds: 62339, saturdayNightComplaints: 278 },
    { board: "BK12", occupiedHouseholds: 55111, saturdayNightComplaints: 279 },
    { board: "BK13", occupiedHouseholds: 46711, saturdayNightComplaints: 262 },
    { board: "BK14", occupiedHouseholds: 59557, saturdayNightComplaints: 400 },
    { board: "BK15", occupiedHouseholds: 58709, saturdayNightComplaints: 261 },
    { board: "BK16", occupiedHouseholds: 37597, saturdayNightComplaints: 448 },
    { board: "BK17", occupiedHouseholds: 58588, saturdayNightComplaints: 672 },
    { board: "BK18", occupiedHouseholds: 63771, saturdayNightComplaints: 572 },
  ],
};
