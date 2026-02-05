// User and Auth types
export interface User {
  id: string;
  email: string;
  role?: "admin" | "user";
  created_at: string;
}

// Content Session types
export type SessionStatus =
  | "brain_dump"
  | "research"
  | "outline"
  | "draft"
  | "review"
  | "outputs"
  | "completed";

export interface ContentSession {
  id: string;
  user_id: string;
  status: SessionStatus;
  title?: string;
  created_at: string;
  updated_at: string;
}

export interface BrainDump {
  id: string;
  session_id: string;
  raw_content: string;
  extracted_themes?: ExtractedThemes;
  created_at: string;
}

export interface ExtractedThemes {
  themes: string[];
  topics: string[];
  potential_angles: string[];
  key_points: string[];
}

export interface ContentResearch {
  id: string;
  session_id: string;
  query: string;
  response: string;
  sources: ResearchSource[];
  created_at: string;
}

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ContentOutline {
  id: string;
  session_id: string;
  outline_json: OutlineData;
  selected: boolean;
  user_feedback?: string;
  created_at: string;
}

export interface OutlineData {
  title: string;
  summary: string;
  sections: OutlineSection[];
  estimated_word_count?: number;
}

export interface OutlineSection {
  heading: string;
  key_points: string[];
  suggested_sources?: string[];
}

export interface ContentDraft {
  id: string;
  session_id: string;
  content: string;
  voice_score?: VoiceScore;
  version: number;
  created_at: string;
}

export interface VoiceScore {
  overall: number;
  profanity_count: number;
  corporate_speak_warnings: string[];
  rhythm_analysis?: string;
}

export interface ContentOutput {
  id: string;
  session_id: string;
  output_type: OutputType;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export type OutputType =
  | "substack_post"
  | "substack_image"
  | "youtube_script"
  | "youtube_description"
  | "youtube_thumbnail"
  | "tiktok_15s"
  | "tiktok_30s"
  | "tiktok_60s"
  | "shorts_script"
  | "reels_script";

// Prompt Management types
export type PromptStatus = "draft" | "active" | "archived";

export interface PromptSet {
  id: string;
  slug: string;
  name: string;
  prompt_type: string;
  description?: string;
  current_version_id?: string;
  created_at: string;
}

export interface PromptVersion {
  id: string;
  prompt_set_id: string;
  version: number;
  prompt_content: string;
  model_id?: string;
  api_config: ApiConfig;
  status: PromptStatus;
  created_at: string;
}

export interface ApiConfig {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface AIModel {
  id: string;
  model_id: string;
  provider: string;
  display_name: string;
  context_window?: number;
  is_available: boolean;
  created_at: string;
}

// AI Call Logging
export interface AICallLog {
  id: string;
  session_id?: string;
  prompt_set_slug: string;
  full_prompt: string;
  full_response: string;
  model_id: string;
  tokens_in?: number;
  tokens_out?: number;
  duration_ms?: number;
  created_at: string;
}

// Imported Posts
export interface ImportedPost {
  id: string;
  source: "jon" | "nate" | string;
  external_id?: string;
  title: string;
  content: string;
  author: string;
  published_at?: string;
  url?: string;
  created_at: string;
}

export interface SyncManifest {
  id: string;
  source: string;
  last_sync_at: string;
  post_count: number;
  status: "idle" | "syncing" | "error";
  error_message?: string;
}

// Voice Guidelines
export interface VoiceGuidelines {
  id: string;
  name: string;
  content: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Pinecone Namespace Management
export type NamespaceSourceType = "newsletter" | "documentation" | "research" | "ideas";

export interface PineconeNamespace {
  id: string;
  slug: string;
  display_name: string;
  description?: string;
  source_type?: NamespaceSourceType;
  is_active: boolean;
  is_searchable: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PineconeNamespaceInsert {
  slug: string;
  display_name: string;
  description?: string;
  source_type?: NamespaceSourceType;
  is_active?: boolean;
  is_searchable?: boolean;
  sort_order?: number;
}

export interface PineconeNamespaceUpdate {
  slug?: string;
  display_name?: string;
  description?: string;
  source_type?: NamespaceSourceType;
  is_active?: boolean;
  is_searchable?: boolean;
  sort_order?: number;
}

// ============================================================================
// Partner API Types
// ============================================================================

// Invite status
export type PartnerInviteStatus = "pending" | "redeemed" | "expired" | "revoked";

export interface PartnerInvite {
  id: string;
  code: string;
  email: string;
  created_by: string;
  expires_at: string;
  redeemed_at?: string;
  redeemed_by?: string;
  status: PartnerInviteStatus;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PartnerInviteInsert {
  code: string;
  email: string;
  created_by: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

// Partner status
export type PartnerStatus = "active" | "suspended" | "revoked";

export interface Partner {
  id: string;
  user_id: string;
  organization_name: string;
  contact_email: string;
  status: PartnerStatus;
  rate_limit_per_minute: number;
  rate_limit_per_day: number;
  invite_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PartnerInsert {
  user_id: string;
  organization_name: string;
  contact_email: string;
  status?: PartnerStatus;
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  invite_id?: string;
  metadata?: Record<string, unknown>;
}

export interface PartnerUpdate {
  organization_name?: string;
  contact_email?: string;
  status?: PartnerStatus;
  rate_limit_per_minute?: number;
  rate_limit_per_day?: number;
  metadata?: Record<string, unknown>;
}

// Namespace permissions
export interface PartnerNamespacePermission {
  id: string;
  partner_id: string;
  namespace_id: string;
  can_read: boolean;
  can_write: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerNamespacePermissionWithNamespace
  extends PartnerNamespacePermission {
  pinecone_namespaces: PineconeNamespace;
}

// API Key status
export type ApiKeyStatus = "active" | "revoked";

export interface PartnerApiKey {
  id: string;
  partner_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  last_used_at?: string;
  status: ApiKeyStatus;
  expires_at?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PartnerApiKeyInsert {
  partner_id: string;
  key_hash: string;
  key_prefix: string;
  name: string;
  expires_at?: string;
  metadata?: Record<string, unknown>;
}

// API Usage logging
export interface PartnerApiUsage {
  id: string;
  api_key_id: string;
  partner_id: string;
  endpoint: string;
  method: string;
  namespace_slug?: string;
  query_params?: Record<string, unknown>;
  status_code: number;
  response_time_ms?: number;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface PartnerApiUsageInsert {
  api_key_id: string;
  partner_id: string;
  endpoint: string;
  method: string;
  namespace_slug?: string;
  query_params?: Record<string, unknown>;
  status_code: number;
  response_time_ms?: number;
  error_message?: string;
  ip_address?: string;
  user_agent?: string;
}

// API response types
export interface PartnerAuthContext {
  partner: Partner;
  apiKey: PartnerApiKey;
  permissions: PartnerNamespacePermissionWithNamespace[];
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
  dailyLimit: number;
  dailyRemaining: number;
  dailyResetAt: string;
}

export interface PartnerSearchRequest {
  query: string;
  namespaces?: string[];
  topK?: number;
}

export interface PartnerSearchResponse {
  results: SearchResult[];
  query: string;
  namespaces: string[];
  count: number;
  rateLimit: RateLimitInfo;
}

export interface SearchResult {
  id: string;
  score: number;
  title?: string;
  content?: string;
  source?: string;
  url?: string;
  metadata?: Record<string, unknown>;
}

export interface PartnerNamespaceResponse {
  slug: string;
  display_name: string;
  description?: string;
  source_type?: NamespaceSourceType;
  can_read: boolean;
  can_write: boolean;
}

// ============================================================================
// Ideas Capture Types
// ============================================================================

// Idea source types
export type IdeaSourceType =
  | "slack"
  | "recording"
  | "manual"
  | "x_share"
  | "granola"
  | "substack";

// Idea type classification
export type IdeaType =
  | "observation"
  | "question"
  | "concept"
  | "reference"
  | "todo";

// Idea status in the pipeline
export type IdeaStatus = "backlog" | "in_progress" | "drafted" | "archived";

// Idea Cluster - semantic grouping of related ideas
export interface IdeaCluster {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  representative_embedding?: string;
  is_active: boolean;
  idea_count: number;
  created_at: string;
  updated_at: string;
}

export interface IdeaClusterInsert {
  user_id: string;
  name: string;
  description?: string;
  representative_embedding?: string;
  is_active?: boolean;
  idea_count?: number;
}

export interface IdeaClusterUpdate {
  name?: string;
  description?: string;
  representative_embedding?: string;
  is_active?: boolean;
  idea_count?: number;
}

// Slack Idea - captured idea from any source
export interface SlackIdea {
  id: string;
  user_id: string;
  raw_content: string;
  source_type: IdeaSourceType;
  source_url?: string;

  // Slack-specific
  slack_message_id?: string;
  slack_channel_id?: string;
  slack_timestamp?: string;
  slack_user_id?: string;

  // Recording linkage
  recording_id?: string;

  // AI-generated
  summary?: string;
  extracted_topics: string[];
  idea_type?: IdeaType;
  potential_angles: string[];
  embedding_id?: string;

  // Clustering
  cluster_id?: string;
  cluster_confidence?: number;
  cluster?: IdeaCluster;

  // Status
  status: IdeaStatus;
  content_session_id?: string;

  // Pinecone indexing
  pinecone_indexed: boolean;
  pinecone_indexed_at?: string;
  pinecone_error?: string;

  // Timestamps
  captured_at: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SlackIdeaInsert {
  user_id: string;
  raw_content: string;
  source_type: IdeaSourceType;
  source_url?: string;
  slack_message_id?: string;
  slack_channel_id?: string;
  slack_timestamp?: string;
  slack_user_id?: string;
  recording_id?: string;
  status?: IdeaStatus;
  captured_at?: string;
}

export interface SlackIdeaUpdate {
  raw_content?: string;
  summary?: string;
  extracted_topics?: string[];
  idea_type?: IdeaType;
  potential_angles?: string[];
  embedding_id?: string;
  cluster_id?: string;
  cluster_confidence?: number;
  status?: IdeaStatus;
  content_session_id?: string;
  pinecone_indexed?: boolean;
  pinecone_indexed_at?: string;
  pinecone_error?: string;
  processed_at?: string;
}

// AI Processing result for ideas
export interface IdeaSummaryResult {
  summary: string;
  topics: string[];
  type: IdeaType;
  potential_angles: string[];
}

// Cluster naming result
export interface ClusterNameResult {
  name: string;
  description: string;
}

// Slack Integration Config
export type SlackSyncStatus = "idle" | "syncing" | "error";

export interface SlackIntegrationConfig {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  bot_user_id?: string;
  team_id: string;
  team_name?: string;
  channel_id: string;
  channel_name: string;
  last_sync_at?: string;
  last_message_ts?: string;
  sync_status: SlackSyncStatus;
  sync_error?: string;
  messages_synced: number;
  is_active: boolean;
  sync_frequency_minutes: number;
  auto_process: boolean;
  created_at: string;
  updated_at: string;
}

export interface SlackIntegrationConfigInsert {
  user_id: string;
  access_token: string;
  refresh_token?: string;
  token_expires_at?: string;
  bot_user_id?: string;
  team_id: string;
  team_name?: string;
  channel_id: string;
  channel_name?: string;
  is_active?: boolean;
  sync_frequency_minutes?: number;
  auto_process?: boolean;
}

export interface SlackIntegrationConfigUpdate {
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  channel_id?: string;
  channel_name?: string;
  last_sync_at?: string;
  last_message_ts?: string;
  sync_status?: SlackSyncStatus;
  sync_error?: string;
  messages_synced?: number;
  is_active?: boolean;
  sync_frequency_minutes?: number;
  auto_process?: boolean;
}

// Idea vector metadata for Pinecone
export interface IdeaVectorMetadata {
  idea_id: string;
  user_id: string;
  summary: string;
  topics: string[];
  source_type: IdeaSourceType;
  cluster_id?: string;
  created_at: string;
  content_preview: string;
  [key: string]: string | string[] | undefined; // Index signature for Pinecone
}

// ============================================================================
// Content Calendar & Project Management Types
// ============================================================================

// Project status workflow
export type ProjectStatus = "draft" | "review" | "scheduled" | "published";

// Asset status
export type AssetStatus = "draft" | "ready" | "final";

// Asset type classification
export type AssetType =
  | "post"
  | "transcript_youtube"
  | "transcript_tiktok"
  | "description_youtube"
  | "description_tiktok"
  | "prompts"
  | "guide"
  | "post_linkedin"
  | "post_substack"
  | "image_substack";

// Content Project - main project entity
export interface ContentProject {
  id: string;
  project_id: string; // yyyymmdd_xxx format
  title: string;
  scheduled_date: string | null;
  status: ProjectStatus;
  target_platforms: string[];
  notes: string | null;
  video_runtime: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Content Project with summary from related assets (for calendar view)
export interface ContentProjectWithSummary extends ContentProject {
  content_summary?: string | null;
}

export interface ContentProjectInsert {
  project_id: string;
  title: string;
  scheduled_date?: string | null;
  status?: ProjectStatus;
  target_platforms?: string[];
  notes?: string | null;
  video_runtime?: string | null;
  created_by: string;
}

export interface ContentProjectUpdate {
  project_id?: string;
  title?: string;
  scheduled_date?: string | null;
  status?: ProjectStatus;
  target_platforms?: string[];
  notes?: string | null;
  video_runtime?: string | null;
}

// Project Asset - individual content pieces within a project
export interface ProjectAsset {
  id: string;
  project_id: string;
  asset_type: AssetType | string;
  title: string | null;
  content: string | null;
  current_version: number;
  status: AssetStatus;
  external_url: string | null;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectAssetInsert {
  project_id: string;
  asset_type: AssetType | string;
  title?: string | null;
  content?: string | null;
  status?: AssetStatus;
  external_url?: string | null;
}

export interface ProjectAssetUpdate {
  asset_type?: AssetType | string;
  title?: string | null;
  content?: string | null;
  current_version?: number;
  status?: AssetStatus;
  external_url?: string | null;
  locked_by?: string | null;
  locked_at?: string | null;
}

// Asset Version - version history for assets
export interface AssetVersion {
  id: string;
  asset_id: string;
  version_number: number;
  content: string;
  created_by: string;
  created_at: string;
}

export interface AssetVersionInsert {
  asset_id: string;
  version_number: number;
  content: string;
  created_by: string;
}

// Project Publication - track where/when content was published
export interface ProjectPublication {
  id: string;
  project_id: string;
  destination_id: string | null;
  platform: string;
  published_at: string;
  published_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProjectPublicationInsert {
  project_id: string;
  destination_id?: string | null;
  platform: string;
  published_at: string;
  published_url?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ProjectPublicationUpdate {
  destination_id?: string | null;
  platform?: string;
  published_at?: string;
  published_url?: string | null;
  metadata?: Record<string, unknown>;
}

// Lock status for edit locking
export interface LockStatus {
  isLocked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  isLockedByCurrentUser: boolean;
}

// ============================================================================
// Content Routing System Types
// ============================================================================

// Publication types
export type PublicationType = "newsletter" | "video";

export interface Publication {
  id: string;
  slug: string;
  name: string;
  description?: string;
  publication_type: PublicationType;
  destination_id?: string;
  unified_with?: string;
  weekly_target: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PublicationInsert {
  slug: string;
  name: string;
  description?: string;
  publication_type: PublicationType;
  destination_id?: string;
  unified_with?: string;
  weekly_target?: number;
  is_active?: boolean;
  sort_order?: number;
}

export interface PublicationUpdate {
  slug?: string;
  name?: string;
  description?: string;
  publication_type?: PublicationType;
  destination_id?: string;
  unified_with?: string | null;
  weekly_target?: number;
  is_active?: boolean;
  sort_order?: number;
}

// Publication with unified publication data (for joins)
export interface PublicationWithUnified extends Publication {
  unified_publication?: Publication;
}

// Calendar Slot types
export interface CalendarSlot {
  id: string;
  publication_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  is_fixed: boolean;
  fixed_format?: string;
  fixed_format_name?: string;
  preferred_tier?: string;
  tier_priority: number;
  skip_rules: SkipRule[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SkipRule {
  type: "date_range" | "specific_date";
  start?: string; // MM-DD format
  end?: string; // MM-DD format
  date?: string; // MM-DD format for specific_date
  reason?: string;
}

export interface CalendarSlotInsert {
  publication_id: string;
  day_of_week: number;
  is_fixed?: boolean;
  fixed_format?: string;
  fixed_format_name?: string;
  preferred_tier?: string;
  tier_priority?: number;
  skip_rules?: SkipRule[];
  is_active?: boolean;
}

export interface CalendarSlotUpdate {
  day_of_week?: number;
  is_fixed?: boolean;
  fixed_format?: string | null;
  fixed_format_name?: string | null;
  preferred_tier?: string | null;
  tier_priority?: number;
  skip_rules?: SkipRule[];
  is_active?: boolean;
}

// Calendar Slot with publication (for joins)
export interface CalendarSlotWithPublication extends CalendarSlot {
  publication: Publication;
}

// Scoring Rubric types
export interface ScoringCriterion {
  score: number;
  description: string;
  example?: string;
  elements?: string[]; // For CTR potential rubric
}

export interface ScoringModifier {
  condition: string;
  modifier: number;
  description?: string;
}

export interface ScoringRubric {
  id: string;
  publication_id: string;
  slug: string;
  name: string;
  description?: string;
  weight: number;
  criteria: ScoringCriterion[];
  is_modifier: boolean;
  baseline_score: number;
  modifiers?: ScoringModifier[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ScoringRubricInsert {
  publication_id: string;
  slug: string;
  name: string;
  description?: string;
  weight: number;
  criteria: ScoringCriterion[];
  is_modifier?: boolean;
  baseline_score?: number;
  modifiers?: ScoringModifier[];
  sort_order?: number;
  is_active?: boolean;
}

export interface ScoringRubricUpdate {
  slug?: string;
  name?: string;
  description?: string;
  weight?: number;
  criteria?: ScoringCriterion[];
  is_modifier?: boolean;
  baseline_score?: number;
  modifiers?: ScoringModifier[];
  sort_order?: number;
  is_active?: boolean;
}

// Scoring Rubric with publication (for joins)
export interface ScoringRubricWithPublication extends ScoringRubric {
  publication: Publication;
}

// Routing Rule types
export type RoutingConditionOperator = "=" | "!=" | ">" | "<" | ">=" | "<=";

export interface RoutingCondition {
  field?: string;
  op?: RoutingConditionOperator;
  value?: unknown;
  and?: RoutingCondition[];
  or?: RoutingCondition[];
  always?: boolean;
}

export type RoutingDestination = "core" | "beginner" | "both";
export type YouTubeVersion = "yes" | "no" | "tbd";

export interface RoutingRule {
  id: string;
  name: string;
  description?: string;
  conditions: RoutingCondition;
  routes_to: RoutingDestination;
  youtube_version: YouTubeVersion;
  priority: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoutingRuleInsert {
  name: string;
  description?: string;
  conditions: RoutingCondition;
  routes_to: RoutingDestination;
  youtube_version?: YouTubeVersion;
  priority?: number;
  is_active?: boolean;
}

export interface RoutingRuleUpdate {
  name?: string;
  description?: string;
  conditions?: RoutingCondition;
  routes_to?: RoutingDestination;
  youtube_version?: YouTubeVersion;
  priority?: number;
  is_active?: boolean;
}

// Tier types
export type TierSlug = "premium_a" | "a" | "b" | "c" | "kill";

export interface TierActions {
  stagger_youtube_day?: number;
  stagger_substack_day?: number;
  priority_scheduling?: boolean;
  rework_recommended?: boolean;
  experimental?: boolean;
  do_not_produce?: boolean;
  archive?: boolean;
  requires_rethink?: boolean;
}

export interface TierThreshold {
  id: string;
  tier: TierSlug;
  display_name: string;
  description?: string;
  min_score: number;
  max_score?: number;
  auto_stagger: boolean;
  preferred_days: number[];
  actions: TierActions;
  color?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TierThresholdInsert {
  tier: TierSlug;
  display_name: string;
  description?: string;
  min_score: number;
  max_score?: number;
  auto_stagger?: boolean;
  preferred_days?: number[];
  actions?: TierActions;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

export interface TierThresholdUpdate {
  tier?: TierSlug;
  display_name?: string;
  description?: string;
  min_score?: number;
  max_score?: number | null;
  auto_stagger?: boolean;
  preferred_days?: number[];
  actions?: TierActions;
  color?: string;
  icon?: string;
  sort_order?: number;
  is_active?: boolean;
}

// Idea Routing types (linking table)
export type RoutingAudience = "beginner" | "intermediate" | "executive";
export type TimeSensitivity = "evergreen" | "news_hook" | "launch_tie" | "seasonal";
export type ResourceType = "prompts" | "template" | "guide" | "framework" | "toolkit" | "none";
export type EstimatedLength = "short" | "medium" | "long";
export type IdeaRoutingStatus = "intake" | "routed" | "scored" | "slotted" | "scheduled" | "published" | "killed";

export interface IdeaRoutingScores {
  [publicationSlug: string]: number | null;
}

export interface IdeaRouting {
  id: string;
  idea_id: string;
  user_id: string;

  // Intake fields
  audience?: RoutingAudience;
  action?: string;
  time_sensitivity: TimeSensitivity;
  news_window?: string;
  resource?: ResourceType;
  angle?: string;
  estimated_length?: EstimatedLength;

  // Helper flags for routing
  can_frame_as_complete_guide: boolean;
  can_frame_as_zero_to_hero: boolean;
  is_foundational: boolean;
  would_bore_paid_subs: boolean;
  requires_tool_familiarity: boolean;
  has_contrarian_angle: boolean;
  is_technical_implementation: boolean;
  could_serve_both_audiences: boolean;

  // Routing outputs
  routed_to?: RoutingDestination;
  youtube_version: YouTubeVersion;
  matched_rule_id?: string;

  // Scoring
  scores?: IdeaRoutingScores;
  tier?: TierSlug;

  // Scheduling
  recommended_slot?: string;
  slot_id?: string;
  calendar_date?: string;
  is_staggered: boolean;
  stagger_youtube_date?: string;
  stagger_substack_date?: string;

  // Status
  status: IdeaRoutingStatus;

  // Overrides
  override_routing?: RoutingDestination;
  override_score?: number;
  override_slot?: string;
  override_reason?: string;

  // Notes
  notes?: string;

  // Timestamps
  routed_at?: string;
  scored_at?: string;
  slotted_at?: string;
  scheduled_at?: string;
  published_at?: string;
  killed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IdeaRoutingInsert {
  idea_id: string;
  user_id: string;
  audience?: RoutingAudience;
  action?: string;
  time_sensitivity?: TimeSensitivity;
  news_window?: string;
  resource?: ResourceType;
  angle?: string;
  estimated_length?: EstimatedLength;
  can_frame_as_complete_guide?: boolean;
  can_frame_as_zero_to_hero?: boolean;
  is_foundational?: boolean;
  would_bore_paid_subs?: boolean;
  requires_tool_familiarity?: boolean;
  has_contrarian_angle?: boolean;
  is_technical_implementation?: boolean;
  could_serve_both_audiences?: boolean;
  status?: IdeaRoutingStatus;
  notes?: string;
}

export interface IdeaRoutingUpdate {
  audience?: RoutingAudience;
  action?: string;
  time_sensitivity?: TimeSensitivity;
  news_window?: string | null;
  resource?: ResourceType;
  angle?: string;
  estimated_length?: EstimatedLength;
  can_frame_as_complete_guide?: boolean;
  can_frame_as_zero_to_hero?: boolean;
  is_foundational?: boolean;
  would_bore_paid_subs?: boolean;
  requires_tool_familiarity?: boolean;
  has_contrarian_angle?: boolean;
  is_technical_implementation?: boolean;
  could_serve_both_audiences?: boolean;
  routed_to?: RoutingDestination;
  youtube_version?: YouTubeVersion;
  matched_rule_id?: string | null;
  scores?: IdeaRoutingScores;
  tier?: TierSlug;
  recommended_slot?: string;
  slot_id?: string | null;
  calendar_date?: string | null;
  is_staggered?: boolean;
  stagger_youtube_date?: string | null;
  stagger_substack_date?: string | null;
  status?: IdeaRoutingStatus;
  override_routing?: RoutingDestination | null;
  override_score?: number | null;
  override_slot?: string | null;
  override_reason?: string | null;
  notes?: string;
  routed_at?: string | null;
  scored_at?: string | null;
  slotted_at?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  killed_at?: string | null;
}

// Idea Routing with joined data
export interface IdeaRoutingWithIdea extends IdeaRouting {
  slack_idea: SlackIdea;
}

export interface IdeaRoutingWithAll extends IdeaRouting {
  slack_idea: SlackIdea;
  matched_rule?: RoutingRule;
  slot?: CalendarSlot;
}

// Project Routing types (linking table)
export interface ProjectRouting {
  id: string;
  project_id: string;
  idea_routing_id?: string;

  // Scoring
  scores?: IdeaRoutingScores;
  tier?: TierSlug;

  // Scheduling
  slot_id?: string;
  is_staggered: boolean;
  stagger_youtube_date?: string;
  stagger_substack_date?: string;

  // Bumping
  original_date?: string;
  bump_reason?: string;
  bumped_at?: string;
  bumped_by?: string;
  bump_count: number;

  // Publication tracking
  published_platforms: string[];

  // Timestamps
  created_at: string;
  updated_at: string;
}

export interface ProjectRoutingInsert {
  project_id: string;
  idea_routing_id?: string;
  scores?: IdeaRoutingScores;
  tier?: TierSlug;
  slot_id?: string;
  is_staggered?: boolean;
  stagger_youtube_date?: string;
  stagger_substack_date?: string;
}

export interface ProjectRoutingUpdate {
  idea_routing_id?: string | null;
  scores?: IdeaRoutingScores;
  tier?: TierSlug;
  slot_id?: string | null;
  is_staggered?: boolean;
  stagger_youtube_date?: string | null;
  stagger_substack_date?: string | null;
  original_date?: string | null;
  bump_reason?: string | null;
  bumped_at?: string | null;
  bumped_by?: string | null;
  bump_count?: number;
  published_platforms?: string[];
}

// Project Routing with joined data
export interface ProjectRoutingWithProject extends ProjectRouting {
  project: ContentProject;
}

export interface ProjectRoutingWithAll extends ProjectRouting {
  project: ContentProject;
  idea_routing?: IdeaRouting;
  slot?: CalendarSlot;
}

// Evergreen Queue types
export interface EvergreenQueueEntry {
  id: string;
  publication_id: string;
  idea_routing_id?: string;
  project_routing_id?: string;

  score: number;
  tier: TierSlug;

  added_at: string;
  staleness_check_at?: string;
  is_stale: boolean;
  stale_reason?: string;

  pulled_at?: string;
  pulled_for_date?: string;
  pulled_reason?: string;

  created_at: string;
  updated_at: string;
}

export interface EvergreenQueueInsert {
  publication_id: string;
  idea_routing_id?: string;
  project_routing_id?: string;
  score: number;
  tier: TierSlug;
}

export interface EvergreenQueueUpdate {
  staleness_check_at?: string | null;
  is_stale?: boolean;
  stale_reason?: string | null;
  pulled_at?: string | null;
  pulled_for_date?: string | null;
  pulled_reason?: string | null;
}

// Evergreen Queue with joined data
export interface EvergreenQueueWithDetails extends EvergreenQueueEntry {
  publication: Publication;
  idea_routing?: IdeaRoutingWithIdea;
  project_routing?: ProjectRoutingWithProject;
}

// Routing Status Log types
export interface RoutingStatusLog {
  id: string;
  idea_routing_id?: string;
  project_routing_id?: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  change_reason?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface RoutingStatusLogInsert {
  idea_routing_id?: string;
  project_routing_id?: string;
  from_status?: string;
  to_status: string;
  changed_by?: string;
  change_reason?: string;
  metadata?: Record<string, unknown>;
}

// Dashboard and reporting types
export interface RoutingDashboardStats {
  ideas_by_status: Record<IdeaRoutingStatus, number>;
  ideas_by_tier: Record<TierSlug, number>;
  evergreen_queue_counts: Record<string, number>; // by publication slug
  scheduled_this_week: number;
  alerts: RoutingAlert[];
}

export interface RoutingAlert {
  type: "time_sensitive" | "low_buffer" | "slot_conflict" | "duplicate_topic";
  severity: "red" | "yellow";
  message: string;
  publication_slug?: string;
  idea_routing_id?: string;
  metadata?: Record<string, unknown>;
}

// Scoring calculation types
export interface ScoreBreakdown {
  publication_slug: string;
  total_score: number;
  rubric_scores: {
    rubric_slug: string;
    rubric_name: string;
    raw_score: number;
    weight: number;
    weighted_score: number;
  }[];
  tier: TierSlug;
}

export interface RoutingResult {
  routed_to: RoutingDestination;
  youtube_version: YouTubeVersion;
  matched_rule: RoutingRule;
}
