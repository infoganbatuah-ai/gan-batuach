import "server-only";

import { autocompleteObserverAddress, resolveObserverAddress } from "@/lib/domain/digital-observer/address-provider";
import { assertRateLimit } from "@/lib/security/rate-limit";

export type GanAddress = {
  placeId: string;
  formattedAddress: string;
  city: string;
  street: string;
  buildingNumber: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

// A single durable ceiling covers search, selection and final write verification.
export async function assertGanAddressProviderBudget(identifier: string) {
  await assertRateLimit(identifier, "gan:google-places-client", 8, 60);
  await assertRateLimit("gan:google-places-global", "gan:google-places-global", 50, 86400);
}

export async function searchGanAddresses(input: string, sessionToken?: string) {
  const result = await autocompleteObserverAddress(input, sessionToken);
  return { configured: result.configured, suggestions: result.suggestions.slice(0, 5) };
}

export async function resolveGanAddress(placeId: string, sessionToken?: string): Promise<GanAddress | null> {
  const result = await resolveObserverAddress(placeId, sessionToken);
  if (!result || result.countryCode !== "IL" || !result.city ||
      !Number.isFinite(result.latitude) || !Number.isFinite(result.longitude) ||
      result.latitude < 29.4 || result.latitude > 33.5 ||
      result.longitude < 34.1 || result.longitude > 35.9) return null;
  return result;
}

export async function verifyGanAddressSelection(input: {
  placeId?: string | null;
  sessionToken?: string | null;
  city?: string | null;
  street?: string | null;
  buildingNumber?: string | null;
}, mode: "city" | "full") {
  if (!input.placeId) return { status: "unverified" as const, address: null };
  // The browser's Places session ended at selection. Final write verification
  // is a separate details request and must not reuse that completed token.
  const address = await resolveGanAddress(input.placeId);
  if (!address || (mode === "full" && (!address.street || !address.buildingNumber))) {
    return { status: "unverified" as const, address: null };
  }
  const city = input.city?.trim();
  const street = input.street?.trim();
  const building = input.buildingNumber?.trim();
  if ((city && city !== address.city) ||
      (mode === "full" && ((street && street !== address.street) || (building && building !== address.buildingNumber)))) {
    return { status: "unverified" as const, address: null };
  }
  return { status: "verified" as const, address };
}
