// Resolves a bill name to a search URL on the appropriate authority.
// Federal bills hit Congress.gov's legislation search (congress-number-agnostic,
// so the link survives a bill being reintroduced in a later session). State
// bills go to DuckDuckGo with the bill name plus state — works regardless of
// which state, no maintenance cost, privacy-respecting per project posture.
export function billSearchUrl(
  name: string,
  chamber: "federal" | "state",
  state?: string,
): string {
  if (chamber === "federal") {
    const q = encodeURIComponent(
      JSON.stringify({ source: "legislation", search: name }),
    );
    return `https://www.congress.gov/search?q=${q}`;
  }
  const stateLabel = state ?? "state";
  const query = `${name} ${stateLabel} legislature bill text`;
  return `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
}
