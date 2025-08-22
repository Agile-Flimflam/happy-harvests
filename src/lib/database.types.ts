export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          full_name: string | null
          avatar_url: string | null
          locale: string | null
          timezone: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          locale?: string | null
          timezone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          full_name?: string | null
          avatar_url?: string | null
          locale?: string | null
          timezone?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      plots: {
        Row: {
          created_at: string
          name: string
          plot_id: number
          location_id: string | null
        }
        Insert: {
          created_at?: string
          name: string
          plot_id?: number
          location_id?: string | null
        }
        Update: {
          created_at?: string
          name?: string
          plot_id?: number
          location_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      ,
      locations: {
        Row: {
          id: string
          created_at: string
          name: string
          street: string | null
          city: string | null
          state: string | null
          zip: string | null
          latitude: number | null
          longitude: number | null
          timezone: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          street?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          latitude?: number | null
          longitude?: number | null
          timezone?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          street?: string | null
          city?: string | null
          state?: string | null
          zip?: string | null
          latitude?: number | null
          longitude?: number | null
          timezone?: string | null
          notes?: string | null
        }
        Relationships: []
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
          }
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
      crop_varieties: {
        Row: {
          created_at: string
          crop_id: number
          dtm_direct_seed_max: number
          dtm_direct_seed_min: number
          dtm_transplant_max: number
          dtm_transplant_min: number
          id: number
          is_organic: boolean
          latin_name: string
          name: string
          notes: string | null
          image_path: string | null
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
          is_organic: boolean
          latin_name: string
          name: string
          notes?: string | null
          image_path?: string | null
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
          is_organic?: boolean
          latin_name?: string
          name?: string
          notes?: string | null
          image_path?: string | null
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
          }
        ]
      }
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
            foreignKeyName: "Bed Plantings_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "Bed Plantings_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      crop_type: "Vegetable" | "Fruit" | "Windbreak" | "Covercrop"
      planting_type: "Direct Seed" | "Transplant"
      bed_planting_status: "Planted" | "Harvested" | "Nursery"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      crop_type: ["Vegetable", "Fruit", "Windbreak", "Covercrop"],
      planting_type: ["Direct Seed", "Transplant"],
      bed_planting_status: ["Planted", "Harvested", "Nursery"],
    },
  },
} as const
