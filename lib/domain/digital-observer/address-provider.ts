import "server-only";

export type ObserverAddressSuggestion = {
  placeId: string;
  label: string;
};

export type ResolvedObserverAddress = {
  placeId: string;
  formattedAddress: string;
  city: string;
  street: string;
  buildingNumber: string;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  provider: "google_places";
};

function mapsKey() {
  return process.env.GOOGLE_MAPS_PLATFORM_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY ?? "";
}

export function observerAddressProviderConfigured() {
  return Boolean(mapsKey());
}

export async function autocompleteObserverAddress(input: string, sessionToken?: string | null) {
  const key = mapsKey();
  if (!key) return { configured: false as const, suggestions: [] as ObserverAddressSuggestion[] };

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text"
    },
    body: JSON.stringify({
      input,
      languageCode: "he",
      regionCode: "IL",
      includedRegionCodes: ["il"],
      ...(sessionToken ? { sessionToken } : {})
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    console.warn("[digital-observer-address] autocomplete failed", { status: response.status });
    throw new Error("ADDRESS_PROVIDER_UNAVAILABLE");
  }

  const payload = await response.json() as {
    suggestions?: Array<{ placePrediction?: { placeId?: string; text?: { text?: string } } }>;
  };
  const suggestions = (payload.suggestions ?? []).flatMap((item) => {
    const placeId = item.placePrediction?.placeId;
    const label = item.placePrediction?.text?.text;
    return placeId && label ? [{ placeId, label }] : [];
  });
  return { configured: true as const, suggestions };
}

function componentValue(components: Array<{ longText?: string; shortText?: string; types?: string[] }> | undefined, type: string, short = false) {
  const component = components?.find((item) => item.types?.includes(type));
  return (short ? component?.shortText : component?.longText) ?? "";
}

export async function resolveObserverAddress(placeId: string, sessionToken?: string | null): Promise<ResolvedObserverAddress | null> {
  const key = mapsKey();
  if (!key) return null;
  const query = new URLSearchParams({ languageCode: "he", regionCode: "IL" });
  if (sessionToken) query.set("sessionToken", sessionToken);
  const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${query}`, {
    headers: {
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "id,formattedAddress,addressComponents,location"
    },
    cache: "no-store"
  });
  if (!response.ok) {
    console.warn("[digital-observer-address] place resolution failed", { status: response.status });
    throw new Error("ADDRESS_PROVIDER_UNAVAILABLE");
  }

  const place = await response.json() as {
    id?: string;
    formattedAddress?: string;
    addressComponents?: Array<{ longText?: string; shortText?: string; types?: string[] }>;
    location?: { latitude?: number; longitude?: number };
  };
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!place.id || !place.formattedAddress || typeof latitude !== "number" || typeof longitude !== "number") return null;

  return {
    placeId: place.id,
    formattedAddress: place.formattedAddress,
    city: componentValue(place.addressComponents, "locality") || componentValue(place.addressComponents, "administrative_area_level_2"),
    street: componentValue(place.addressComponents, "route"),
    buildingNumber: componentValue(place.addressComponents, "street_number"),
    postalCode: componentValue(place.addressComponents, "postal_code"),
    countryCode: componentValue(place.addressComponents, "country", true) || "IL",
    latitude,
    longitude,
    provider: "google_places"
  };
}
