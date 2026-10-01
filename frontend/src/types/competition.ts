export type CompetitionType =
  | 'all'
  | 'hackathon'
  | 'datathon'
  | 'techathon'
  | 'project_showcase'
  | 'poster_presentation'
  | 'robotics'
  | 'other';

export type ParticipationMode = 'all' | 'in_person' | 'online' | 'hybrid';

export interface Competition {
  id: string;
  title: string;
  organizer: string;
  event_type: CompetitionType;
  participation_mode: 'in_person' | 'online' | 'hybrid';
  venue_location?: string;
  description: string;
  eligibility?: string;
  prize_pool?: string;
  registration_deadline: string;
  event_date?: string;
  registration_url: string;
  banner_url?: string;
  tags: string[];
  source: string;
  social_proof?: string;
  is_featured: boolean;
  days_left?: number;
  created_at?: string;
}

export interface CompetitionStats {
  total_active: number;
  online_count: number;
  bangladesh_in_person: number;
  hackathons_count: number;
  datathons_count: number;
  project_showcase_count: number;
  poster_presentation_count: number;
}
