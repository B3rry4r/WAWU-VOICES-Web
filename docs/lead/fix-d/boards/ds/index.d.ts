import type * as React from 'react';

type IconName = 'house' | 'compass' | 'mic' | 'user' | 'bell' | 'globe' | 'search' | 'play' | 'pause' | 'heart' | 'smile-plus' | 'message-circle' | 'share-2' | 'flag' | 'ellipsis' | 'x' | 'check' | 'chevron-right' | 'chevron-left' | 'chevron-down' | 'arrow-left' | 'arrow-up' | 'rotate-ccw' | 'trash-2' | 'square' | 'shield-check' | 'shield-alert' | 'messages-square' | 'badge-check' | 'circle-dashed' | 'wifi-off' | 'triangle-alert' | 'info' | 'circle-check' | 'circle-x' | 'coins' | 'wallet' | 'chart-column' | 'user-check' | 'plus' | 'minus' | 'clock' | 'lock' | 'settings' | 'copy' | 'link' | 'megaphone' | 'clipboard-list' | 'trending-up' | 'radio' | 'eye' | 'headphones' | 'lightbulb' | 'vote' | 'message-square' | 'map-pin' | 'send' | 'captions' | 'refresh-cw' | 'volume-2' | 'bookmark' | 'file-down' | 'mic-off' | 'sun' | 'moon';
type NewsKind = 'verified' | 'unverified' | 'gossip';
interface Person { handle?: string; name?: string; avatar?: string }

export interface IconProps { name: IconName; size?: number; strokeWidth?: number; fill?: boolean; label?: string; className?: string; style?: React.CSSProperties }
export declare function Icon(props: IconProps): React.ReactElement | null;
export interface LogoProps { variant?: 'wordmark' | 'mark'; tone?: 'green' | 'white'; height?: number; alt?: string; src?: string; className?: string }
export declare function Logo(props: LogoProps): React.ReactElement;

export interface ButtonProps { children?: React.ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'destructive' | 'dark' | 'onforest'; size?: 's' | 'm' | 'l'; icon?: IconName; iconEnd?: IconName; block?: boolean; loading?: boolean; disabled?: boolean; href?: string; type?: 'button' | 'submit'; onClick?: React.MouseEventHandler; className?: string }
export declare function Button(props: ButtonProps): React.ReactElement;
export interface IconButtonProps { icon: IconName; label: string; variant?: 'ghost' | 'solid' | 'dark'; size?: 's' | 'm'; dot?: boolean; count?: number; pressed?: boolean; iconSize?: number; onClick?: React.MouseEventHandler; className?: string }
export declare function IconButton(props: IconButtonProps): React.ReactElement;

export interface BadgeProps { tone?: 'neutral' | 'green' | 'sun' | 'forest' | 'ad' | 'sponsored' | 'proposed' | 'promoted' | 'live' | 'rank' | 'you' | 'leading' | 'count'; icon?: IconName; children?: React.ReactNode; className?: string }
export declare function Badge(props: BadgeProps): React.ReactElement;
export interface NewsTagProps { kind: NewsKind; size?: 's' | 'm'; withNote?: boolean; source?: { name: string; href?: string }; className?: string }
export declare function NewsTag(props: NewsTagProps): React.ReactElement;
export interface VerifyMarkProps { status: 'verified' | 'unverified'; pill?: boolean; detail?: string; className?: string }
export declare function VerifyMark(props: VerifyMarkProps): React.ReactElement;
export interface AvatarProps { name?: string; src?: string; size?: 's' | 'm' | 'l' | 'xl'; tone?: 'sun' | 'mint' | 'sky' | 'coral' | 'forest'; playing?: boolean; className?: string }
export declare function Avatar(props: AvatarProps): React.ReactElement;

export interface TabsProps { items: { id: string; label: string; icon?: IconName; count?: number }[]; value?: string; defaultValue?: string; onChange?: (id: string) => void; variant?: 'underline' | 'segmented'; block?: boolean; label?: string; className?: string }
export declare function Tabs(props: TabsProps): React.ReactElement;
export interface TopicChipProps { label: string; selected?: boolean; defaultSelected?: boolean; onClick?: (selected: boolean) => void; count?: number; newCount?: number; icon?: IconName; disabled?: boolean; className?: string }
export declare function TopicChip(props: TopicChipProps): React.ReactElement;
export interface StageBarProps { current?: 'speak' | 'discuss' | 'vote' | 'next'; value?: 'speak' | 'discuss' | 'vote' | 'next'; onChange?: (id: string) => void; visited?: string[]; counts?: { speak?: string; discuss?: string; vote?: string; next?: string }; className?: string }
export declare function StageBar(props: StageBarProps): React.ReactElement;
export interface TopBarProps { country?: string; onCountry?: () => void; unread?: boolean; count?: number; onBell?: () => void; className?: string }
export declare function TopBar(props: TopBarProps): React.ReactElement;
export interface BottomNavProps { active?: 'home' | 'discover' | 'speak' | 'profile'; value?: string; onChange?: (id: string) => void; className?: string }
export declare function BottomNav(props: BottomNavProps): React.ReactElement;
export interface SideNavProps { active?: 'home' | 'discover' | 'report' | 'profile'; value?: string; onChange?: (id: string) => void; collapsed?: boolean; units?: string; freeLeft?: number; onSpeak?: () => void; className?: string }
export declare function SideNav(props: SideNavProps): React.ReactElement;
export interface AppShellProps { layout?: 'phone' | 'tablet' | 'desktop'; children?: React.ReactNode; rail?: React.ReactNode; active?: string; country?: string; units?: string; freeLeft?: number; className?: string }
export declare function AppShell(props: AppShellProps): React.ReactElement;

export interface QuestionHeroProps { question: string; eyebrow?: string; voices?: number; closesIn?: string; avatars?: string[]; speakLabel?: string; onSpeak?: () => void; onListen?: () => void; onDiscuss?: () => void; onVote?: () => void; className?: string }
export declare function QuestionHero(props: QuestionHeroProps): React.ReactElement;
export interface TopicOfWeekProps { title: string; meta?: string; eyebrow?: string; icon?: IconName; variant?: 'banner' | 'rail'; href?: string; onClick?: () => void }
export declare function TopicOfWeek(props: TopicOfWeekProps): React.ReactElement;
export interface TopicTileProps { question: string; category?: string; voices?: number; tone?: 'sun' | 'mint' | 'sky' | 'coral' | 'forest'; tag?: NewsKind; href?: string; onClick?: () => void; className?: string }
export declare function TopicTile(props: TopicTileProps): React.ReactElement;
export interface TrendingListProps { items: { question: string; voices: number; category?: string; href?: string }[]; title?: string; className?: string }
export declare function TrendingList(props: TrendingListProps): React.ReactElement;

export interface VoicePlayerProps { duration: number; seed?: number; bars?: number; tone?: 'mint' | 'surface' | 'forest'; progress?: number; playing?: boolean; speed?: boolean; onPlayingChange?: (playing: boolean) => void; className?: string }
export declare function VoicePlayer(props: VoicePlayerProps): React.ReactElement;
export interface AnswerCardProps { author: Person; time: string; place?: string; text?: string; voice?: { duration: number; seed?: number; transcript?: string }; likes?: number; liked?: boolean; replies?: number; reactions?: { top: string[]; total: number }; reaction?: string; label?: string; tag?: NewsKind; sponsor?: string; cta?: { label: string; href?: string }; unfolded?: boolean; trayOpen?: boolean; compact?: boolean; freeReactions?: number; className?: string }
export declare function AnswerCard(props: AnswerCardProps): React.ReactElement;
export interface ReactionTrayProps { value?: string | null; defaultValue?: string; onChange?: (name: string | null) => void; freeLeft?: number; className?: string }
export declare function ReactionTray(props: ReactionTrayProps): React.ReactElement;
export interface ProposalCardProps { author: string; time: string; text: string; supports?: number; challenges?: number; grouped?: number; className?: string }
export declare function ProposalCard(props: ProposalCardProps): React.ReactElement;

export interface ComposerProps { freeLeft?: number; maxLength?: number; defaultValue?: string; placeholder?: string; label?: string; replyTo?: string; intent?: 'agree' | 'disagree' | 'experience'; showTags?: boolean; newsTag?: 'none' | 'unverified' | 'gossip'; cost?: string; costShort?: string; balance?: string; onSend?: () => void; onVoice?: (() => void) | false; className?: string }
export declare function Composer(props: ComposerProps): React.ReactElement;
export interface FreePostsProps { left: number; total?: number; pill?: boolean; className?: string }
export declare function FreePosts(props: FreePostsProps): React.ReactElement;
export interface RecorderProps { question?: string; limit?: number; freeLeft?: number; passes?: { name: string; detail: string }[] | false; state?: 'idle' | 'recording' | 'preview'; elapsed?: number; recorded?: number; onSend?: () => void; onClose?: () => void; className?: string }
export declare function Recorder(props: RecorderProps): React.ReactElement;

export interface PollOption { id: string; label: string; votes?: number }
export interface PollProps { question: string; options: PollOption[]; total?: number; closesIn?: string; state?: 'vote' | 'confirm' | 'results'; selected?: string; cost?: string; costNote?: string; sponsor?: string; live?: boolean; onExplain?: (() => void) | false; className?: string }
export declare function Poll(props: PollProps): React.ReactElement;
export interface ResultFigure { label: string; value: string; prefix?: string; unit?: string }
export interface ResultCommentProps { id?: string | number; author: Person; time: string; place: string; figures: ResultFigure[]; status: 'verified' | 'unverified'; checked?: string; note?: string; isNew?: boolean; className?: string }
export declare function ResultComment(props: ResultCommentProps): React.ReactElement;
export interface LiveThreadProps { title?: string; explain?: string; items: ResultCommentProps[]; incoming?: ResultCommentProps[]; newCount?: number; total?: number; verifiedTotal?: number; filter?: 'all' | 'verified'; className?: string }
export declare function LiveThread(props: LiveThreadProps): React.ReactElement;
export interface WeeklyReportCardProps { week: string; title?: string; moodLine: string; mood: { label: string; pct: number; delta?: number }[]; themes: { text: string; voices: number }[]; poll?: { pct: number; text: string }; voices: number; votes: number; updated?: string; className?: string }
export declare function WeeklyReportCard(props: WeeklyReportCardProps): React.ReactElement;

export interface AdSlotProps { variant?: 'card' | 'audio' | 'banner'; brand: string; headline: string; body?: string; cta?: string; href?: string; duration?: number; className?: string }
export declare function AdSlot(props: AdSlotProps): React.ReactElement;
export interface SponsoredSurveyProps { brand: string; question: string; options?: string[]; voiceToo?: boolean; questions?: number; minutes?: number; className?: string }
export declare function SponsoredSurvey(props: SponsoredSurveyProps): React.ReactElement;
export interface ShareCardProps { kind?: 'question' | 'voice' | 'poll' | 'weekly'; topic: string; country?: string; question: string; args?: { text: string; voices: number }[]; poll?: { label: string; pct: number }[]; open?: boolean; quote?: string; tag?: NewsKind; summary?: string; voices: number; updated?: string; link?: string; scale?: number; className?: string }
export declare function ShareCard(props: ShareCardProps): React.ReactElement;

export interface ProfileHeaderProps { name: string; handle: string; avatar?: string; place?: string; joined?: string; voiceCard?: number; stats?: { label: string; value: number }[]; units?: string; freeLeft?: number; referral?: string; own?: boolean; className?: string }
export declare function ProfileHeader(props: ProfileHeaderProps): React.ReactElement;
export interface UnitsChipProps { units: string; freeLeft?: number; state?: 'low' | 'empty'; onClick?: () => void; className?: string }
export declare function UnitsChip(props: UnitsChipProps): React.ReactElement;
export interface UnitTier { id: string; name: string; price: number; units: number; bonus: number }
export interface BuyUnitsSheetProps { tiers?: UnitTier[]; selected?: string; paywall?: boolean; balance?: string; offer?: string; variant?: 'sheet' | 'dialog'; inline?: boolean; onClose?: () => void }
export declare function BuyUnitsSheet(props: BuyUnitsSheetProps): React.ReactElement;
export interface NotificationRowProps { type?: 'reply' | 'reaction' | 'poll' | 'daily' | 'tag' | 'units' | 'verified'; actor?: string; emoji?: string; children?: React.ReactNode; time: string; unread?: boolean; href?: string; className?: string }
export declare function NotificationRow(props: NotificationRowProps): React.ReactElement;

export interface BannerProps { tone?: 'info' | 'offline' | 'warning' | 'danger' | 'success'; title?: string; children?: React.ReactNode; icon?: IconName; action?: string; actionIcon?: IconName; onAction?: () => void; onClose?: () => void; className?: string }
export declare function Banner(props: BannerProps): React.ReactElement;
export interface ToastProps { tone?: 'success' | 'info' | 'danger'; icon?: IconName; children?: React.ReactNode; action?: string; onAction?: () => void; className?: string }
export declare function Toast(props: ToastProps): React.ReactElement;
export interface EmptyStateProps { icon?: IconName; title: string; body?: string; action?: string; actionIcon?: IconName; onAction?: () => void; className?: string }
export declare function EmptyState(props: EmptyStateProps): React.ReactElement;
export interface SkeletonProps { variant?: 'answer' | 'tile' | 'line'; width?: string | number }
export declare function Skeleton(props: SkeletonProps): React.ReactElement;
export interface SheetProps { title: string; subtitle?: string; children?: React.ReactNode; footer?: React.ReactNode; variant?: 'sheet' | 'dialog'; open?: boolean; inline?: boolean; onClose?: () => void; className?: string }
export declare function Sheet(props: SheetProps): React.ReactElement | null;
export interface DialogProps { title: string; children?: React.ReactNode; confirmLabel?: string; cancelLabel?: string; confirmIcon?: IconName; destructive?: boolean; onConfirm?: () => void; onClose?: () => void; open?: boolean; inline?: boolean }
export declare function Dialog(props: DialogProps): React.ReactElement | null;
export interface TextFieldProps { label: string; value?: string; defaultValue?: string; onChange?: (value: string) => void; placeholder?: string; hint?: string; error?: string; prefix?: string; type?: string; inputMode?: string; autoComplete?: string; multiline?: boolean; maxLength?: number; disabled?: boolean; id?: string; className?: string }
export declare function TextField(props: TextFieldProps): React.ReactElement;
export interface SearchFieldProps { placeholder?: string; label?: string; defaultValue?: string; shortcut?: string; style?: React.CSSProperties; className?: string }
export declare function SearchField(props: SearchFieldProps): React.ReactElement;

declare global {
  interface Window {
    Voices: {
      Icon: typeof Icon; Logo: typeof Logo; Button: typeof Button; IconButton: typeof IconButton; Badge: typeof Badge; NewsTag: typeof NewsTag; VerifyMark: typeof VerifyMark; Avatar: typeof Avatar;
      Tabs: typeof Tabs; TopicChip: typeof TopicChip; StageBar: typeof StageBar; TopBar: typeof TopBar; BottomNav: typeof BottomNav; SideNav: typeof SideNav; AppShell: typeof AppShell;
      QuestionHero: typeof QuestionHero; TopicOfWeek: typeof TopicOfWeek; TopicTile: typeof TopicTile; TrendingList: typeof TrendingList;
      VoicePlayer: typeof VoicePlayer; AnswerCard: typeof AnswerCard; ReactionTray: typeof ReactionTray; ProposalCard: typeof ProposalCard;
      Composer: typeof Composer; FreePosts: typeof FreePosts; Recorder: typeof Recorder;
      Poll: typeof Poll; ResultComment: typeof ResultComment; LiveThread: typeof LiveThread; WeeklyReportCard: typeof WeeklyReportCard;
      AdSlot: typeof AdSlot; SponsoredSurvey: typeof SponsoredSurvey; ShareCard: typeof ShareCard;
      ProfileHeader: typeof ProfileHeader; UnitsChip: typeof UnitsChip; BuyUnitsSheet: typeof BuyUnitsSheet; NotificationRow: typeof NotificationRow;
      Banner: typeof Banner; Toast: typeof Toast; EmptyState: typeof EmptyState; Skeleton: typeof Skeleton; Sheet: typeof Sheet; Dialog: typeof Dialog;
      TextField: typeof TextField; SearchField: typeof SearchField;
      assets: { wordmark: string; wordmarkWhite: string; mark: string; markWhite: string };
      reactions: { e: string; name: string }[];
      tiers: UnitTier[];
    };
  }
}
