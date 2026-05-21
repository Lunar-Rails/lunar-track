import type { PlanMit, QuarterlyGoal } from '@/lib/types/database'

/**
 * Fixed id for the auto-populated "Pass probation" goal. Kept stable (rather
 * than a random uuid) so the hard-coded MITs below can link to it — MitPlanList
 * matches a MIT's okr_id against a goal id to render the goal link.
 */
export const PROBATION_GOAL_ID = 'a1b2c3d4-0000-4000-8000-000000000001'

/** Quarterly goal auto-populated for a new hire's first quarterly check-in. */
export const PROBATION_GOAL: QuarterlyGoal = {
  id: PROBATION_GOAL_ID,
  title: 'Pass probation',
  description: 'Successfully complete your probation period and become a permanent member of the team.',
}

/** Hard-coded MITs tied to the "Pass probation" goal for new hires. */
export const PROBATION_MITS: PlanMit[] = [
  {
    title: 'Complete onboarding',
    description: 'Finish all setup, tooling access, and required training.',
    okr_id: PROBATION_GOAL_ID,
    okr_label: PROBATION_GOAL.title,
  },
  {
    title: 'Ramp up on your role',
    description: 'Get up to speed on key systems, processes, and responsibilities.',
    okr_id: PROBATION_GOAL_ID,
    okr_label: PROBATION_GOAL.title,
  },
  {
    title: 'Make your first contribution',
    description: 'Deliver a meaningful piece of work reviewed by your manager.',
    okr_id: PROBATION_GOAL_ID,
    okr_label: PROBATION_GOAL.title,
  },
]
