import { afterEach, describe, expect, test, vi } from "vitest";

import { describeFailure, fetchAggregate, type Failure } from "./socrata";

const FAST = { retryDelayMs: 0, timeoutMs: 50 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { "content-type": "text/html" } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAggregate", () => {
  test("returns rows on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse([{ day: "2024-01-01T00:00:00.000", complaints: "10" }])),
    );

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
  });

  // An empty result set is a successful fetch of zero rows, not a failure. This
  // is what keeps REVIEW.md B1 from being reachable: no-data is decided by the
  // analysis, not by the transport.
  test("treats an empty result set as success, not failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse([])));

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: true, rows: [] });
  });

  test("classifies 429 as rate-limited and retries once", async () => {
    const stub = vi.fn(async () => jsonResponse({ error: true }, 429));
    vi.stubGlobal("fetch", stub);

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "rate-limited" } });
    expect(stub).toHaveBeenCalledTimes(2);
  });

  test("recovers when a retry succeeds", async () => {
    const stub = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse([{ day: "2024-01-01T00:00:00.000", complaints: "4" }]));
    vi.stubGlobal("fetch", stub);

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result.ok).toBe(true);
    expect(stub).toHaveBeenCalledTimes(2);
  });

  test("classifies 5xx as a server failure carrying the status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 502)));

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "server", status: 502 } });
  });

  test("does not retry a 400, which means the query is wrong", async () => {
    const stub = vi.fn(async () => jsonResponse({ message: "bad query" }, 400));
    vi.stubGlobal("fetch", stub);

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "server", status: 400 } });
    expect(stub).toHaveBeenCalledTimes(1);
  });

  test("classifies a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "network" } });
  });

  test("classifies an aborted request as a timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const error = new Error("aborted");
            error.name = "AbortError";
            reject(error);
          });
        });
      }),
    );

    const result = await fetchAggregate("https://example.test", { retryDelayMs: 0, timeoutMs: 10 });

    expect(result).toEqual({ ok: false, failure: { kind: "timeout" } });
  });

  test("classifies unparseable JSON as bad shape and does not retry it", async () => {
    const stub = vi.fn(async () => textResponse("<html>upstream outage</html>"));
    vi.stubGlobal("fetch", stub);

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "bad-shape" } });
    expect(stub).toHaveBeenCalledTimes(1);
  });

  test("rejects a non-array payload", async () => {
    // Socrata answers some queries with an object rather than a row array.
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ message: "still processing" })));

    const result = await fetchAggregate("https://example.test", FAST);

    expect(result).toEqual({ ok: false, failure: { kind: "bad-shape" } });
  });

  test("requests a cached response rather than a fresh one per visitor", async () => {
    type CacheInit = RequestInit & { next?: { revalidate?: number } };
    const stub = vi.fn(async (_url: string, _init?: CacheInit) => jsonResponse([]));
    vi.stubGlobal("fetch", stub);

    await fetchAggregate("https://example.test", { ...FAST, revalidate: 900 });

    expect(stub.mock.calls[0]?.[1]?.next?.revalidate).toBe(900);
  });
});

describe("describeFailure", () => {
  const failures: Failure[] = [
    { kind: "rate-limited" },
    { kind: "server", status: 503 },
    { kind: "timeout" },
    { kind: "network" },
    { kind: "bad-shape" },
  ];

  test("gives every failure a reader-facing sentence", () => {
    for (const failure of failures) {
      const message = describeFailure(failure);

      expect(message.length).toBeGreaterThan(20);
      expect(message).toMatch(/\.$/);
    }
  });

  // The JSON parser's message embeds a fragment of the response body, and the
  // request URL contains the whole encoded SoQL query. Neither belongs on screen.
  test("never leaks a URL or upstream text", () => {
    for (const failure of failures) {
      const message = describeFailure(failure);

      expect(message).not.toMatch(/https?:\/\//);
      expect(message).not.toMatch(/\$select|\$where|erm2-nwe9/);
      expect(message).not.toMatch(/<[a-z]/i);
    }
  });
});
