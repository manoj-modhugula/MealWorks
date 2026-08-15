/** IANA timezone picker helpers. */

export const SYSTEM_TZ = "__device__";

const REGION_LABEL: Record<string, string> = {
  Africa: "Africa",
  America: "Americas",
  Antarctica: "Antarctica",
  Arctic: "Arctic",
  Asia: "Asia",
  Atlantic: "Atlantic",
  Australia: "Australia",
  Europe: "Europe",
  Indian: "Indian Ocean",
  Pacific: "Pacific",
  Etc: "Other",
};

export type TzGroup = { region: string; zones: string[] };

function listIanaZones(): string[] {
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (k: string) => string[] }
    ).supportedValuesOf;
    if (typeof supported === "function") {
      return supported("timeZone");
    }
  } catch {
    /* older engine */
  }
  return [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Europe/London",
    "Europe/Paris",
    "Europe/Berlin",
    "Asia/Kolkata",
    "Asia/Dubai",
    "Asia/Singapore",
    "Asia/Tokyo",
    "Australia/Sydney",
    "Pacific/Auckland",
  ];
}

/** Zones grouped by IANA region, for a native <select>. */
export function timezoneGroups(): TzGroup[] {
  const byRegion = new Map<string, string[]>();
  for (const z of listIanaZones()) {
    const region = z.split("/")[0] || "Other";
    const list = byRegion.get(region) || [];
    list.push(z);
    byRegion.set(region, list);
  }
  return [...byRegion.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([region, zones]) => ({
      region: REGION_LABEL[region] || region,
      zones: zones.sort((a, b) => a.localeCompare(b)),
    }));
}

/** Label for the System row. */
export function systemTzLabel(deviceTz: string) {
  return deviceTz ? `System · ${deviceTz.replace(/_/g, " ")}` : "System";
}
