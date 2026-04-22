/**
 * ATTOM Data API — property owner lookup.
 * Docs: https://api.developer.attomdata.com/
 */

export interface OwnerInfo {
  ownerName: string | null;
  ownerAddress: string | null;
  ownerEmail: string | null;
  ownerPhone: string | null;
  ownerType: string | null;
}

export async function lookupOwner(
  address: string,
  city: string | null,
  state: string | null,
  apiKey: string
): Promise<OwnerInfo | null> {
  if (!address) return null;

  // ATTOM requires address1 and address2 (city+state or zip)
  const address2 = [city, state].filter(Boolean).join(" ") || "US";

  const params = new URLSearchParams({
    address1: address,
    address2,
  });

  const res = await fetch(
    `https://api.gateway.attomdata.com/propertyapi/v1.0.0/property/detail?${params}`,
    {
      headers: {
        apikey: apiKey,
        Accept: "application/json",
      },
    }
  );

  if (res.status === 404 || res.status === 204) return null;

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ATTOM API error ${res.status}: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const prop = data?.property?.[0];
  if (!prop) return null;

  // Owner details live under assessment.owner or owner object
  const owner = prop.assessment?.owner ?? prop.owner ?? {};
  const ownerName =
    owner.owner1?.fullname ??
    owner.owner1?.name ??
    [owner.owner1?.firstname, owner.owner1?.lastname].filter(Boolean).join(" ") ??
    null;

  const mail = prop.assessment?.assessed?.assdttlvalue
    ? null
    : prop.address?.mailaddress;

  const ownerAddress = mail
    ? [mail.oneLine ?? [mail.line1, mail.line2, mail.city, mail.state, mail.postal].filter(Boolean).join(", ")].join("")
    : null;

  return {
    ownerName: ownerName || null,
    ownerAddress: ownerAddress || null,
    ownerEmail: null, // ATTOM basic tier does not return email
    ownerPhone: owner.owner1?.phone ?? null,
    ownerType: prop.assessment?.owner?.corporateindicator === "Y" ? "Corporate" : "Individual",
  };
}
