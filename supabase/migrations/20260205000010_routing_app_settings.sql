-- Routing App Settings: Configurable values for the routing system
-- Part of Content Routing System (isolated architecture)

-- Add routing-related settings to app_settings table
-- All of these are configurable via Studio UI

INSERT INTO app_settings (category, key, value, description) VALUES

-- ============================================
-- SCORING WEIGHTS (defaults, all editable)
-- ============================================

('scoring', 'core_substack_weights', 
 '{"actionability": 0.5, "depth": 0.3, "timing": 0.2}',
 'Weight distribution for Core Substack scoring rubrics'),

('scoring', 'youtube_weights', 
 '{"ctr_potential": 0.5, "length": 0.25, "timing": 0.25}',
 'Weight distribution for YouTube scoring rubrics'),

('scoring', 'beginner_weights', 
 '{"accessibility": 0.5, "completeness": 0.3, "resource_density": 0.2}',
 'Weight distribution for Beginner Substack scoring rubrics'),

-- ============================================
-- PREMIUM STAGGER CONFIGURATION
-- ============================================

('routing', 'premium_stagger_youtube_day', 
 '{"value": 5}',
 'Day of week for YouTube in premium stagger (0=Sun, 5=Fri)'),

('routing', 'premium_stagger_substack_day', 
 '{"value": 1}',
 'Day of week for Substack in premium stagger (0=Sun, 1=Mon)'),

('routing', 'premium_manual_elevations_per_month', 
 '{"value": 2}',
 'Maximum manual elevations to premium tier per month'),

('routing', 'premium_elevation_min_score', 
 '{"value": 8.5}',
 'Minimum score required for manual premium elevation'),

-- ============================================
-- CALENDAR RULES
-- ============================================

('calendar', 'allow_same_day_bump', 
 '{"value": false}',
 'Whether content scheduled for today can be bumped'),

('calendar', 'holiday_blackout_dates', 
 '{"value": ["12-20", "12-21", "12-22", "12-23", "12-24", "12-25", "12-26", "12-27", "12-28", "12-29", "12-30", "12-31", "01-01", "01-02"]}',
 'Dates to skip for scheduling (MM-DD format)'),

('calendar', 'duplicate_topic_window_days', 
 '{"value": 14}',
 'Days within which same topic should not be scheduled'),

-- ============================================
-- BUFFER ALERTS
-- ============================================

('routing', 'evergreen_buffer_yellow_weeks', 
 '{"value": 2}',
 'Weeks of evergreen buffer before yellow alert'),

('routing', 'evergreen_buffer_red_weeks', 
 '{"value": 1}',
 'Weeks of evergreen buffer before red alert'),

('routing', 'staleness_check_days', 
 '{"value": 30}',
 'Days before evergreen content is checked for staleness'),

-- ============================================
-- TIMING MODIFIERS
-- ============================================

('timing', 'strategic_window_bonus', 
 '{"value": 2}',
 'Score bonus for strategic timing windows (model launches, etc.)'),

('timing', 'friday_monday_substack_bonus', 
 '{"value": 1}',
 'Score bonus for Friday/Monday Substack publish'),

('timing', 'thursday_penalty', 
 '{"value": -1}',
 'Score penalty for Thursday publish'),

('timing', 'holiday_penalty', 
 '{"value": -3}',
 'Score penalty for holiday period'),

('timing', 'wednesday_friday_youtube_bonus', 
 '{"value": 2}',
 'Score bonus for Wednesday/Friday YouTube publish'),

('timing', 'monday_youtube_penalty', 
 '{"value": -2}',
 'Score penalty for Monday YouTube publish (worst day)'),

-- ============================================
-- FEATURE FLAG
-- ============================================

('routing', 'routing_system_enabled', 
 '{"value": true}',
 'Master switch to enable/disable the routing system'),

-- ============================================
-- WEEKLY TARGETS (backup - primary source is publications table)
-- ============================================

('routing', 'weekly_targets', 
 '{"core_substack": 7, "youtube": 7, "beginner_substack": 4}',
 'Default weekly content targets per publication')

ON CONFLICT (category, key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = NOW();
