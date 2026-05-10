// Geocodio wrapper — turns a ZIP (or address) into civic geography:
// state, US House district, state legislative districts, plus a roster of
// federal and state legislators with contact info.
//
// Docs: https://www.geocod.io/docs/

export interface RepContact {
  type: string;          // 'phone' | 'address' | 'url' | 'email' | 'facebook' | 'twitter'
  value: string;
}

export interface Representative {
  level: "federal" | "state";
  chamber: "senate" | "house" | "lower" | "upper";
  name: string;
  party: string | null;
  state: string;
  district: string | null;
  office: string;        // human label, e.g. "U.S. Senator (NY)"
  contacts: RepContact[];
  bioguide_id?: string;
  photo_url?: string;
}

export interface RepLookupResult {
  zip: string;
  state: string | null;
  city: string | null;
  congressional_district: string | null;
  state_lower_district: string | null;
  state_upper_district: string | null;
  representatives: Representative[];
}

interface GeocodioField {
  name?: string;
  district_number?: number;
  ocd_id?: string;
  current_legislators?: GeocodioLegislator[];
}

interface GeocodioLegislator {
  type: "representative" | "senator";
  bio: { first_name: string; last_name: string; party?: string };
  contact: { url?: string; phone?: string; address?: string; contact_form?: string };
  social?: { rss_url?: string; twitter?: string; facebook?: string; youtube?: string };
  references?: { bioguide_id?: string };
}

export async function lookupReps(zip: string, apiKey: string): Promise<RepLookupResult> {
  const cleaned = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(cleaned)) {
    throw new Error("Invalid ZIP. Five digits expected.");
  }

  const url = new URL("https://api.geocod.io/v1.7/geocode");
  url.searchParams.set("q", cleaned);
  url.searchParams.set("fields", "cd,stateleg,timezone");
  url.searchParams.set("limit", "1");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    headers: { accept: "application/json" },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Geocodio ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as { results?: any[] };
  const top = json.results?.[0];
  if (!top) throw new Error("No results for that ZIP.");

  const components = top.address_components ?? {};
  const fields = top.fields ?? {};

  const cd = (fields.congressional_districts ?? [])[0] as GeocodioField | undefined;
  const stateLeg = fields.state_legislative_districts ?? {};
  const lower = (stateLeg.house ?? [])[0] as GeocodioField | undefined;
  const upper = (stateLeg.senate ?? [])[0] as GeocodioField | undefined;

  const reps: Representative[] = [];

  // Federal: Senators (state-wide) + Rep (district)
  for (const leg of cd?.current_legislators ?? []) {
    reps.push(legislatorToRep(leg, "federal", components.state, cd?.district_number?.toString() ?? null));
  }

  // State lower
  for (const leg of lower?.current_legislators ?? []) {
    reps.push(stateLegislatorToRep(leg, "lower", components.state, lower?.district_number?.toString() ?? null));
  }
  // State upper
  for (const leg of upper?.current_legislators ?? []) {
    reps.push(stateLegislatorToRep(leg, "upper", components.state, upper?.district_number?.toString() ?? null));
  }

  return {
    zip: cleaned,
    state: components.state ?? null,
    city: components.city ?? null,
    congressional_district: cd?.district_number?.toString() ?? null,
    state_lower_district: lower?.district_number?.toString() ?? null,
    state_upper_district: upper?.district_number?.toString() ?? null,
    representatives: reps,
  };
}

function legislatorToRep(
  leg: GeocodioLegislator,
  level: "federal" | "state",
  state: string,
  district: string | null,
): Representative {
  const fullName = `${leg.bio.first_name} ${leg.bio.last_name}`.trim();
  const chamber: Representative["chamber"] =
    leg.type === "senator" ? "senate" : "house";
  const office =
    chamber === "senate"
      ? `U.S. Senator (${state})`
      : `U.S. Representative (${state}-${district ?? "?"})`;
  return {
    level,
    chamber,
    name: fullName,
    party: leg.bio.party ?? null,
    state,
    district,
    office,
    contacts: contactsFrom(leg),
    bioguide_id: leg.references?.bioguide_id,
  };
}

function stateLegislatorToRep(
  leg: GeocodioLegislator,
  chamber: "lower" | "upper",
  state: string,
  district: string | null,
): Representative {
  const fullName = `${leg.bio.first_name} ${leg.bio.last_name}`.trim();
  const office =
    chamber === "upper"
      ? `State Senator (${state}, District ${district ?? "?"})`
      : `State Representative (${state}, District ${district ?? "?"})`;
  return {
    level: "state",
    chamber,
    name: fullName,
    party: leg.bio.party ?? null,
    state,
    district,
    office,
    contacts: contactsFrom(leg),
  };
}

function contactsFrom(leg: GeocodioLegislator): RepContact[] {
  const out: RepContact[] = [];
  const c = leg.contact ?? {};
  if (c.phone) out.push({ type: "phone", value: c.phone });
  if (c.url) out.push({ type: "url", value: c.url });
  if (c.contact_form) out.push({ type: "form", value: c.contact_form });
  if (c.address) out.push({ type: "address", value: c.address });
  const s = leg.social ?? {};
  if (s.twitter) out.push({ type: "twitter", value: `https://twitter.com/${s.twitter}` });
  if (s.facebook) out.push({ type: "facebook", value: `https://facebook.com/${s.facebook}` });
  return out;
}
