/**
 * Human-readable names for Brooklyn's community districts.
 *
 * Source: NYC Department of City Planning, "2020 Community District Tabulation
 * Areas (CDTAs) - Tabular", NYC Open Data dataset `xn3r-zk6y`, field `cdtaname`,
 * filtered to `borocode = '3'` and `cdtatype = '0'`. Retrieved 12 August 2026.
 * Every name below was taken from that response rather than written by hand.
 *
 * `cdtatype = '0'` is the filter that matters. The same dataset also returns two
 * Brooklyn rows of type `'1'` - BK55 Prospect Park and BK56 Jamaica Bay (West) -
 * which are Joint Interest Areas, not community districts. They have no community
 * board and no place in this analysis, and including them would have invented two
 * districts that do not exist.
 *
 * What these names are, and are not:
 *
 * A CDTA is DCP's approximation of a community district, built by aggregating
 * whole census tracts so that ACS estimates can be reported against it. DCP marks
 * each one `Equivalent` where the tracts line up with the legal district and
 * `Approximation` where they do not; that status is kept on every record here and
 * printed in the table twin and METHOD.md rather than dropped for tidiness. It is
 * the CDTA-versus-legal-boundary caveat, stated by the source itself.
 *
 * These are district display names, not neighbourhood boundaries. Several cover
 * more than one named neighbourhood - BK02 is Downtown Brooklyn *and* Fort Greene
 * - and where the official name carries two areas, both are kept. A community
 * district is not a neighbourhood, and one board does not equal one universally
 * agreed name for the place it covers.
 */

export type BoardCdtaStatus = "equivalent" | "approximation";

export type BoardLabel = {
  /** The code used throughout the analysis, e.g. `BK04`. */
  board: string;
  /** The district name with the code and the status suffix removed. */
  name: string;
  /** DCP's judgement on how closely the CDTA matches the legal district. */
  status: BoardCdtaStatus;
  /** DCP's complete `cdtaname`, kept verbatim. */
  officialName: string;
};

export const BOARD_LABEL_SOURCE = {
  publisher: "NYC Department of City Planning",
  dataset: "2020 Community District Tabulation Areas (CDTAs) - Tabular",
  datasetId: "xn3r-zk6y",
  field: "cdtaname",
  filter: "borocode = '3' AND cdtatype = '0'",
  retrieved: "2026-08-12",
  url: "https://data.cityofnewyork.us/City-Government/2020-Community-District-Tabulation-Areas-CDTAs-Tab/xn3r-zk6y",
} as const;

export const BROOKLYN_BOARD_LABELS: readonly BoardLabel[] = [
  { board: "BK01", name: "Williamsburg-Greenpoint", status: "equivalent", officialName: "BK01 Williamsburg-Greenpoint (CD 1 Equivalent)" },
  { board: "BK02", name: "Downtown Brooklyn-Fort Greene", status: "approximation", officialName: "BK02 Downtown Brooklyn-Fort Greene (CD 2 Approximation)" },
  { board: "BK03", name: "Bedford-Stuyvesant", status: "approximation", officialName: "BK03 Bedford-Stuyvesant (CD 3 Approximation)" },
  { board: "BK04", name: "Bushwick", status: "equivalent", officialName: "BK04 Bushwick (CD 4 Equivalent)" },
  { board: "BK05", name: "East New York-Cypress Hills", status: "approximation", officialName: "BK05 East New York-Cypress Hills (CD 5 Approximation)" },
  { board: "BK06", name: "Park Slope-Carroll Gardens", status: "approximation", officialName: "BK06 Park Slope-Carroll Gardens (CD 6 Approximation)" },
  { board: "BK07", name: "Sunset Park-Windsor Terrace", status: "approximation", officialName: "BK07 Sunset Park-Windsor Terrace (CD 7 Approximation)" },
  { board: "BK08", name: "Crown Heights (North)", status: "approximation", officialName: "BK08 Crown Heights (North) (CD 8 Approximation)" },
  { board: "BK09", name: "Crown Heights (South)", status: "approximation", officialName: "BK09 Crown Heights (South) (CD 9 Approximation)" },
  { board: "BK10", name: "Bay Ridge-Dyker Heights", status: "approximation", officialName: "BK10 Bay Ridge-Dyker Heights (CD 10 Approximation)" },
  { board: "BK11", name: "Bensonhurst-Bath Beach", status: "approximation", officialName: "BK11 Bensonhurst-Bath Beach (CD 11 Approximation)" },
  { board: "BK12", name: "Borough Park-Kensington", status: "approximation", officialName: "BK12 Borough Park-Kensington (CD 12 Approximation)" },
  { board: "BK13", name: "Coney Island-Brighton Beach", status: "approximation", officialName: "BK13 Coney Island-Brighton Beach (CD 13 Approximation)" },
  { board: "BK14", name: "Flatbush-Midwood", status: "approximation", officialName: "BK14 Flatbush-Midwood (CD 14 Approximation)" },
  { board: "BK15", name: "Sheepshead Bay-Gravesend (East)", status: "approximation", officialName: "BK15 Sheepshead Bay-Gravesend (East) (CD 15 Approximation)" },
  { board: "BK16", name: "Ocean Hill-Brownsville", status: "approximation", officialName: "BK16 Ocean Hill-Brownsville (CD 16 Approximation)" },
  { board: "BK17", name: "East Flatbush", status: "approximation", officialName: "BK17 East Flatbush (CD 17 Approximation)" },
  { board: "BK18", name: "Canarsie-Flatlands", status: "approximation", officialName: "BK18 Canarsie-Flatlands (CD 18 Approximation)" },
];

const BY_CODE = new Map(BROOKLYN_BOARD_LABELS.map((label) => [label.board, label]));

export function boardLabel(board: string): BoardLabel | null {
  return BY_CODE.get(board) ?? null;
}

/**
 * The concise form: `BK04 · Bushwick`. Falls back to the bare code rather than
 * inventing a name, so an unmapped board is visibly unmapped.
 */
export function boardDisplayName(board: string): string {
  const label = BY_CODE.get(board);

  return label ? `${label.board} · ${label.name}` : board;
}

/** Code, name and DCP's equivalence status, for the table twin and provenance. */
export function boardFullName(board: string): string {
  const label = BY_CODE.get(board);

  return label ? label.officialName : board;
}
