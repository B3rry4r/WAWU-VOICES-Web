/** Everything a survey keeps in this tab (draft answers, the started flag, the skip flag) starts with this, then the person's id and the survey id.
 *  Nothing here is ever cleared by signing out or by another person signing in: what one person kept is only theirs. */
export const SURVEY_KEEP_PREFIX = "wawu.survey.";
