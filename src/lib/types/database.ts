export type UserRole = 'EMPLOYEE' | 'MANAGER' | 'HR_ADMIN'
export type PeriodStatus = 'open' | 'closed'
export type OkrStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REVISION_REQUESTED'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  manager_id: string | null
  is_onboarded: boolean
  is_active: boolean
  notification_prefs?: {
    checkin_reminders: boolean
    review_reminders: boolean
    goal_status_updates: boolean
    checkin_reviewed: boolean
    team_checkin_submitted: boolean
  }
  pending_manager_id: string | null
  created_at: string
  updated_at: string
}

export interface OrgClosure {
  ancestor_id: string
  descendant_id: string
  depth: number
}

export interface PerformancePeriod {
  id: string
  name: string
  year: number
  quarter: number
  start_date: string
  end_date: string
  status: PeriodStatus
  created_at: string
}

export interface Okr {
  id: string
  employee_id: string
  period_id: string
  title: string
  description: string | null
  status: OkrStatus
  manager_comment: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type KeyResultProgressStatus = 'not_started' | 'in_progress' | 'on_track' | 'at_risk' | 'done'

export interface KeyResult {
  id: string
  okr_id: string
  title: string
  sort_order: number
  progress_status: KeyResultProgressStatus
  created_at: string
  updated_at: string
}

export interface Initiative {
  id: string
  key_result_id: string
  title: string
  sort_order: number
  completed: boolean
  completed_at: string | null
  created_at: string
}

export type MoodEnergy = 'terrible' | 'meh' | 'okay' | 'great'
export type MoodProductivity = 'waste' | 'fine' | 'ludicrous'

export interface ReviewMit {
  title: string
  description: string
  okr_id: string | null
  okr_label: string | null
  status: 'achieved' | 'not_achieved'
}

export interface PlanMit {
  title: string
  description: string
  okr_id: string | null
  okr_label: string | null
}

// Legacy alias kept so existing manager form code compiles
export interface Mit {
  title: string
  description: string
}

export interface QuarterlyGoal {
  id: string
  title: string
  description: string
}

export interface QuarterlyGoalReview {
  id: string
  title: string
  description: string
  status: 'achieved' | 'not_achieved' | null
}

export interface ValueAssessment {
  value_id: string
  value_name: string
  description: string
}

export interface Checkin {
  id: string
  employee_id: string
  period_id: string
  month: number
  year: number
  // Employee section — dynamic MITs stored as JSONB
  mits: ReviewMit[] | null
  next_mits: PlanMit[] | null
  // Legacy fixed fields (kept for reading old rows)
  mit_1_title: string | null
  mit_1_description: string | null
  mit_2_title: string | null
  mit_2_description: string | null
  mit_3_title: string | null
  mit_3_description: string | null
  done_well: string | null
  do_differently: string | null
  support_requests: string | null
  ai_builder: string | null
  // Mood tracking
  mood_energy: MoodEnergy | null
  mood_productivity: MoodProductivity | null
  employee_submitted_at: string | null
  // Manager section
  mgr_mit_notes: string | null
  mgr_done_well: string | null
  mgr_do_differently: string | null
  mgr_support_commitments: string | null
  mgr_private_note: string | null
  mgr_next_mits: Mit[] | null
  // Legacy fixed next-MIT fields
  mgr_next_mit_1_title: string | null
  mgr_next_mit_1_description: string | null
  mgr_next_mit_2_title: string | null
  mgr_next_mit_2_description: string | null
  mgr_next_mit_3_title: string | null
  mgr_next_mit_3_description: string | null
  manager_submitted_at: string | null
  created_at: string
  updated_at: string
}

/**
 * @deprecated Status is no longer stored per-OKR in the quarterly check-in.
 * The live OKR state (key result statuses, initiative completion) is the source of truth.
 * Kept exported for legacy data compatibility — old rows may still have this field.
 */
export type QuarterlyCheckinOkrStatus = 'on_track' | 'at_risk' | 'off_track'

export interface QuarterlyCheckinOkrProgress {
  okr_id: string
  okr_title: string
  /** @deprecated Status now comes from live OKR data, not the check-in. May exist in legacy rows. */
  status?: QuarterlyCheckinOkrStatus
  narrative: string
}

export interface CompanyValue {
  id: string
  name: string
  description: string
  sort_order: number
  created_at?: string
}

export interface PulseOption {
  id: string
  type: 'energy' | 'flow'
  slug: string
  label: string
  color: string  // hex e.g. "#7c5cfc"
  emoji: string
  sort_order: number
}

export interface ValueRating {
  value_id: string
  value_name: string
  rating: number // 1–5
  evidence: string
}

export interface ValueSelfAssessment {
  value_id: string
  value_name: string
  rating: number // 1–5
  examples: string
}

export interface QuarterlyCheckin {
  id: string
  employee_id: string
  period_id: string
  // Employee section — v2 fields
  goals: QuarterlyGoalReview[] | null
  next_quarter_goals: QuarterlyGoal[] | null
  next_quarter_mits: PlanMit[] | null
  value_assessments: ValueAssessment[] | null
  // Legacy employee fields (kept for reading old rows)
  okr_progress: QuarterlyCheckinOkrProgress[]
  value_self_assessments: ValueSelfAssessment[]
  continue_doing: string | null
  stop_doing: string | null
  start_doing: string | null
  okr_adjustments: string | null
  capability_needs: string | null
  employee_submitted_at: string | null
  // Manager section (unchanged)
  mgr_okr_feedback: string | null
  mgr_css_feedback: string | null
  mgr_adjustments_notes: string | null
  mgr_support_plan: string | null
  mgr_private_note: string | null
  manager_submitted_at: string | null
  // AI Builder — employee self-report
  ai_builder_active: boolean | null
  ai_builder_description: string | null
  created_at: string
  updated_at: string
}

export type SubordinateRow = Profile & { depth: number }

export interface GuideSection {
  id: string
  slug: string
  title: string
  content: string
  sort_order: number
  created_at: string
  updated_at: string
}

export interface QuarterlyScore {
  id: string
  manager_id: string
  employee_id: string
  period_id: string
  professional_mastery: number | null
  okrs_stretch_goals: number | null
  behaviours_values: number | null
  professional_mastery_notes: string | null
  okrs_stretch_goals_notes: string | null
  behaviours_values_notes: string | null
  value_ratings: ValueRating[]
  visible_to_employee: boolean
  created_at: string
  updated_at: string
}

export interface AnnualScore {
  id: string
  employee_id: string
  year: number
  suggested_professional_mastery: number | null
  suggested_okrs_stretch_goals: number | null
  suggested_behaviours_values: number | null
  final_professional_mastery: number | null
  final_okrs_stretch_goals: number | null
  final_behaviours_values: number | null
  final_overall: number | null
  override_rationale: string | null
  finalized_by: string | null
  finalized_at: string | null
  created_at: string
  updated_at: string
}

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'> & { created_at?: string; updated_at?: string }
        Update: Partial<Omit<Profile, 'id'>>
      }
      org_closure: {
        Row: OrgClosure
        Insert: OrgClosure
        Update: Partial<OrgClosure>
      }
      performance_periods: {
        Row: PerformancePeriod
        Insert: Omit<PerformancePeriod, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<PerformancePeriod, 'id'>>
      }
      okrs: {
        Row: Okr
        Insert: Omit<Okr, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Okr, 'id'>>
      }
      key_results: {
        Row: KeyResult
        Insert: Omit<KeyResult, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<KeyResult, 'id'>>
      }
      initiatives: {
        Row: Initiative
        Insert: Omit<Initiative, 'id' | 'created_at'> & { id?: string }
        Update: Partial<Omit<Initiative, 'id'>>
      }
      checkins: {
        Row: Checkin
        Insert: Omit<Checkin, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<Checkin, 'id'>>
      }
      quarterly_checkins: {
        Row: QuarterlyCheckin
        Insert: Omit<QuarterlyCheckin, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<QuarterlyCheckin, 'id'>>
      }
      quarterly_scores: {
        Row: QuarterlyScore
        Insert: Omit<QuarterlyScore, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<QuarterlyScore, 'id'>>
      }
      annual_scores: {
        Row: AnnualScore
        Insert: Omit<AnnualScore, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<AnnualScore, 'id'>>
      }
      guide_sections: {
        Row: GuideSection
        Insert: Omit<GuideSection, 'id' | 'created_at' | 'updated_at'> & { id?: string }
        Update: Partial<Omit<GuideSection, 'id'>>
      }
      company_values: {
        Row: CompanyValue
        Insert: Omit<CompanyValue, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Omit<CompanyValue, 'id'>>
      }
    }
    Views: Record<string, never>
    Functions: {
      upsert_profile_on_login: {
        Args: { user_id: string; user_email: string; user_full_name: string | null; user_avatar_url: string | null }
        Returns: undefined
      }
      rebuild_closure_for_employee: {
        Args: { employee_uuid: string; new_manager_uuid: string | null }
        Returns: undefined
      }
      get_subordinates: {
        Args: { manager_uuid: string }
        Returns: SubordinateRow[]
      }
      get_managers: {
        Args: Record<string, never>
        Returns: Pick<Profile, 'id' | 'email' | 'full_name'>[]
      }
      get_pending_okr_count: {
        Args: { manager_uuid: string }
        Returns: number
      }
      approve_team_request: {
        Args: { employee_uuid: string }
        Returns: undefined
      }
      decline_team_request: {
        Args: { employee_uuid: string }
        Returns: undefined
      }
    }
    Enums: {
      user_role: UserRole
      period_status: PeriodStatus
      okr_status: OkrStatus
    }
    CompositeTypes: Record<string, never>
  }
}
