// Mirrors the backend DTOs (see backend/src/routes/*).

export interface MeProfile {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: "pending" | "active" | "deactivated" | "rejected";
  created_at: string;
  is_admin: boolean;
  notif_prefs: Record<string, boolean>;
}

export interface VerificationPending {
  email: string;
  expires_in_minutes: number;
  delivery: "email" | "server-log";
  resend_after_secs: number;
}

export interface LoginResult {
  status: string;
  is_admin: boolean;
}

export type VoteValue = "yes" | "no" | "maybe";

export interface VoteEntry {
  user_id: string;
  display_name: string;
  vote: VoteValue;
}

export interface PollView {
  id: string;
  game_date: string;
  proposed_time: string;
  note: string | null;
  auto_created: boolean;
  attendance_locked: boolean;
  created_by: string;
  created_by_name: string;
  created_at: string;
  yes_count: number;
  no_count: number;
  maybe_count: number;
  votes: VoteEntry[];
  my_vote: VoteValue | null;
  attendees: PublicUser[];
}

export interface PublicUser {
  id: string;
  display_name: string;
}

export interface PollSummary {
  id: string;
  game_date: string;
  note: string | null;
  yes_count: number;
  attendee_count: number;
}

export interface CredentialView {
  id: string;
  bintang_name: string;
  bintang_password: string;
  posted_by: string;
  posted_by_name: string;
  posted_at: string;
  has_screenshot: boolean;
  in_use: boolean;
  in_use_court: number | null;
  clears_at: string;
}

export interface OcrLogin {
  bintang_name: string;
  bintang_password: string;
}

export interface OcrResult {
  logins: OcrLogin[];
  ok: boolean;
  screenshot_path: string | null;
  message: string;
}

export interface ReservationView {
  id: string;
  court_number: number;
  credential_id: string | null;
  credential_name: string | null;
  /** Comma-joined names of all logins attached to this court (board scan). */
  attached_logins: string | null;
  reserved_by: string;
  reserved_by_name: string;
  court_type: "full" | "half";
  player_count: number | null;
  duration_minutes: number;
  start_at: string;
  expiry_at: string;
  queue_number: number | null;
  notes: string | null;
  status: "active" | "completed" | "cancelled";
  completed_at: string | null;
  completed_by_name: string | null;
  created_at: string;
  duplicate_warning: boolean;
}

export interface BoardMatch {
  /** Every matched login on this court (one reservation, one timer). */
  credential_ids: string[];
  bintang_names: string[];
  /** Subset of credential_ids already locked elsewhere — skipped on create. */
  already_in_use_ids: string[];
  in_use_court: number | null;
  court_number: number;
  minutes_left: number | null;
  location: "current" | "queue";
  queue_position: number | null;
  current_players: string[];
  queue: string[];
  player_count: number;
  court_type: "full" | "half";
  start_type: "now" | "at_time";
  start_in_minutes: number;
  duration_minutes: number;
}

export interface BoardScanResult {
  matches: BoardMatch[];
  detected_courts: number;
  message: string;
}

export interface KcalEntry {
  user_id: string;
  display_name: string;
  kcal: number;
}

export interface KcalToday {
  entries: KcalEntry[];
  total: number;
  my_log: { kcal: number; note: string | null } | null;
}

export interface KcalHistory {
  points: { game_date: string; kcal: number }[];
  total_sessions: number;
  avg_kcal: number;
  max_kcal: number;
}

export interface AutoPollConfig {
  enabled: boolean;
  time: string;
  note: string;
  final_reminder_time: string;
}

export interface MemberRow {
  id: string;
  display_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  last_active_at: string | null;
  approved_by_name: string | null;
}

export interface MemberDetail {
  member: MemberRow;
  total_votes: number;
  total_attendance: number;
  kcal_sessions: number;
  kcal_avg: number;
}

export interface InviteRow {
  id: string;
  code: string;
  created_at: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  used_by_name: string | null;
  used_by_email: string | null;
  computed_status: "active" | "used" | "expired" | "revoked";
}

export interface SecurityEventRow {
  id: string;
  event_type: string;
  user_id: string | null;
  user_name: string | null;
  ip_address: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface SystemHealth {
  db: boolean;
  redis: boolean;
  last_jobs: Record<string, string>;
}
