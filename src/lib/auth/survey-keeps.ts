/** Everything a survey keeps in this tab (draft answers, the started flag, the skip flag) starts with this, and is keyed by the signed-in person's id. */
export const SURVEY_KEEP_PREFIX = "wawu.survey.";

/** Removes everything the surveys kept in this tab, for every person. Signing out calls it. Never throws. */
export function clearSurveyKeeps(): void {
  try {
    if (typeof window === "undefined") return;
    const s = window.sessionStorage;
    const gone: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(SURVEY_KEEP_PREFIX)) gone.push(k);
    }
    for (const k of gone) s.removeItem(k);
  } catch {
    /* nothing kept */
  }
}
