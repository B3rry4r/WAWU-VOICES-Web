# VOICES components (web/src/components/vx)

Typed TSX port of the approved design system (45 components). Same names, props, states and class names as the design bundle; icons come from lucide-react (0.460). One stylesheet, `vx.css`, reads the token variables.

## Use

```tsx
import '@/components/vx/vx.css';   // once, after the token variables (:root and [data-theme])
import { Button, Poll, AnswerCard } from '@/components/vx';
```

- Every file is a client component (`'use client'`): the components keep their own state, and take `value` + `onChange` (or `selected`) to be controlled.
- Theme: set `data-theme="light|dark"` on `<html>`; `vx.css` only uses `var(--token)`.
- Logos: the four PNGs in `assets/` must be served from `/vx/` (copy to `web/public/vx/`), or call `setVxAssetBase('https://cdn...')` once at start.
- `vx.css` imports the Archivo and Bagel Fat One fonts from Google Fonts and sets no `body` style: the app shell sets `body` background, colour and `font-family: var(--font-body)`.
- Money and unit figures in the components (tiers, costs, `₦` strings) are the design's reference values. Pass real ones in through props from the API.
- Nothing here fetches data. Pages feed it from `web/src/lib/api` only.

## Components

| Component | File | Props |
|---|---|---|
| Icon | Icon.tsx | `name`, `size?`, `strokeWidth?`, `fill?`, `label?`, `className?`, `style?` |
| Logo | Logo.tsx | `variant?`, `tone?`, `height?`, `alt?`, `src?`, `className?` |
| Button | actions.tsx | `children?`, `variant?`, `size?`, `icon?`, `iconEnd?`, `block?`, `loading?`, `disabled?`, `href?`, `target?`, `rel?`, `type?`, `onClick?`, `className?` |
| IconButton | actions.tsx | `icon`, `label`, `variant?`, `size?`, `dot?`, `count?`, `pressed?`, `iconSize?`, `onClick?`, `className?` |
| Badge | labels.tsx | `tone?`, `icon?`, `children?`, `className?` |
| NewsTag | labels.tsx | `kind`, `size?`, `withNote?`, `source?`, `className?` |
| VerifyMark | labels.tsx | `status`, `pill?`, `detail?`, `className?` |
| Avatar | identity.tsx | `name?`, `src?`, `size?`, `tone?`, `playing?`, `className?` |
| Tabs | navigation.tsx | `items`, `value?`, `defaultValue?`, `onChange?`, `variant?`, `block?`, `label?`, `className?` |
| TopicChip | navigation.tsx | `label`, `selected?`, `defaultSelected?`, `onClick?`, `count?`, `newCount?`, `icon?`, `disabled?`, `className?` |
| StageBar | navigation.tsx | `current?`, `value?`, `onChange?`, `visited?`, `counts?`, `className?` |
| TopBar | navigation.tsx | `country?`, `onCountry?`, `unread?`, `count?`, `onBell?`, `className?` |
| BottomNav | navigation.tsx | `active?`, `value?`, `onChange?`, `className?` |
| SideNav | navigation.tsx | `active?`, `value?`, `onChange?`, `collapsed?`, `units?`, `freeLeft?`, `onSpeak?`, `className?` |
| AppShell | navigation.tsx | `layout?`, `children?`, `rail?`, `active?`, `country?`, `units?`, `freeLeft?`, `className?` |
| QuestionHero | home.tsx | `question`, `eyebrow?`, `voices?`, `closesIn?`, `avatars?`, `speakLabel?`, `onSpeak?`, `onListen?`, `onDiscuss?`, `onVote?`, `className?` |
| TopicOfWeek | home.tsx | `title`, `meta?`, `eyebrow?`, `icon?`, `variant?`, `href?`, `onClick?` |
| TopicTile | home.tsx | `question`, `category?`, `voices?`, `tone?`, `tag?`, `href?`, `onClick?`, `className?` |
| TrendingList | home.tsx | `items`, `title?`, `className?` |
| VoicePlayer | conversation.tsx | `duration`, `seed?`, `bars?`, `tone?`, `progress?`, `playing?`, `speed?`, `onPlayingChange?`, `className?` |
| AnswerCard | conversation.tsx | `author`, `time`, `place?`, `text?`, `voice?`, `likes?`, `liked?`, `replies?`, `reactions?`, `reaction?`, `label?`, `tag?`, `sponsor?`, `cta?`, `unfolded?`, `trayOpen?`, `compact?`, `freeReactions?`, `className?` |
| ReactionTray | conversation.tsx | `value?`, `defaultValue?`, `onChange?`, `freeLeft?`, `className?` |
| ProposalCard | conversation.tsx | `author`, `time`, `text`, `supports?`, `challenges?`, `grouped?`, `className?` |
| Composer | speak.tsx | `freeLeft?`, `maxLength?`, `defaultValue?`, `placeholder?`, `label?`, `replyTo?`, `intent?`, `showTags?`, `newsTag?`, `cost?`, `costShort?`, `balance?`, `onSend?`, `onVoice?`, `className?` |
| FreePosts | speak.tsx | `left`, `total?`, `pill?`, `className?` |
| Recorder | speak.tsx | `question?`, `limit?`, `freeLeft?`, `passes?`, `state?`, `elapsed?`, `recorded?`, `onSend?`, `onClose?`, `className?` |
| Poll | polls.tsx | `question`, `options`, `total?`, `closesIn?`, `state?`, `selected?`, `cost?`, `costNote?`, `sponsor?`, `live?`, `onExplain?`, `className?` |
| ResultComment | polls.tsx | `id?`, `author`, `time`, `place`, `figures`, `status`, `checked?`, `note?`, `isNew?`, `className?` |
| LiveThread | polls.tsx | `title?`, `explain?`, `items`, `incoming?`, `newCount?`, `total?`, `verifiedTotal?`, `filter?`, `className?` |
| WeeklyReportCard | polls.tsx | `week`, `title?`, `moodLine`, `mood`, `themes`, `poll?`, `voices`, `votes`, `updated?`, `className?` |
| AdSlot | sponsored.tsx | `variant?`, `brand`, `headline`, `body?`, `cta?`, `href?`, `duration?`, `className?` |
| SponsoredSurvey | sponsored.tsx | `brand`, `question`, `options?`, `voiceToo?`, `questions?`, `minutes?`, `className?` |
| ShareCard | share.tsx | `kind?`, `topic`, `country?`, `question`, `args?`, `poll?`, `open?`, `quote?`, `tag?`, `summary?`, `voices`, `updated?`, `link?`, `scale?`, `className?` |
| ProfileHeader | profile.tsx | `name`, `handle`, `avatar?`, `place?`, `joined?`, `voiceCard?`, `stats?`, `units?`, `freeLeft?`, `referral?`, `own?`, `className?` |
| UnitsChip | profile.tsx | `units`, `freeLeft?`, `state?`, `onClick?`, `className?` |
| BuyUnitsSheet | wallet.tsx | `tiers?`, `selected?`, `paywall?`, `balance?`, `offer?`, `variant?`, `inline?`, `onClose?` |
| NotificationRow | profile.tsx | `type?`, `actor?`, `emoji?`, `children?`, `time`, `unread?`, `href?`, `className?` |
| Banner | feedback.tsx | `tone?`, `title?`, `children?`, `icon?`, `action?`, `actionIcon?`, `onAction?`, `onClose?`, `className?` |
| Toast | feedback.tsx | `tone?`, `icon?`, `children?`, `action?`, `onAction?`, `className?` |
| EmptyState | feedback.tsx | `icon?`, `title`, `body?`, `action?`, `actionIcon?`, `onAction?`, `className?` |
| Skeleton | feedback.tsx | `variant?`, `width?` |
| Sheet | overlays.tsx | `title`, `subtitle?`, `children?`, `footer?`, `variant?`, `open?`, `inline?`, `onClose?`, `className?` |
| Dialog | overlays.tsx | `title`, `children?`, `confirmLabel?`, `cancelLabel?`, `confirmIcon?`, `destructive?`, `onConfirm?`, `onClose?`, `open?`, `inline?` |
| TextField | inputs.tsx | `label`, `value?`, `defaultValue?`, `onChange?`, `placeholder?`, `hint?`, `error?`, `prefix?`, `prefixIcon?`, `type?`, `inputMode?`, `autoComplete?`, `multiline?`, `maxLength?`, `disabled?`, `id?`, `className?` |
| SearchField | inputs.tsx | `placeholder?`, `label?`, `defaultValue?`, `shortcut?`, `style?`, `className?` |

Full prop types are exported from `index.ts` (`ButtonProps`, `PollProps` and so on). `Icon.names` lists the 65 icon names; `REACTIONS` is the 10 v4.0 reactions; `TIERS` the design's six reference unit packs.

## Not here

Fonts, tokens and the page shell belong to the web scaffold. Pictures that prove this port: `scratchpad/voices-build/shots/ds-port/`.
