/** "PU 012, Ward 3, Ikeja, Lagos": people type "PU 012" or "Ward 3" themselves, so the label strips a typed prefix before it adds its own
 *  and never doubles it (lead ruling WF, 6 Nov, C-M5). The same rule as the admin page's unitLabel. */
export function unitLabel(p: { pollingUnit: string; ward: string; lga: string; state: string }): string {
  const pu = String(p.pollingUnit).trim().replace(/^(?:PU|polling unit)\b[\s.:#-]*/i, "");
  const ward = String(p.ward).trim().replace(/^ward\b[\s.:#-]*/i, "");
  return `PU ${pu}, Ward ${ward}, ${p.lga}, ${p.state}`;
}
