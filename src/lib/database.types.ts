export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bed_plantings: {
        Row: {
          bed_id: number
          created_at: string
          crop_variety_id: number
          date_planted: string
          harvested_date: string | null
          id: number
          notes: string | null
          planting_type: Database["public"]["Enums"]["planting_type"]
          qty_planting: number
          status: Database["public"]["Enums"]["bed_planting_status"]
        }
        Insert: {
          bed_id: number
          created_at?: string
          crop_variety_id: number
          date_planted: string
          harvested_date?: string | null
          id?: number
          notes?: string | null
          planting_type: Database["public"]["Enums"]["planting_type"]
          qty_planting: number
          status: Database["public"]["Enums"]["bed_planting_status"]
        }
        Update: {
          bed_id?: number
          created_at?: string
          crop_variety_id?: number
          date_planted?: string
          harvested_date?: string | null
          id?: number
          notes?: string | null
          planting_type?: Database["public"]["Enums"]["planting_type"]
          qty_planting?: number
          status?: Database["public"]["Enums"]["bed_planting_status"]
        }
        Relationships: [
          {
            foreignKeyName: "Bed Plantings_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bed Plantings_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          created_at: string
          id: number
          length_inches: number | null
          plot_id: number
          width_inches: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          length_inches?: number | null
          plot_id: number
          width_inches?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          length_inches?: number | null
          plot_id?: number
          width_inches?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "Bed_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["plot_id"]
          },
        ]
      }
      crop_varieties: {
        Row: {
          created_at: string
          crop_id: number
          dtm_direct_seed_max: number
          dtm_direct_seed_min: number
          dtm_transplant_max: number
          dtm_transplant_min: number
          id: number
          image_path: string | null
          is_organic: boolean
          latin_name: string
          name: string
          notes: string | null
          plant_spacing_max: number | null
          plant_spacing_min: number | null
          row_spacing_max: number | null
          row_spacing_min: number | null
        }
        Insert: {
          created_at?: string
          crop_id: number
          dtm_direct_seed_max: number
          dtm_direct_seed_min: number
          dtm_transplant_max: number
          dtm_transplant_min: number
          id?: number
          image_path?: string | null
          is_organic: boolean
          latin_name: string
          name: string
          notes?: string | null
          plant_spacing_max?: number | null
          plant_spacing_min?: number | null
          row_spacing_max?: number | null
          row_spacing_min?: number | null
        }
        Update: {
          created_at?: string
          crop_id?: number
          dtm_direct_seed_max?: number
          dtm_direct_seed_min?: number
          dtm_transplant_max?: number
          dtm_transplant_min?: number
          id?: number
          image_path?: string | null
          is_organic?: boolean
          latin_name?: string
          name?: string
          notes?: string | null
          plant_spacing_max?: number | null
          plant_spacing_min?: number | null
          row_spacing_max?: number | null
          row_spacing_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crop_varieties_crop_id_fkey"
            columns: ["crop_id"]
            isOneToOne: false
            referencedRelation: "crops"
            referencedColumns: ["id"]
          },
        ]
      }
      crops: {
        Row: {
          created_at: string
          crop_type: Database["public"]["Enums"]["crop_type"]
          id: number
          name: string
        }
        Insert: {
          created_at?: string
          crop_type: Database["public"]["Enums"]["crop_type"]
          id?: number
          name: string
        }
        Update: {
          created_at?: string
          crop_type?: Database["public"]["Enums"]["crop_type"]
          id?: number
          name?: string
        }
        Relationships: []
      }
      external_events: {
        Row: {
          calendar_id: string
          created_at: string
          event_id: string
          id: string
          provider: string
          resource_id: number
          resource_type: string
          updated_at: string
        }
        Insert: {
          calendar_id: string
          created_at?: string
          event_id: string
          id?: string
          provider: string
          resource_id: number
          resource_type: string
          updated_at?: string
        }
        Update: {
          calendar_id?: string
          created_at?: string
          event_id?: string
          id?: string
          provider?: string
          resource_id?: number
          resource_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      external_integrations: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          service: string
          settings: Json | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          service: string
          settings?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          service?: string
          settings?: Json | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      locations: {
        Row: {
          city: string | null
          created_at: string
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          state: string | null
          street: string | null
          timezone: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          state?: string | null
          street?: string | null
          timezone?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          state?: string | null
          street?: string | null
          timezone?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      plots: {
        Row: {
          created_at: string
          location_id: string
          name: string
          plot_id: number
        }
        Insert: {
          created_at?: string
          location_id: string
          name: string
          plot_id?: number
        }
        Update: {
          created_at?: string
          location_id?: string
          name?: string
          plot_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "plots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          full_name: string | null
          id: string
          locale: string | null
          role: Database["public"]["Enums"]["user_role"]
          timezone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id: string
          locale?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          timezone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          full_name?: string | null
          id?: string
          locale?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          timezone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          id: string | null
          name: string | null
        }
        Insert: {
          avatar_url?: string | null
          id?: string | null
          name?: never
        }
        Update: {
          avatar_url?: string | null
          id?: string | null
          name?: never
        }
        Relationships: []
      }
    }
    Functions: {
      citext: {
        Args: { "": boolean } | { "": string } | { "": unknown }
        Returns: string
      }
      citext_hash: {
        Args: { "": string }
        Returns: number
      }
      citextin: {
        Args: { "": unknown }
        Returns: string
      }
      citextout: {
        Args: { "": string }
        Returns: unknown
      }
      citextrecv: {
        Args: { "": unknown }
        Returns: string
      }
      citextsend: {
        Args: { "": string }
        Returns: string
      }
    }
    Enums: {
      bed_planting_status: "Planted" | "Harvested" | "Nursery"
      crop_type: "Vegetable" | "Fruit" | "Windbreak" | "Covercrop"
      planting_type: "Direct Seed" | "Transplant"
      user_role: "admin" | "member"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      bed_planting_status: ["Planted", "Harvested", "Nursery"],
      crop_type: ["Vegetable", "Fruit", "Windbreak", "Covercrop"],
      planting_type: ["Direct Seed", "Transplant"],
      user_role: ["admin", "member"],
    },
  },
} as const
