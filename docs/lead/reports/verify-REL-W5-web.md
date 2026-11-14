VERDICT: FIX

# REL-W5 web check (interim, pushed early because of a HIGH)

Checked at main 79c7a9c, built and run with `next start`, API stubbed in the browser.

## HIGH

### H1. Editing an old long post silently cuts it to 2,500 characters and saves the cut version
- Steps: signed in, own text post of 4,002 characters (older than the 2,500 limit). Profile, "More", "Edit this post". Type two characters at the end (or fix a typo anywhere). Tap "Save changes".
- Happened: the box opens with all 4,002 characters and the line "Keep it to 2,500 characters." On the first keystroke the text is chopped to 2,500, the last 1,500 characters are gone from the box, and Save sends only the chopped text (PATCH body length 2500). The server accepts a shorter text, so the person's words are lost for good, and the server never gets to refuse.
- Should happen: the box keeps the whole old text. A save that is too long is sent as it is and the server's own refusal line is shown (the brief: "the words shown must be the server's"), or a clear line says the edit is over the limit and nothing is cut.
- Where: `src/features/talk/OwnPost.tsx:48` (the `onChange` slices to `limit`); the opening state at `:30-32` already holds the longer text.

(More findings follow in the full report.)
