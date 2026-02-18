// Schedule Types

export interface MassSchedule {
  id: string;
  church_id: string;
  day_of_week: number; // 0 = Sunday, 6 = Saturday
  mass_time: string; // HH:mm format
  language: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface Liturgy {
  id: string;
  date: string;
  readings?: string;
  psalm?: string;
  gospel?: string;
  title?: string;
  created_at: string;
}

export interface Church {
  id: string;
  diocese_id: string;
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  website?: string;
  image_url?: string;
  created_at: string;
  diocese?: {
    id: string;
    name: string;
    country?: {
      id: string;
      name: string;
    };
  };
  mass_schedules?: MassSchedule[];
}

export interface Diocese {
  id: string;
  country_id: string;
  name: string;
  created_at: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  created_at: string;
}
