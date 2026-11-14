/* Achillea Polyglot Contract — Pure C23 LLVM ABI header (AUTO-GENERATED).
 * Source: @rosegriffon/achillea-types@1.4.4
 * Regenerate: bun --filter @rosegriffon/achillea-contract generate
 */
#pragma once

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

#define ACHILLEA_CONTRACT_SOURCE "@rosegriffon/achillea-types"
#define ACHILLEA_CONTRACT_VERSION "1.4.4"
#define ACHILLEA_DECLARATION_COUNT 227u

typedef const char *achillea_json_t;

typedef struct {
  const char *const *items;
  size_t len;
} achillea_str_slice_t;

typedef struct {
  const int64_t *items;
  size_t len;
} achillea_i64_slice_t;

typedef struct {
  const double *items;
  size_t len;
} achillea_f64_slice_t;

typedef enum Achillea_BracketMatchStatus {
  BRACKET_MATCH_STATUS_LOCKED = 0,
  BRACKET_MATCH_STATUS_WAITING = 1,
  BRACKET_MATCH_STATUS_READY = 2,
  BRACKET_MATCH_STATUS_RUNNING = 3,
  BRACKET_MATCH_STATUS_COMPLETED = 4,
  BRACKET_MATCH_STATUS_ARCHIVED = 5,
} Achillea_BracketMatchStatus;

typedef const char *Achillea_CastAvailabilityStatus;
#define CAST_AVAILABILITY_STATUS_AVAILABLE "available"
#define CAST_AVAILABILITY_STATUS_MAYBE "maybe"
#define CAST_AVAILABILITY_STATUS_UNAVAILABLE "unavailable"

typedef const char *Achillea_CastEventKind;
#define CAST_EVENT_KIND_MATCH "match"
#define CAST_EVENT_KIND_TOURNAMENT "tournament"
#define CAST_EVENT_KIND_STREAM "stream"
#define CAST_EVENT_KIND_OTHER "other"

typedef const char *Achillea_CastEventStatus;
#define CAST_EVENT_STATUS_PLANNED "planned"
#define CAST_EVENT_STATUS_OPEN_SIGNUP "open_signup"
#define CAST_EVENT_STATUS_ATTRIBUTED "attributed"
#define CAST_EVENT_STATUS_LIVE "live"
#define CAST_EVENT_STATUS_DONE "done"
#define CAST_EVENT_STATUS_CANCELLED "cancelled"

typedef const char *Achillea_CastSlotRole;
#define CAST_SLOT_ROLE_CASTER_MAIN "caster_main"
#define CAST_SLOT_ROLE_CASTER_SECONDARY "caster_secondary"
#define CAST_SLOT_ROLE_OBSERVER "observer"
#define CAST_SLOT_ROLE_PRODUCER "producer"
#define CAST_SLOT_ROLE_HOST "host"
#define CAST_SLOT_ROLE_TECHNICAL "technical"

typedef const char *Achillea_ClanMemberDistinction;
#define CLAN_MEMBER_DISTINCTION_PLAYER "Joueur"
#define CLAN_MEMBER_DISTINCTION_STAFF "Staff"
#define CLAN_MEMBER_DISTINCTION_ARTIST "Artiste"
#define CLAN_MEMBER_DISTINCTION_CONTENT_CREATOR "Créateur de contenu"

typedef enum Achillea_ClanMemberRole {
  CLAN_MEMBER_ROLE_TRIAL = 0,
  CLAN_MEMBER_ROLE_MEMBER = 1,
  CLAN_MEMBER_ROLE_SUB_CAPTAIN = 2,
  CLAN_MEMBER_ROLE_CAPTAIN = 3,
} Achillea_ClanMemberRole;

typedef enum Achillea_ClanState {
  CLAN_STATE_CREATING = 0,
  CLAN_STATE_PENDING_REVIEW = 1,
  CLAN_STATE_APPROVED = 2,
} Achillea_ClanState;

typedef const char *Achillea_EventTypeEnum;
#define EVENT_TYPE_ENUM_TOURNAMENT "TOURNAMENT"
#define EVENT_TYPE_ENUM_INTERCLAN "INTERCLAN"
#define EVENT_TYPE_ENUM_RANKED "RANKED"

typedef enum Achillea_FormMode {
  FORM_MODE_CREATE = 0,
  FORM_MODE_VALIDATE = 1,
  FORM_MODE_EDIT = 2,
} Achillea_FormMode;

typedef enum Achillea_InterclanState {
  INTERCLAN_STATE_PENDING_APPROVAL = 0,
  INTERCLAN_STATE_APPROVED = 1,
  INTERCLAN_STATE_DENIED = 2,
  INTERCLAN_STATE_READY = 3,
  INTERCLAN_STATE_ONGOING = 4,
  INTERCLAN_STATE_FINISHED = 5,
  INTERCLAN_STATE_CANCELED = 6,
  INTERCLAN_STATE_RESULT_OK = 7,
  INTERCLAN_STATE_RESULT_NOK = 8,
} Achillea_InterclanState;

typedef const char *Achillea_LicenseStatus;
#define LICENSE_STATUS_ACTIVE "Active"
#define LICENSE_STATUS_REVOKED "Revoked"
#define LICENSE_STATUS_EXPIRED "Expired"

typedef const char *Achillea_LobbyState;
#define LOBBY_STATE_FRESH "Fresh"
#define LOBBY_STATE_ONGOING "Ongoing"
#define LOBBY_STATE_PENDING_VALIDATION "Pending validation"
#define LOBBY_STATE_CONTESTED "Contested"
#define LOBBY_STATE_FINISHED "Finished"
#define LOBBY_STATE_CANCELED "Canceled"
#define LOBBY_STATE_FORFEITED "Forfeited"

typedef const char *Achillea_LobbyUserState;
#define LOBBY_USER_STATE_PENDING "Pending"
#define LOBBY_USER_STATE_READY "Ready"
#define LOBBY_USER_STATE_AFK "Afk"
#define LOBBY_USER_STATE_ONGOING "Ongoing"
#define LOBBY_USER_STATE_FINISHED "Finished"
#define LOBBY_USER_STATE_REPOOLED "Repooled"

typedef const char *Achillea_MatchFormat;
#define MATCH_FORMAT_BO1 "bo1"
#define MATCH_FORMAT_BO3 "bo3"
#define MATCH_FORMAT_BO5 "bo5"
#define MATCH_FORMAT_DOUBLE_LEG "double_leg"
#define MATCH_FORMAT_CUSTOM "custom"

typedef enum Achillea_MatchMode {
  MATCH_MODE_ONE_VS_ONE = 2,
  MATCH_MODE_TWO_VS_TWO = 4,
} Achillea_MatchMode;

typedef enum Achillea_NotificationCategory {
  NOTIFICATION_CATEGORY_USER = 0,
  NOTIFICATION_CATEGORY_CLAN = 1,
  NOTIFICATION_CATEGORY_GLOBAL = 2,
  NOTIFICATION_CATEGORY_ORGANIZATION = 3,
} Achillea_NotificationCategory;

typedef enum Achillea_NotificationType {
  NOTIFICATION_TYPE_NEW_ORGANIZATION_CREATION_REQUEST = 0,
  NOTIFICATION_TYPE_NEW_ORGANIZATION_EDITION_REQUEST = 1,
  NOTIFICATION_TYPE_NEW_ORGANIZATION_EDIT_REPLY = 2,
  NOTIFICATION_TYPE_NEW_ORGANIZATION_ACCEPT_REPLY = 3,
  NOTIFICATION_TYPE_NEW_ORGANIZATION_REJECT_REPLY = 4,
  NOTIFICATION_TYPE_CLAN_MEMBER_KICK = 5,
  NOTIFICATION_TYPE_RANKED_MATCH_FOUND = 6,
  NOTIFICATION_TYPE_REALTIME_EVENT = 7,
  NOTIFICATION_TYPE_CLAN_DISBANDED = 8,
  NOTIFICATION_TYPE_CLAN_APPLICATION_RECEIVED = 9,
  NOTIFICATION_TYPE_CLAN_APPLICATION_ACCEPTED = 10,
  NOTIFICATION_TYPE_CLAN_APPLICATION_REJECTED = 11,
  NOTIFICATION_TYPE_CLAN_INVITE_RECEIVED = 12,
} Achillea_NotificationType;

typedef enum Achillea_OrganizationState {
  ORGANIZATION_STATE_PENDING = 0,
  ORGANIZATION_STATE_APPROVED = 1,
  ORGANIZATION_STATE_REJECTED = 2,
} Achillea_OrganizationState;

typedef const char *Achillea_ParticipantStatus;
#define PARTICIPANT_STATUS_ACTIVE "Active"
#define PARTICIPANT_STATUS_WAITLISTED "Waitlisted"
#define PARTICIPANT_STATUS_DISQUALIFIED "Disqualified"

typedef const char *Achillea_PlayerNoteCategory;
#define PLAYER_NOTE_CATEGORY_BEHAVIOR "behavior"
#define PLAYER_NOTE_CATEGORY_CHEATING "cheating"
#define PLAYER_NOTE_CATEGORY_NO_SHOW "no_show"
#define PLAYER_NOTE_CATEGORY_SCORE_DISPUTE "score_dispute"
#define PLAYER_NOTE_CATEGORY_POSITIVE "positive"
#define PLAYER_NOTE_CATEGORY_OTHER "other"

typedef const char *Achillea_PlayerNoteSeverity;
#define PLAYER_NOTE_SEVERITY_INFO "info"
#define PLAYER_NOTE_SEVERITY_WARNING "warning"
#define PLAYER_NOTE_SEVERITY_SERIOUS "serious"

typedef const char *Achillea_RankedState;
#define RANKED_STATE_OPEN "Open"
#define RANKED_STATE_LOCKED "Locked"
#define RANKED_STATE_VALIDATING_PRESENCE "Validating presence"
#define RANKED_STATE_PAIRING "Pairing"
#define RANKED_STATE_VALIDATING_MATCH_START "Validating start"
#define RANKED_STATE_REPOOLING "Repooling"
#define RANKED_STATE_MATCHING "Matching"
#define RANKED_STATE_FINISHED "Finished"
#define RANKED_STATE_CANCELED "Canceled"

typedef const char *Achillea_SanctionIssuerType;
#define SANCTION_ISSUER_TYPE_USER "user"
#define SANCTION_ISSUER_TYPE_BOT "bot"
#define SANCTION_ISSUER_TYPE_STAFF "staff"
#define SANCTION_ISSUER_TYPE_SYSTEM "system"

typedef const char *Achillea_SanctionType;
#define SANCTION_TYPE_WARN "warn"
#define SANCTION_TYPE_MUTE "mute"
#define SANCTION_TYPE_KICK "kick"
#define SANCTION_TYPE_BAN "ban"
#define SANCTION_TYPE_UNMUTE "unmute"
#define SANCTION_TYPE_UNBAN "unban"
#define SANCTION_TYPE_NOTE "note"

typedef const char *Achillea_ScoreReportPolicy;
#define SCORE_REPORT_POLICY_PLAYERS "players"
#define SCORE_REPORT_POLICY_STAFF_ONLY "staff_only"

typedef enum Achillea_SocialMedia {
  SOCIAL_MEDIA_X = 0,
  SOCIAL_MEDIA_INSTAGRAM = 1,
  SOCIAL_MEDIA_TIK_TOK = 2,
  SOCIAL_MEDIA_YOUTUBE = 3,
  SOCIAL_MEDIA_TWITCH = 4,
} Achillea_SocialMedia;

typedef const char *Achillea_StageType;
#define STAGE_TYPE_ROUND_ROBIN "round_robin"
#define STAGE_TYPE_SINGLE_ELIMINATION "single_elimination"
#define STAGE_TYPE_DOUBLE_ELIMINATION "double_elimination"
#define STAGE_TYPE_LEAGUE "league"

typedef enum Achillea_TeamSide {
  TEAM_SIDE_TEAM_1 = 1,
  TEAM_SIDE_TEAM_2 = 2,
} Achillea_TeamSide;

typedef const char *Achillea_TournamentEventType;
#define TOURNAMENT_EVENT_TYPE_CREATED "created"
#define TOURNAMENT_EVENT_TYPE_UPDATED "updated"
#define TOURNAMENT_EVENT_TYPE_REGISTRATIONS_OPENED "registrations_opened"
#define TOURNAMENT_EVENT_TYPE_REGISTRATIONS_CLOSED "registrations_closed"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_REGISTERED "participant_registered"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_WAITLISTED "participant_waitlisted"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_PROMOTED "participant_promoted"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_UNREGISTERED "participant_unregistered"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_REMOVED "participant_removed"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_DISQUALIFIED "participant_disqualified"
#define TOURNAMENT_EVENT_TYPE_PARTICIPANT_REINSTATED "participant_reinstated"
#define TOURNAMENT_EVENT_TYPE_SEEDING_CHANGED "seeding_changed"
#define TOURNAMENT_EVENT_TYPE_BRACKET_GENERATED "bracket_generated"
#define TOURNAMENT_EVENT_TYPE_TOURNAMENT_STARTED "tournament_started"
#define TOURNAMENT_EVENT_TYPE_SCORE_REPORTED "score_reported"
#define TOURNAMENT_EVENT_TYPE_SCORE_VALIDATED "score_validated"
#define TOURNAMENT_EVENT_TYPE_PHASE_ADVANCED "phase_advanced"
#define TOURNAMENT_EVENT_TYPE_ORGANIZER_ADDED "organizer_added"
#define TOURNAMENT_EVENT_TYPE_ORGANIZER_REMOVED "organizer_removed"
#define TOURNAMENT_EVENT_TYPE_TOURNAMENT_CLOSED "tournament_closed"
#define TOURNAMENT_EVENT_TYPE_TOURNAMENT_CANCELED "tournament_canceled"
#define TOURNAMENT_EVENT_TYPE_TOURNAMENT_RESTORED "tournament_restored"

typedef const char *Achillea_TournamentState;
#define TOURNAMENT_STATE_PENDING "Pending"
#define TOURNAMENT_STATE_PREREGISTERING "Preregistering"
#define TOURNAMENT_STATE_PREPARING "Preparing"
#define TOURNAMENT_STATE_ONGOING "Ongoing"
#define TOURNAMENT_STATE_FINISHED "Finished"
#define TOURNAMENT_STATE_CANCELED "Canceled"

typedef enum Achillea_UserRole {
  USER_ROLE_USER = 0,
  USER_ROLE_MODERATOR = 1,
  USER_ROLE_ADMINISTRATOR = 2,
  USER_ROLE_SUPER_ADMINISTRATOR = 3,
} Achillea_UserRole;

typedef const char *Achillea_WalletTransactionDirection;
#define WALLET_TRANSACTION_DIRECTION_IN "in"
#define WALLET_TRANSACTION_DIRECTION_OUT "out"

typedef const char *Achillea_WalletTransactionType;
#define WALLET_TRANSACTION_TYPE_CREDIT "Credit"
#define WALLET_TRANSACTION_TYPE_DEBIT "Debit"
#define WALLET_TRANSACTION_TYPE_TRANSFER "Transfer"
#define WALLET_TRANSACTION_TYPE_PAYOUT "Payout"
#define WALLET_TRANSACTION_TYPE_FINE "Fine"

typedef struct Achillea_AdminAuditRow {
  const char * id;
  const char * ts;
  achillea_json_t actor_id;
  const char * action;
  const char * target_type;
  achillea_json_t target_id;
  achillea_json_t reason;
} Achillea_AdminAuditRow;

typedef struct Achillea_AdminGuildRow {
  const char * id;
  const char * name;
  achillea_json_t icon_url;
  double member_count;
  const char * owner_id;
  achillea_json_t created_at;
} Achillea_AdminGuildRow;

typedef struct Achillea_AdminHealthResponse {
  achillea_json_t bot;
  achillea_json_t host;
  achillea_json_t pid;
  achillea_json_t latency;
} Achillea_AdminHealthResponse;

typedef struct Achillea_AdminInviteResponse {
  const char * url;
} Achillea_AdminInviteResponse;

typedef struct Achillea_AdminMetricsSummary {
  achillea_json_t counters;
  double raw_lines;
} Achillea_AdminMetricsSummary;

typedef struct Achillea_AdminOpsOverview {
  achillea_json_t users;
  achillea_json_t wallet;
  achillea_json_t moderation;
  achillea_json_t community;
  achillea_json_t ranked;
  double audit24h;
  achillea_json_t bot;
  bool has_bot;
  const char * generated_at;
  bool has_generated_at;
} Achillea_AdminOpsOverview;

typedef struct Achillea_AdminRoleUpdateResult {
  bool success;
  const char * id;
  double role;
} Achillea_AdminRoleUpdateResult;

typedef struct Achillea_AdminTransactionRow {
  achillea_json_t id;
  const char * type;
  double amount;
  achillea_json_t reason;
  achillea_json_t from_user_id;
  achillea_json_t to_user_id;
  const char * created_at;
} Achillea_AdminTransactionRow;

typedef struct Achillea_AdminUserRow {
  const char * id;
  achillea_json_t username;
  achillea_json_t display_name;
  achillea_json_t avatar;
  double role;
  achillea_json_t last_interact;
} Achillea_AdminUserRow;

typedef struct Achillea_AdminWalletAdjustResult {
  bool success;
  const char * user_id;
  double balance;
} Achillea_AdminWalletAdjustResult;

typedef struct Achillea_AdminWalletRow {
  const char * user_id;
  const char * display_name;
  double balance;
  const char * currency;
} Achillea_AdminWalletRow;

typedef struct Achillea_AdminWalletsResponse {
  achillea_json_t top;
  achillea_json_t recent;
} Achillea_AdminWalletsResponse;

typedef achillea_json_t Achillea_ApiEnvelope;

typedef struct Achillea_BotMonitoringResponse {
  achillea_json_t bot_status;
  achillea_json_t host;
  achillea_json_t pid;
  achillea_json_t latency;
} Achillea_BotMonitoringResponse;

typedef struct Achillea_BotTotalsResponse {
  achillea_json_t stats;
} Achillea_BotTotalsResponse;

typedef achillea_json_t Achillea_BracketId;

typedef achillea_json_t Achillea_BracketsStageType;

typedef struct Achillea_CancelTournamentResult {
  bool success;
  const char * error;
  bool has_error;
  double notified;
  bool has_notified;
} Achillea_CancelTournamentResult;

typedef struct Achillea_CastAttribution {
  const char * id;
  const char * slot_id;
  achillea_json_t user_id;
  const char * assigned_at;
  const char * assigned_by;
  achillea_json_t confirmed_at;
} Achillea_CastAttribution;

typedef achillea_json_t Achillea_CastAutoAssignResult;

typedef struct Achillea_CastAvailability {
  const char * id;
  const char * user_id;
  Achillea_CastAvailabilityStatus status;
  achillea_json_t preferred_roles;
  achillea_json_t notes;
  const char * declared_at;
} Achillea_CastAvailability;

typedef struct Achillea_CasterPublic {
  const char * id;
  const char * display_name;
  achillea_json_t avatar;
  achillea_json_t bio;
  achillea_json_t twitch_url;
  double recent_casts;
} Achillea_CasterPublic;

typedef struct Achillea_CastEvent {
  const char * id;
  const char * name;
  Achillea_CastEventKind kind;
  const char * scheduled_at;
  double duration;
  achillea_json_t tournament_id;
  Achillea_CastEventStatus status;
  achillea_json_t description;
  achillea_json_t twitch_url;
  const char * created_by;
  const char * created_at;
  const char * updated_at;
} Achillea_CastEvent;

typedef struct Achillea_CastEventDetail {
  Achillea_CastEvent event;
  achillea_json_t slots;
  achillea_json_t attributions;
  achillea_json_t checklist;
} Achillea_CastEventDetail;

typedef struct Achillea_CastEventFilters {
  double page;
  bool has_page;
  double page_size;
  bool has_page_size;
  Achillea_CastEventStatus status;
  bool has_status;
  const char * from;
  bool has_from;
  const char * to;
  bool has_to;
} Achillea_CastEventFilters;

typedef achillea_json_t Achillea_CastEventListResponse;

typedef struct Achillea_CastSlot {
  const char * id;
  Achillea_CastSlotRole role;
  bool required;
  achillea_json_t defrayment_amount;
  achillea_json_t defrayment_currency;
  achillea_json_t defrayment_reason;
  achillea_json_t notes;
} Achillea_CastSlot;

typedef struct Achillea_CastSurveyResult {
  bool success;
  const char * event_id;
  double pool_size;
} Achillea_CastSurveyResult;

typedef struct Achillea_ChecklistItem {
  Achillea_CastSlot slot;
  achillea_json_t attribution;
  achillea_json_t caster_id;
  bool confirmed;
} Achillea_ChecklistItem;

typedef struct Achillea_CircuitClanEntry {
  double id;
  const char * name;
  const char * short_name;
  const char * avatar;
  double points;
  double players;
  double tournaments_played;
  double wins;
  double podiums;
  const char * tier;
} Achillea_CircuitClanEntry;

typedef struct Achillea_CircuitClanTag {
  double id;
  const char * name;
  const char * short_name;
  const char * avatar;
} Achillea_CircuitClanTag;

typedef struct Achillea_CircuitLeaderboardEntry {
  const char * user_id;
  const char * display_name;
  const char * username;
  const char * avatar;
  achillea_json_t clan;
  double tournaments_played;
  double points;
  double tournaments;
  double wins;
  double podiums;
  double top4;
  double top8;
  double best_rank;
  const char * best_rank_label;
  const char * tier;
} Achillea_CircuitLeaderboardEntry;

typedef struct Achillea_CircuitPodiumEntry {
  double rank;
  const char * rank_label;
  const char * user_id;
  const char * display_name;
  const char * avatar;
} Achillea_CircuitPodiumEntry;

typedef struct Achillea_CircuitRanking {
  achillea_json_t leaderboard;
  achillea_json_t tournaments;
  achillea_json_t clan_ranking;
} Achillea_CircuitRanking;

typedef struct Achillea_CircuitTournamentSummary {
  double id;
  const char * name;
  double size;
  const char * grand_final_at;
  achillea_json_t podium;
  achillea_json_t standings_status;
} Achillea_CircuitTournamentSummary;

typedef struct Achillea_Clan {
  double id;
  const char * logo;
  const char * name;
  const char * short_name;
  const char * description;
  const char * captain;
  achillea_str_slice_t founders;
  const char * x_url;
  bool has_x_url;
  const char * instagram_url;
  bool has_instagram_url;
  const char * tiktok_url;
  bool has_tiktok_url;
  double fame;
  double xp;
  achillea_json_t rank;
  bool has_rank;
  const char * created_at;
  bool is_pro;
  bool is_recruiting;
  bool auto_recruit;
  const char * langue;
  bool has_langue;
} Achillea_Clan;

typedef struct Achillea_ClanApplicationDTO {
  double id;
  achillea_json_t user;
  achillea_json_t clan;
  achillea_json_t distinctions;
  const char * created_at;
  const char * updated_at;
} Achillea_ClanApplicationDTO;

typedef struct Achillea_ClanApplicationResult {
  bool success;
  const char * error;
  bool has_error;
  bool autojoin;
  bool has_autojoin;
} Achillea_ClanApplicationResult;

typedef struct Achillea_ClanDTO {
  double id;
  achillea_str_slice_t founders;
  const char * name;
  const char * shortened_name;
  const char * normalized_short_name;
  const char * clan_avatar_url;
  const char * clan_biography;
  double fame;
  bool has_fame;
  achillea_json_t x_url;
  bool has_x_url;
  achillea_json_t instagram_url;
  bool has_instagram_url;
  achillea_json_t tiktok_url;
  bool has_tiktok_url;
  bool is_recruiting;
  bool is_inactive;
  bool is_hidden;
  bool is_disbanded;
  bool auto_accept_members;
  Achillea_ClanState state;
  const char * created_at;
  achillea_str_slice_t languages;
  const char * origin;
  achillea_json_t experience;
  double members_count;
  achillea_json_t president;
} Achillea_ClanDTO;

typedef struct Achillea_ClanInviteDTO {
  double id;
  achillea_json_t user;
  Achillea_ClanDTO clan;
  achillea_json_t inviter;
  const char * thread_id;
  bool has_thread_id;
  achillea_json_t distinctions;
  const char * created_at;
  const char * updated_at;
  const char * last_notified_at;
} Achillea_ClanInviteDTO;

typedef struct Achillea_ClanMemberDTO {
  Achillea_ClanMemberRole clan_role;
  achillea_str_slice_t distinctions;
  double clan_fame_contributed;
  const char * created_at;
  const char * updated_at;
  achillea_json_t user;
} Achillea_ClanMemberDTO;

typedef struct Achillea_ClanMemberLimits {
  double player_limit;
  double staff_limit;
} Achillea_ClanMemberLimits;

typedef struct Achillea_ClanRoleResponse {
  double role;
} Achillea_ClanRoleResponse;

typedef struct Achillea_CloseTournamentResult {
  bool success;
  const char * error;
  bool has_error;
  double open_lobbies;
  bool has_open_lobbies;
} Achillea_CloseTournamentResult;

typedef struct Achillea_Column {
  const char * field;
  const char * header;
} Achillea_Column;

typedef struct Achillea_CommandUsageRow {
  const char * date;
  double slash_commands;
  double simple_commands;
  double context_menus;
} Achillea_CommandUsageRow;

typedef struct Achillea_CompetitionStats {
  double total;
  double wins;
  double losses;
  double draws;
  double goals_scored_avg;
  double goals_received_avg;
  double personal_total;
  double personal_wins;
  double personal_losses;
  double personal_draws;
} Achillea_CompetitionStats;

typedef struct Achillea_Country {
  const char * code;
  const char * language;
  const char * flag;
  const char * name;
} Achillea_Country;

typedef struct Achillea_CreateCastEventPayload {
  const char * name;
  Achillea_CastEventKind kind;
  const char * scheduled_at;
  double duration;
  bool has_duration;
  achillea_json_t tournament_id;
  bool has_tournament_id;
  achillea_json_t twitch_url;
  bool has_twitch_url;
  achillea_json_t description;
  bool has_description;
  achillea_json_t slots;
} Achillea_CreateCastEventPayload;

typedef struct Achillea_CreatePlayerNotePayload {
  const char * target_id;
  achillea_json_t tournament_id;
  bool has_tournament_id;
  Achillea_PlayerNoteCategory category;
  bool has_category;
  Achillea_PlayerNoteSeverity severity;
  bool has_severity;
  const char * content;
} Achillea_CreatePlayerNotePayload;

typedef struct Achillea_CreateSanctionPayload {
  const char * user_id;
  const char * guild_id;
  Achillea_SanctionType type;
  achillea_json_t reason;
  bool has_reason;
  achillea_json_t duration_sec;
  bool has_duration_sec;
  achillea_json_t evidence;
  bool has_evidence;
} Achillea_CreateSanctionPayload;

typedef struct Achillea_DailyCountRow {
  const char * date;
  double count;
} Achillea_DailyCountRow;

typedef struct Achillea_DatabaseBackupResult {
  const char * message;
  achillea_json_t data;
  bool has_data;
} Achillea_DatabaseBackupResult;

typedef struct Achillea_DbColumn {
  const char * name;
  const char * data_type;
  bool nullable;
  achillea_json_t default_;
  bool is_primary_key;
} Achillea_DbColumn;

typedef struct Achillea_DbMutationResult {
  bool success;
  achillea_json_t row;
  bool has_row;
} Achillea_DbMutationResult;

typedef struct Achillea_DbQueryResult {
  achillea_json_t data;
  double row_count;
  double duration_ms;
} Achillea_DbQueryResult;

typedef struct Achillea_DbRowsPage {
  achillea_json_t data;
  achillea_json_t columns;
  achillea_json_t meta;
} Achillea_DbRowsPage;

typedef struct Achillea_DbTableRow {
  const char * name;
  double estimated_rows;
  bool protected;
} Achillea_DbTableRow;

typedef struct Achillea_DisqualifyResult {
  bool success;
  const char * error;
  bool has_error;
  double forfeited_lobbies;
  bool has_forfeited_lobbies;
  achillea_json_t promoted;
  bool has_promoted;
} Achillea_DisqualifyResult;

typedef achillea_json_t Achillea_EnrichedUserDTO;

typedef achillea_json_t Achillea_EntityRef;

typedef struct Achillea_EventEntity {
  double id;
  const char * name;
  const char * description;
  Achillea_EventTypeEnum type;
  const char * created_at;
  const char * updated_at;
} Achillea_EventEntity;

typedef struct Achillea_GameScoreDTO {
  double lobby_id;
  double game_number;
  double score1;
  double score2;
} Achillea_GameScoreDTO;

typedef struct Achillea_GameValidatorDTO {
  double lobby_id;
  double lobby_match_id;
} Achillea_GameValidatorDTO;

typedef achillea_json_t Achillea_GrandFinalType;

typedef struct Achillea_HealthCheckResponse {
  bool online;
  achillea_json_t uptime;
  achillea_json_t last_startup;
  bool has_last_startup;
} Achillea_HealthCheckResponse;

typedef struct Achillea_ImageGenerationResult {
  bool success;
  const char * error;
  bool has_error;
  const char * path;
  bool has_path;
} Achillea_ImageGenerationResult;

typedef struct Achillea_LeaderboardEntry {
  double rank;
  const char * user_id;
  const char * display_name;
  const char * avatar;
  double elo;
  double peak_rating;
  double games_played;
} Achillea_LeaderboardEntry;

typedef struct Achillea_LeaderboardPage {
  achillea_json_t entries;
  double total;
  Achillea_MatchMode mode;
} Achillea_LeaderboardPage;

typedef struct Achillea_LeagueListResponse {
  achillea_json_t items;
} Achillea_LeagueListResponse;

typedef struct Achillea_LeagueMatchRow {
  const char * home_id;
  const char * away_id;
  double home_score;
  double away_score;
  double matchday;
  bool overtime;
  bool has_overtime;
  achillea_json_t winner_id;
  bool has_winner_id;
} Achillea_LeagueMatchRow;

typedef struct Achillea_LeaguePointsConfig {
  double win;
  bool has_win;
  double draw;
  bool has_draw;
  double loss;
  bool has_loss;
  double win_regulation;
  bool has_win_regulation;
  double loss_regulation;
  bool has_loss_regulation;
  double win_overtime;
  bool has_win_overtime;
  double loss_overtime;
  bool has_loss_overtime;
} Achillea_LeaguePointsConfig;

typedef struct Achillea_LeagueSeasonPayload {
  achillea_json_t meta;
  achillea_json_t format;
  achillea_json_t teams;
  Achillea_LeaguePointsConfig points_config;
  achillea_json_t standings;
  achillea_json_t results;
  achillea_json_t playoffs;
  achillea_json_t schedule;
  bool has_schedule;
  achillea_json_t details;
  bool has_details;
} Achillea_LeagueSeasonPayload;

typedef struct Achillea_LeagueStandingRow {
  const char * team_id;
  double rank;
  double played;
  double wins;
  double draws;
  double losses;
  double wins_ot;
  double losses_ot;
  double points;
  double map_diff;
  double maps_for;
  double maps_against;
} Achillea_LeagueStandingRow;

typedef struct Achillea_LeagueSummary {
  const char * id;
  const char * name;
  const char * season;
  const char * format;
  const char * description;
  const char * champion;
  bool has_champion;
  double team_count;
  double matchdays;
  achillea_str_slice_t aliases;
} Achillea_LeagueSummary;

typedef struct Achillea_LeagueTeam {
  const char * tag;
  const char * name;
} Achillea_LeagueTeam;

typedef struct Achillea_License {
  const char * id;
  const char * user_id;
  const char * license_number;
  const char * issued_at;
  const char * valid_until;
  Achillea_LicenseStatus status;
  achillea_json_t pdf_url;
  const char * created_at;
  const char * updated_at;
} Achillea_License;

typedef struct Achillea_LicenseHolderResponse {
  achillea_json_t license;
  achillea_json_t verification_token;
} Achillea_LicenseHolderResponse;

typedef achillea_json_t Achillea_LicenseVerifyReason;

typedef struct Achillea_LicenseVerifyResult {
  bool valid;
  Achillea_LicenseVerifyReason reason;
  bool has_reason;
  const char * license_number;
  bool has_license_number;
  const char * valid_until;
  bool has_valid_until;
  achillea_json_t holder;
  bool has_holder;
} Achillea_LicenseVerifyResult;

typedef struct Achillea_LobbyDTO {
  double id;
  Achillea_MatchMode mode;
  Achillea_LobbyState state;
  achillea_json_t bracket_match_id;
  bool has_bracket_match_id;
  achillea_json_t lobby_users;
  achillea_json_t lobby_matches;
  achillea_json_t host_user;
  achillea_json_t match_format;
  bool has_match_format;
} Achillea_LobbyDTO;

typedef struct Achillea_LobbyMatchDTO {
  double id;
  double game_number;
  double score_team1;
  double score_team2;
  bool team1_validated;
  bool team2_validated;
  bool admin_validated;
} Achillea_LobbyMatchDTO;

typedef struct Achillea_LobbyUserDataDTO {
  const char * display_name;
  const char * id;
  const char * avatar;
} Achillea_LobbyUserDataDTO;

typedef struct Achillea_LobbyUserDTO {
  double id;
  Achillea_LobbyUserDataDTO user;
  Achillea_TeamSide team;
  bool forfeit;
  Achillea_LobbyUserState state;
} Achillea_LobbyUserDTO;

typedef struct Achillea_MaintenanceResponse {
  bool maintenance;
} Achillea_MaintenanceResponse;

typedef achillea_json_t Achillea_MatchResult;

typedef achillea_json_t Achillea_MatchRoomStatus;

typedef struct Achillea_ModerationSyncResult {
  bool ok;
  const char * sanction_id;
} Achillea_ModerationSyncResult;

typedef struct Achillea_NewClanPayload {
  achillea_json_t founders;
  const char * logo;
  const char * name;
  const char * normalized_name;
  const char * short_name;
  const char * normalized_short_name;
  const char * description;
  const char * twitter;
  bool has_twitter;
  const char * instagram;
  bool has_instagram;
  const char * tiktok;
  bool has_tiktok;
  Achillea_Country origin;
  bool has_origin;
  achillea_json_t languages;
  bool has_languages;
} Achillea_NewClanPayload;

typedef struct Achillea_NewClanResponse {
  bool success;
  const char * error;
  bool has_error;
  double clan_id;
  bool has_clan_id;
  const char * conflict;
  bool has_conflict;
} Achillea_NewClanResponse;

typedef struct Achillea_NewTournamentDTO {
  const char * name;
  const char * description;
  achillea_json_t series;
  bool has_series;
  achillea_json_t organization;
  achillea_json_t managers;
  bool has_managers;
  const char * starts_at;
  const char * grand_final_at;
  Achillea_StageType tournament_type;
  achillea_json_t participants_number;
  bool has_participants_number;
  achillea_json_t seed_ordering;
  bool has_seed_ordering;
  achillea_json_t match_format;
  bool has_match_format;
  achillea_json_t custom_format_child_count;
  bool has_custom_format_child_count;
  bool group_stage_enabled;
  achillea_json_t group_stage_type;
  bool has_group_stage_type;
  achillea_json_t affiche;
  bool has_affiche;
  const char * logo;
  const char * ruleset;
  const char * planning;
  achillea_json_t registration_opens_at;
  bool has_registration_opens_at;
  achillea_json_t registration_closes_at;
  bool has_registration_closes_at;
  bool auto_start;
  bool has_auto_start;
  bool discord_role_enabled;
  bool has_discord_role_enabled;
  Achillea_ScoreReportPolicy score_report_policy;
  bool has_score_report_policy;
  bool bypass_rules;
  bool has_bypass_rules;
} Achillea_NewTournamentDTO;

typedef struct Achillea_NotificationModel {
  double id;
  const char * title;
  const char * message;
  Achillea_NotificationType type;
  Achillea_NotificationCategory category;
  achillea_json_t payload;
} Achillea_NotificationModel;

typedef struct Achillea_OpenRegistrationsResult {
  bool success;
  double id;
  Achillea_TournamentState internal_state;
} Achillea_OpenRegistrationsResult;

typedef struct Achillea_OrganizationDTO {
  achillea_json_t id;
  bool has_id;
  Achillea_OrganizationState state;
  bool has_state;
  const char * name;
  const char * normalized_name;
  const char * logo;
  const char * description;
  achillea_json_t owner;
  bool has_owner;
  achillea_json_t org_managers;
  bool has_org_managers;
  achillea_json_t managers;
  bool has_managers;
  bool preapproved;
  bool has_preapproved;
  achillea_json_t social_medias;
  bool has_social_medias;
  achillea_json_t broadcast_medias;
  bool has_broadcast_medias;
  achillea_json_t origin;
  bool has_origin;
  const char * created_at;
  bool has_created_at;
  const char * updated_at;
  bool has_updated_at;
} Achillea_OrganizationDTO;

typedef struct Achillea_OrganizationValidationDTO {
  achillea_json_t id;
  bool has_id;
  achillea_json_t reviewer;
  achillea_json_t name;
  achillea_json_t logo;
  achillea_json_t description;
  achillea_json_t twitter_url;
  achillea_json_t instagram_url;
  achillea_json_t tiktok_url;
  achillea_json_t twitch_url;
  achillea_json_t youtube_url;
} Achillea_OrganizationValidationDTO;

typedef struct Achillea_OrgManagerDTO {
  achillea_json_t organization;
  bool has_organization;
  achillea_json_t user;
  const char * created_at;
  bool has_created_at;
  const char * updated_at;
  bool has_updated_at;
} Achillea_OrgManagerDTO;

typedef achillea_json_t Achillea_PagedList;

typedef struct Achillea_PageMeta {
  double page;
  bool has_page;
  double limit;
  bool has_limit;
  double total;
  achillea_json_t page_count;
  bool has_page_count;
} Achillea_PageMeta;

typedef struct Achillea_PageQuery {
  double page;
  bool has_page;
  double page_size;
  bool has_page_size;
} Achillea_PageQuery;

typedef struct Achillea_PageSizeMeta {
  double page;
  double page_size;
  double page_count;
} Achillea_PageSizeMeta;

typedef achillea_json_t Achillea_Paginated;

typedef struct Achillea_ParticipantDTO {
  double id;
  achillea_json_t tournament;
  achillea_json_t user;
  achillea_json_t bracket_participant_id;
  bool has_bracket_participant_id;
  achillea_json_t seed;
  bool has_seed;
  bool has_checked_in;
  Achillea_ParticipantStatus status;
  bool has_status;
  const char * registered_at;
  bool has_registered_at;
  achillea_json_t waitlist_position;
  bool has_waitlist_position;
  achillea_json_t status_reason;
  bool has_status_reason;
} Achillea_ParticipantDTO;

typedef struct Achillea_ParticipantMutationResult {
  bool success;
  const char * error;
  bool has_error;
  achillea_json_t participant;
  bool has_participant;
} Achillea_ParticipantMutationResult;

typedef struct Achillea_PlacementPrizesResult {
  bool success;
  const char * error;
  bool has_error;
  bool applied;
  bool has_applied;
  const char * reason;
  bool has_reason;
  achillea_json_t deltas;
  bool has_deltas;
  double tournament_size;
  bool has_tournament_size;
} Achillea_PlacementPrizesResult;

typedef struct Achillea_PlayerCircuitProfile {
  double tournaments_played;
  double points;
  const char * tier;
  double wins;
  double podiums;
  double top4;
  double top8;
  const char * best_rank_label;
  double goals_scored;
  double goals_conceded;
  double goal_average;
  double best_streak;
  achillea_json_t history;
} Achillea_PlayerCircuitProfile;

typedef struct Achillea_PlayerNote {
  const char * id;
  achillea_json_t target;
  achillea_json_t author;
  achillea_json_t tournament;
  Achillea_PlayerNoteCategory category;
  Achillea_PlayerNoteSeverity severity;
  const char * content;
  bool resolved;
  achillea_json_t resolved_at;
  achillea_json_t resolved_by;
  const char * created_at;
  const char * updated_at;
  achillea_json_t docs_url;
} Achillea_PlayerNote;

typedef struct Achillea_PlayerNoteFilters {
  double page;
  bool has_page;
  double page_size;
  bool has_page_size;
  const char * target_id;
  bool has_target_id;
  double tournament_id;
  bool has_tournament_id;
  Achillea_PlayerNoteCategory category;
  bool has_category;
  Achillea_PlayerNoteSeverity severity;
  bool has_severity;
  bool resolved;
  bool has_resolved;
} Achillea_PlayerNoteFilters;

typedef struct Achillea_PlayerNoteFiltersExtra {
  Achillea_PlayerNoteCategory category;
  bool has_category;
  Achillea_PlayerNoteSeverity severity;
  bool has_severity;
  const char * search;
  bool has_search;
} Achillea_PlayerNoteFiltersExtra;

typedef struct Achillea_PlayerNoteListResponse {
  achillea_json_t data;
  double total;
  achillea_json_t meta;
} Achillea_PlayerNoteListResponse;

typedef struct Achillea_PlayerNotePerson {
  const char * id;
  const char * username;
  const char * display_name;
  const char * avatar;
} Achillea_PlayerNotePerson;

typedef struct Achillea_PlayerNoteSummary {
  double total;
  double open;
  achillea_json_t by_severity;
} Achillea_PlayerNoteSummary;

typedef struct Achillea_PlayerTournamentHistoryEntry {
  double tournament_id;
  const char * tournament_name;
  const char * grand_final_at;
  double size;
  achillea_json_t rank;
  const char * rank_label;
  double points;
  const char * tier;
  double goals_scored;
  double goals_conceded;
} Achillea_PlayerTournamentHistoryEntry;

typedef struct Achillea_Rank {
  const char * label;
  double min_elo;
  double max_elo;
  achillea_str_slice_t gradient;
} Achillea_Rank;

typedef struct Achillea_RankDTO {
  double elo;
  const char * key;
  achillea_str_slice_t gradient;
} Achillea_RankDTO;

typedef struct Achillea_RankedActiveMatch {
  double lobby_id;
  Achillea_MatchMode mode;
  const char * created_at;
  achillea_json_t player1;
  achillea_json_t player2;
} Achillea_RankedActiveMatch;

typedef struct Achillea_RankedActivePlayer {
  const char * user_id;
  const char * display_name;
  double score;
  achillea_json_t claimed_opponent_score;
  bool submitted;
  bool has_proof;
} Achillea_RankedActivePlayer;

typedef struct Achillea_RankedAdminDispute {
  double lobby_id;
  Achillea_MatchMode mode;
  achillea_json_t player1;
  achillea_json_t player2;
  const char * created_at;
} Achillea_RankedAdminDispute;

typedef struct Achillea_RankedAdminSeason {
  const char * id;
  const char * name;
  achillea_json_t state;
  const char * starts_at;
  const char * ends_at;
  achillea_json_t config;
  double player_count;
} Achillea_RankedAdminSeason;

typedef struct Achillea_RankedAdminValidateRequest {
  double score_team1;
  double score_team2;
  const char * forfeit_user_id;
  bool has_forfeit_user_id;
} Achillea_RankedAdminValidateRequest;

typedef struct Achillea_RankedAdminValidateResult {
  bool ok;
  achillea_json_t elo_delta;
  bool has_elo_delta;
} Achillea_RankedAdminValidateResult;

typedef struct Achillea_RankedChallengeAccepted {
  achillea_json_t reservation;
  double mode;
  bool ranked;
} Achillea_RankedChallengeAccepted;

typedef struct Achillea_RankedChallengeLink {
  const char * code;
  const char * url;
  Achillea_MatchMode mode;
  bool ranked;
  achillea_json_t to_user_id;
  double expires_at;
} Achillea_RankedChallengeLink;

typedef struct Achillea_RankedChallengePreview {
  const char * code;
  const char * from_user_id;
  const char * from_display_name;
  const char * from_avatar;
  double from_elo;
  Achillea_MatchMode mode;
  bool ranked;
  bool is_own;
  double expires_at;
} Achillea_RankedChallengePreview;

typedef struct Achillea_RankedChatMessage {
  const char * user_id;
  const char * text;
  double at;
} Achillea_RankedChatMessage;

typedef struct Achillea_RankedDisputePlayer {
  const char * user_id;
  const char * display_name;
  double submitted_score;
  achillea_json_t claimed_opponent_score;
  bool has_claimed_opponent_score;
  achillea_json_t screenshot_url;
  bool has_screenshot_url;
} Achillea_RankedDisputePlayer;

typedef struct Achillea_RankedDisputeRequest {
  double lobby_id;
  const char * screenshot_url;
} Achillea_RankedDisputeRequest;

typedef struct Achillea_RankedHistoryEntry {
  double lobby_id;
  Achillea_MatchMode mode;
  const char * state;
  const char * ended_at;
  double my_score;
  double opponent_score;
  double elo_delta;
  Achillea_MatchResult result;
  achillea_json_t opponent;
} Achillea_RankedHistoryEntry;

typedef struct Achillea_RankedLadderResetResult {
  bool ok;
  double affected;
} Achillea_RankedLadderResetResult;

typedef struct Achillea_RankedLobbyPlayer {
  const char * user_id;
  const char * display_name;
  const char * avatar;
  double elo;
  double mode;
} Achillea_RankedLobbyPlayer;

typedef struct Achillea_RankedMatchEvent {
  double id;
  const char * created_at;
  achillea_json_t lobby_id;
  achillea_json_t room_code;
  achillea_json_t mode;
  achillea_json_t user_id;
  achillea_json_t display_name;
  const char * type;
  achillea_json_t detail;
} Achillea_RankedMatchEvent;

typedef struct Achillea_RankedMatchSummary {
  double lobby_id;
  const char * room_code;
  Achillea_MatchMode mode;
  bool ranked;
  bool has_ranked;
  achillea_json_t opponent;
  Achillea_MatchResult result;
  double my_score;
  double opponent_score;
  double elo_before;
  double elo_after;
  double elo_delta;
  achillea_json_t new_tier;
  const char * ended_at;
} Achillea_RankedMatchSummary;

typedef struct Achillea_RankedModeStats {
  Achillea_MatchMode mode;
  double total;
  double wins;
  double losses;
  double draws;
  double goals_scored;
  double goals_received;
} Achillea_RankedModeStats;

typedef struct Achillea_RankedOverview {
  double active_matches;
  double contested_matches;
  double finished_today;
  double matches_today;
  double total_players;
} Achillea_RankedOverview;

typedef struct Achillea_RankedPendingInvite {
  const char * from_user_id;
  const char * from_display_name;
  const char * from_avatar;
  double from_elo;
  Achillea_MatchMode mode;
  bool ranked;
} Achillea_RankedPendingInvite;

typedef struct Achillea_RankedPlayerView {
  const char * user_id;
  const char * display_name;
  const char * avatar;
  double elo;
  double team;
  double my_score;
  double opp_score;
  bool started_match;
  bool submitted;
  bool proof_uploaded;
  bool confirmed_finish;
} Achillea_RankedPlayerView;

typedef struct Achillea_RankedProfile {
  const char * user_id;
  Achillea_MatchMode mode;
  double elo;
  double peak_rating;
  double games_played;
  double wins;
  double losses;
  achillea_json_t tier;
  achillea_json_t season_id;
  achillea_json_t global_rank;
  bool has_global_rank;
  double total_players;
  bool has_total_players;
  achillea_json_t percentile;
  bool has_percentile;
} Achillea_RankedProfile;

typedef struct Achillea_RankedProofUploaded {
  const char * url;
} Achillea_RankedProofUploaded;

typedef struct Achillea_RankedRematchOffer {
  const char * code;
  const char * from_user_id;
  const char * from_display_name;
  const char * from_avatar;
  double from_elo;
  Achillea_MatchMode mode;
  bool ranked;
  const char * url;
} Achillea_RankedRematchOffer;

typedef struct Achillea_RankedSeasonConfig {
  double k_factor;
  double base_rating;
  double decay_rate;
} Achillea_RankedSeasonConfig;

typedef struct Achillea_RankedSeasonInput {
  const char * name;
  const char * starts_at;
  const char * ends_at;
  Achillea_RankedSeasonConfig config;
} Achillea_RankedSeasonInput;

typedef struct Achillea_RankedSentInvite {
  const char * target_user_id;
  const char * target_display_name;
  Achillea_MatchMode mode;
  bool ranked;
} Achillea_RankedSentInvite;

typedef struct Achillea_RankedTierInfo {
  const char * key;
  double min_elo;
  double max_elo;
  achillea_str_slice_t gradient;
  achillea_json_t emoji_id;
  achillea_json_t emoji_key;
  double player_count;
} Achillea_RankedTierInfo;

typedef struct Achillea_RankedTrend {
  achillea_f64_slice_t sparkline;
  double delta_period;
  double games_in_period;
  double win_rate_period;
  double days;
} Achillea_RankedTrend;

typedef struct Achillea_RankTier {
  const char * key;
  double min_elo;
  double max_elo;
  const char * emoji_id;
  const char * emoji_key;
  achillea_str_slice_t gradient;
} Achillea_RankTier;

typedef struct Achillea_RealtimeTokenResponse {
  const char * token;
  double expires_in;
  const char * user_id;
} Achillea_RealtimeTokenResponse;

typedef struct Achillea_RestoreTournamentResult {
  bool success;
  const char * error;
  bool has_error;
  Achillea_TournamentState internal_state;
  bool has_internal_state;
} Achillea_RestoreTournamentResult;

typedef achillea_json_t Achillea_RoundRobinMode;

typedef struct Achillea_Sanction {
  const char * id;
  const char * user_id;
  const char * guild_id;
  Achillea_SanctionType type;
  achillea_json_t reason;
  achillea_json_t duration_sec;
  const char * issued_by;
  Achillea_SanctionIssuerType issued_by_type;
  achillea_json_t expires_at;
  achillea_json_t revoked_at;
  achillea_json_t revoked_by;
  achillea_json_t revoke_reason;
  achillea_json_t evidence;
  const char * created_at;
} Achillea_Sanction;

typedef struct Achillea_SanctionFilters {
  double page;
  bool has_page;
  double page_size;
  bool has_page_size;
  const char * user_id;
  bool has_user_id;
  const char * guild_id;
  bool has_guild_id;
  Achillea_SanctionType type;
  bool has_type;
  bool active;
  bool has_active;
} Achillea_SanctionFilters;

typedef Achillea_PagedList Achillea_SanctionListResponse;

typedef struct Achillea_ScorePolicyResult {
  bool success;
  Achillea_ScoreReportPolicy score_report_policy;
  const char * error;
  bool has_error;
} Achillea_ScorePolicyResult;

typedef achillea_json_t Achillea_SeasonState;

typedef struct Achillea_SeedBatchResult {
  const char * mode;
  bool bracket_updated;
  achillea_json_t assignments;
  bool has_assignments;
  double cleared;
  bool has_cleared;
} Achillea_SeedBatchResult;

typedef struct Achillea_SeedingResult {
  double participant_id;
  achillea_json_t seed;
  achillea_json_t previous_seed;
  achillea_json_t swapped_with;
  bool bracket_updated;
} Achillea_SeedingResult;

typedef achillea_json_t Achillea_SeedOrdering;

typedef Achillea_RankDTO Achillea_SessionRankDTO;

typedef achillea_json_t Achillea_SessionUserDTO;

typedef struct Achillea_SocialMediaDTO {
  Achillea_SocialMedia platform;
  const char * username;
  const char * canonical_url;
} Achillea_SocialMediaDTO;

typedef achillea_json_t Achillea_SortDirection;

typedef achillea_json_t Achillea_SortQuery;

typedef struct Achillea_StatsHub {
  achillea_json_t overview;
  achillea_json_t records;
  achillea_json_t players;
  achillea_json_t clans;
  achillea_json_t tournament_history;
  achillea_json_t tournaments;
} Achillea_StatsHub;

typedef struct Achillea_StatsHubClanEntry {
  double id;
  const char * name;
  const char * short_name;
  const char * avatar;
  double points;
  double players;
  double tournaments_played;
  double wins;
  double podiums;
  const char * tier;
  double goals_scored;
  double goals_conceded;
  double goal_average;
} Achillea_StatsHubClanEntry;

typedef struct Achillea_StatsHubPlayerEntry {
  const char * user_id;
  const char * display_name;
  const char * username;
  const char * avatar;
  achillea_json_t clan;
  double tournaments_played;
  double points;
  double tournaments;
  double wins;
  double podiums;
  double top4;
  double top8;
  double best_rank;
  const char * best_rank_label;
  const char * tier;
  double matches_played;
  double match_wins;
  double match_losses;
  double goals_scored;
  double goals_conceded;
  double goal_diff;
  double goal_average;
  double best_streak;
} Achillea_StatsHubPlayerEntry;

typedef struct Achillea_StatsHubRecord {
  double value;
  double tournament_id;
  const char * tournament_name;
  const char * detail;
} Achillea_StatsHubRecord;

typedef struct Achillea_StatsHubTournamentHistoryEntry {
  double id;
  const char * name;
  const char * grand_final_at;
  double size;
  double matches;
  double goals;
  achillea_json_t champion;
  achillea_json_t runner_up;
} Achillea_StatsHubTournamentHistoryEntry;

typedef struct Achillea_SuccessResponse {
  bool success;
  const char * error;
  bool has_error;
} Achillea_SuccessResponse;

typedef struct Achillea_Suggestion {
  const char * id;
  achillea_json_t type;
  const char * label;
  double sim;
  const char * clan_short_name;
  bool has_clan_short_name;
  const char * avatar;
  bool has_avatar;
  achillea_json_t solo_rank;
  achillea_json_t duo_rank;
  const char * last_interact;
  bool has_last_interact;
  Achillea_UserRole role;
  bool has_role;
  double current_level;
  bool has_current_level;
  double total_xp;
  bool has_total_xp;
  bool has_twitch;
  bool has_has_twitch;
  bool has_challonge;
  bool has_has_challonge;
  bool has_youtube;
  bool has_has_youtube;
} Achillea_Suggestion;

typedef Achillea_SessionRankDTO Achillea_SuggestionRank;

typedef struct Achillea_Tournament {
  double id;
  const char * name;
  const char * description;
  Achillea_EventTypeEnum type;
  const char * created_at;
  const char * updated_at;
  Achillea_TournamentState internal_state;
  const char * starts_at;
  const char * grand_final_at;
  achillea_json_t series;
  bool has_series;
  Achillea_OrganizationDTO organization;
  achillea_json_t managers;
  bool has_managers;
  achillea_json_t participants;
  bool has_participants;
  Achillea_StageType tournament_type;
  achillea_json_t participants_number;
  bool has_participants_number;
  achillea_json_t seed_ordering;
  bool has_seed_ordering;
  achillea_json_t match_format;
  bool has_match_format;
  achillea_json_t custom_format_child_count;
  bool has_custom_format_child_count;
  bool group_stage_enabled;
  achillea_json_t group_stage_type;
  bool has_group_stage_type;
  const char * logo;
  achillea_json_t affiche;
  bool has_affiche;
  const char * planning;
  const char * ruleset;
  bool placement_elo_applied;
  bool has_placement_elo_applied;
  achillea_json_t registration_opens_at;
  bool has_registration_opens_at;
  achillea_json_t registration_closes_at;
  bool has_registration_closes_at;
  bool auto_start;
  bool has_auto_start;
  bool discord_role_enabled;
  bool has_discord_role_enabled;
  Achillea_ScoreReportPolicy score_report_policy;
  bool has_score_report_policy;
  achillea_json_t discord_role_id;
  bool has_discord_role_id;
  achillea_json_t cancel_reason;
  bool has_cancel_reason;
  achillea_json_t canceled_at;
  bool has_canceled_at;
  achillea_json_t closed_at;
  bool has_closed_at;
} Achillea_Tournament;

typedef achillea_json_t Achillea_TournamentDetail;

typedef Achillea_ApiEnvelope Achillea_TournamentEnvelope;

typedef struct Achillea_TournamentEventActor {
  const char * id;
  const char * username;
  const char * display_name;
  const char * avatar;
} Achillea_TournamentEventActor;

typedef struct Achillea_TournamentEventDTO {
  const char * id;
  Achillea_TournamentEventType type;
  const char * created_at;
  achillea_json_t actor;
  achillea_json_t target;
  achillea_json_t payload;
  achillea_json_t reason;
} Achillea_TournamentEventDTO;

typedef struct Achillea_TournamentListItem {
  double id;
  const char * name;
  const char * description;
  const char * type;
  achillea_json_t status;
  const char * created_at;
  const char * updated_at;
} Achillea_TournamentListItem;

typedef struct Achillea_TournamentMatchStats {
  double matches;
  double total_goals;
  double avg_goals;
  double top_score;
  double min_margin;
  double max_margin;
  achillea_json_t biggest_blowout;
  achillea_json_t closest_match;
} Achillea_TournamentMatchStats;

typedef struct Achillea_TournamentMatchup {
  const char * winner_display_name;
  const char * winner_avatar;
  const char * loser_display_name;
  const char * loser_avatar;
  double score_winner;
  double score_loser;
} Achillea_TournamentMatchup;

typedef struct Achillea_TournamentSeries {
  double id;
  const char * name;
  const char * description;
  const char * logo;
  Achillea_OrganizationDTO organization;
  achillea_json_t tournaments;
} Achillea_TournamentSeries;

typedef struct Achillea_TournamentSummary {
  achillea_json_t top10;
  achillea_json_t stats;
} Achillea_TournamentSummary;

typedef struct Achillea_TournamentTop10Entry {
  double rank;
  const char * rank_label;
  const char * user_id;
  const char * display_name;
  const char * avatar;
  achillea_json_t clan;
  double points;
  const char * tier;
  double goals_scored;
  double goals_conceded;
  double goal_average;
} Achillea_TournamentTop10Entry;

typedef struct Achillea_UpdateClanPayload {
  const char * name;
  bool has_name;
  const char * shortened_name;
  bool has_shortened_name;
  const char * clan_biography;
  bool has_clan_biography;
  const char * clan_avatar_url;
  bool has_clan_avatar_url;
  achillea_json_t x_url;
  bool has_x_url;
  achillea_json_t instagram_url;
  bool has_instagram_url;
  achillea_json_t tiktok_url;
  bool has_tiktok_url;
  bool is_recruiting;
  bool has_is_recruiting;
  bool auto_accept_members;
  bool has_auto_accept_members;
  bool is_hidden;
  bool has_is_hidden;
  achillea_str_slice_t languages;
  bool has_languages;
  const char * origin;
  bool has_origin;
  bool is_inactive;
  bool has_is_inactive;
} Achillea_UpdateClanPayload;

typedef struct Achillea_UpdateUserProfilePayload {
  achillea_json_t bio;
  bool has_bio;
  achillea_json_t twitch_url;
  bool has_twitch_url;
} Achillea_UpdateUserProfilePayload;

typedef struct Achillea_UploadedImage {
  const char * id;
  const char * url;
} Achillea_UploadedImage;

typedef struct Achillea_User {
  const char * id;
  const char * name;
  Achillea_Rank rank;
  const char * logo;
} Achillea_User;

typedef struct Achillea_UserClanSummary {
  double id;
  const char * shortened_name;
  const char * name;
  const char * avatar_url;
  bool has_avatar_url;
  Achillea_ClanMemberRole role;
  achillea_json_t distinctions;
} Achillea_UserClanSummary;

typedef struct Achillea_UserDTO {
  const char * id;
  const char * type;
  bool has_type;
  const char * username;
  const char * rg_profile_username;
  bool has_rg_profile_username;
  double sim;
  bool has_sim;
  const char * avatar;
  bool has_avatar;
  achillea_json_t clan_id;
  bool has_clan_id;
  Achillea_RankDTO solo_rank;
  bool has_solo_rank;
  Achillea_RankDTO duo_rank;
  bool has_duo_rank;
  const char * last_interact;
  bool has_last_interact;
  Achillea_UserRole role;
  bool has_role;
  double current_level;
  bool has_current_level;
  double total_xp;
  bool has_total_xp;
  bool has_twitch;
  bool has_has_twitch;
  bool has_challonge;
  bool has_has_challonge;
  bool has_youtube;
  bool has_has_youtube;
} Achillea_UserDTO;

typedef struct Achillea_UserRef {
  const char * id;
  const char * username;
  const char * display_name;
  bool has_display_name;
  achillea_json_t avatar;
  bool has_avatar;
} Achillea_UserRef;

typedef struct Achillea_UsersAndGuildsResponse {
  achillea_json_t active_users;
  achillea_json_t users;
  achillea_json_t guilds;
} Achillea_UsersAndGuildsResponse;

typedef struct Achillea_WalletBalance {
  double balance;
  const char * currency;
} Achillea_WalletBalance;

typedef struct Achillea_WalletHistoryPage {
  achillea_json_t transactions;
  double total;
  bool has_total;
} Achillea_WalletHistoryPage;

typedef struct Achillea_WalletTransaction {
  const char * id;
  Achillea_WalletTransactionType type;
  double amount;
  achillea_json_t reason;
  Achillea_WalletTransactionDirection direction;
  const char * created_at;
} Achillea_WalletTransaction;

typedef struct Achillea_WireParticipant {
  double id;
  Achillea_UserDTO user;
  achillea_json_t bracket_participant_id;
  bool has_bracket_participant_id;
  achillea_json_t seed;
  bool has_seed;
  bool has_checked_in;
  Achillea_ParticipantStatus status;
  bool has_status;
  const char * registered_at;
  bool has_registered_at;
  achillea_json_t waitlist_position;
  bool has_waitlist_position;
  achillea_json_t status_reason;
  bool has_status_reason;
  Achillea_EntityRef tournament;
} Achillea_WireParticipant;

typedef struct Achillea_WireTournament {
  double id;
  const char * name;
  const char * description;
  Achillea_EventTypeEnum type;
  const char * created_at;
  const char * updated_at;
  Achillea_TournamentState internal_state;
  const char * starts_at;
  const char * grand_final_at;
  Achillea_StageType tournament_type;
  achillea_json_t participants_number;
  bool has_participants_number;
  achillea_json_t seed_ordering;
  bool has_seed_ordering;
  achillea_json_t match_format;
  bool has_match_format;
  achillea_json_t custom_format_child_count;
  bool has_custom_format_child_count;
  bool group_stage_enabled;
  achillea_json_t group_stage_type;
  bool has_group_stage_type;
  const char * logo;
  achillea_json_t affiche;
  bool has_affiche;
  const char * planning;
  const char * ruleset;
  bool placement_elo_applied;
  bool has_placement_elo_applied;
  achillea_json_t registration_opens_at;
  bool has_registration_opens_at;
  achillea_json_t registration_closes_at;
  bool has_registration_closes_at;
  bool auto_start;
  bool has_auto_start;
  bool discord_role_enabled;
  bool has_discord_role_enabled;
  Achillea_ScoreReportPolicy score_report_policy;
  bool has_score_report_policy;
  achillea_json_t discord_role_id;
  bool has_discord_role_id;
  achillea_json_t cancel_reason;
  bool has_cancel_reason;
  achillea_json_t canceled_at;
  bool has_canceled_at;
  achillea_json_t closed_at;
  bool has_closed_at;
  achillea_json_t series;
  bool has_series;
  Achillea_EntityRef organization;
  achillea_json_t managers;
  bool has_managers;
  achillea_json_t participants;
  bool has_participants;
} Achillea_WireTournament;

typedef struct Achillea_WireTournamentSeries {
  double id;
  const char * name;
  const char * description;
  const char * logo;
  Achillea_EntityRef organization;
  achillea_json_t tournaments;
  bool has_tournaments;
} Achillea_WireTournamentSeries;

#ifdef __cplusplus
}
#endif
