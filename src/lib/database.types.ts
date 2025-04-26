export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type DaysToMaturity = {
  DirectSeed: {
    min: number
    max: number
  } | null
  Transplant: {
    min: number
    max: number
  } | null
} | null

export type Database = {
  public: {
    Tables: {
      beds: {
        Row: {
          created_at: string | null
          id: string
          length_in: number | null
          name: string
          notes: string | null
          plot_id: string
          width_in: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          length_in?: number | null
          name: string
          notes?: string | null
          plot_id: string
          width_in?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          length_in?: number | null
          name?: string
          notes?: string | null
          plot_id?: string
          width_in?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "beds_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["id"]
          },
        ]
      }
      crop_varieties: {
        Row: {
          color: string | null
          created_at: string | null
          days_to_maturity: DaysToMaturity
          disease_resistance: string | null
          hybrid_status: string | null
          id: string
          is_organic: boolean | null
          latin_name: string | null
          name: string
          notes: string | null
          size: string | null
          variety: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          days_to_maturity?: DaysToMaturity
          disease_resistance?: string | null
          hybrid_status?: string | null
          id?: string
          is_organic?: boolean | null
          latin_name?: string | null
          name: string
          notes?: string | null
          size?: string | null
          variety?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          days_to_maturity?: DaysToMaturity
          disease_resistance?: string | null
          hybrid_status?: string | null
          id?: string
          is_organic?: boolean | null
          latin_name?: string | null
          name?: string
          notes?: string | null
          size?: string | null
          variety?: string | null
        }
        Relationships: []
      }
      crops: {
        Row: {
          bed_id: string
          created_at: string | null
          crop_variety_id: string
          harvested_date: string | null
          id: string
          planted_date: string | null
          row_spacing_cm: number | null
          seed_spacing_cm: number | null
          status: Database["public"]["Enums"]["crop_status"] | null
        }
        Insert: {
          bed_id: string
          created_at?: string | null
          crop_variety_id: string
          harvested_date?: string | null
          id?: string
          planted_date?: string | null
          row_spacing_cm?: number | null
          seed_spacing_cm?: number | null
          status?: Database["public"]["Enums"]["crop_status"] | null
        }
        Update: {
          bed_id?: string
          created_at?: string | null
          crop_variety_id?: string
          harvested_date?: string | null
          id?: string
          planted_date?: string | null
          row_spacing_cm?: number | null
          seed_spacing_cm?: number | null
          status?: Database["public"]["Enums"]["crop_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "crops_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crops_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
        ]
      }
      plots: {
        Row: {
          address: string | null
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      crop_status: "planned" | "planted" | "growing" | "harvested"
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
      crop_status: ["planned", "planted", "growing", "harvested"],
    },
  },
} as const
