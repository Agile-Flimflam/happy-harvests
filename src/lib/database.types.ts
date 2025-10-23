export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities_soil_amendments: {
        Row: {
          id: number
          activity_id: number
          name: string
          quantity: number | null
          unit: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: number
          activity_id: number
          name: string
          quantity?: number | null
          unit?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: number
          activity_id?: number
          name?: string
          quantity?: number | null
          unit?: string | null
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_soil_amendments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          id: number
          activity_type: Database["public"]["Enums"]["activity_type"]
          started_at: string
          ended_at: string | null
          duration_minutes: number | null
          labor_hours: number | null
          location_id: string | null
          plot_id: number | null
          bed_id: number | null
          nursery_id: string | null
          crop: string | null
          asset_id: string | null
          asset_name: string | null
          quantity: number | null
          unit: string | null
          cost: number | null
          notes: string | null
          weather: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          activity_type: Database["public"]["Enums"]["activity_type"]
          started_at: string
          ended_at?: string | null
          duration_minutes?: number | null
          labor_hours?: number | null
          location_id?: string | null
          plot_id?: number | null
          bed_id?: number | null
          nursery_id?: string | null
          crop?: string | null
          asset_id?: string | null
          asset_name?: string | null
          quantity?: number | null
          unit?: string | null
          cost?: number | null
          notes?: string | null
          weather?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          activity_type?: Database["public"]["Enums"]["activity_type"]
          started_at?: string
          ended_at?: string | null
          duration_minutes?: number | null
          labor_hours?: number | null
          location_id?: string | null
          plot_id?: number | null
          bed_id?: number | null
          nursery_id?: string | null
          crop?: string | null
          asset_id?: string | null
          asset_name?: string | null
          quantity?: number | null
          unit?: string | null
          cost?: number | null
          notes?: string | null
          weather?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_plot_id_fkey"
            columns: ["plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["plot_id"]
          },
          {
            foreignKeyName: "activities_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_nursery_id_fkey"
            columns: ["nursery_id"]
            isOneToOne: false
            referencedRelation: "nurseries"
            referencedColumns: ["id"]
          },
        ]
      }
      beds: {
        Row: {
          created_at: string
          id: number
          length_inches: number | null
          name: string | null
          plot_id: number
          width_inches: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          length_inches?: number | null
          name?: string | null
          plot_id: number
          width_inches?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          length_inches?: number | null
          name?: string | null
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
      customers: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          email: string | null
          phone: string | null
          fax: string | null
          website: string | null
          billing_street: string | null
          billing_city: string | null
          billing_state: string | null
          billing_zip: string | null
          shipping_street: string | null
          shipping_city: string | null
          shipping_state: string | null
          shipping_zip: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          email?: string | null
          phone?: string | null
          fax?: string | null
          website?: string | null
          billing_street?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          shipping_street?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          email?: string | null
          phone?: string | null
          fax?: string | null
          website?: string | null
          billing_street?: string | null
          billing_city?: string | null
          billing_state?: string | null
          billing_zip?: string | null
          shipping_street?: string | null
          shipping_city?: string | null
          shipping_state?: string | null
          shipping_zip?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      seeds: {
        Row: {
          id: number
          created_at: string
          updated_at: string
          crop_variety_id: number
          crop_name: string
          variety_name: string
          vendor: string | null
          lot_number: string | null
          date_received: string | null
          quantity: number | null
          quantity_units: string | null
          notes: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          updated_at?: string
          crop_variety_id: number
          crop_name: string
          variety_name: string
          vendor?: string | null
          lot_number?: string | null
          date_received?: string | null
          quantity?: number | null
          quantity_units?: string | null
          notes?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          updated_at?: string
          crop_variety_id?: number
          crop_name?: string
          variety_name?: string
          vendor?: string | null
          lot_number?: string | null
          date_received?: string | null
          quantity?: number | null
          quantity_units?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "seeds_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
        ]
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
      nurseries: {
        Row: {
          created_at: string
          id: string
          location_id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          location_id: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          location_id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nurseries_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      planting_events: {
        Row: {
          bed_id: number | null
          created_at: string
          created_by: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["planting_event_type"]
          id: number
          nursery_id: string | null
          payload: Json | null
          planting_id: number
          qty: number | null
          weight_grams: number | null
        }
        Insert: {
          bed_id?: number | null
          created_at?: string
          created_by?: string | null
          event_date: string
          event_type: Database["public"]["Enums"]["planting_event_type"]
          id?: number
          nursery_id?: string | null
          payload?: Json | null
          planting_id: number
          qty?: number | null
          weight_grams?: number | null
        }
        Update: {
          bed_id?: number | null
          created_at?: string
          created_by?: string | null
          event_date?: string
          event_type?: Database["public"]["Enums"]["planting_event_type"]
          id?: number
          nursery_id?: string | null
          payload?: Json | null
          planting_id?: number
          qty?: number | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "planting_events_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planting_events_nursery_id_fkey"
            columns: ["nursery_id"]
            isOneToOne: false
            referencedRelation: "nurseries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planting_events_planting_id_fkey"
            columns: ["planting_id"]
            isOneToOne: false
            referencedRelation: "plantings"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          customer_id: string | null
          delivery_date: string
          status: string | null
          payment_terms: string | null
          payment_status: string | null
          notes: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          customer_id?: string | null
          delivery_date: string
          status?: string | null
          payment_terms?: string | null
          payment_status?: string | null
          notes?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          customer_id?: string | null
          delivery_date?: string
          status?: string | null
          payment_terms?: string | null
          payment_status?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          id: number
          created_at: string
          delivery_id: string
          crop_variety_id: number | null
          planting_id: number | null
          qty: number | null
          unit: string | null
          price_per: number | null
          total_price: number | null
          notes: string | null
        }
        Insert: {
          id?: number
          created_at?: string
          delivery_id: string
          crop_variety_id?: number | null
          planting_id?: number | null
          qty?: number | null
          unit?: string | null
          price_per?: number | null
          total_price?: number | null
          notes?: string | null
        }
        Update: {
          id?: number
          created_at?: string
          delivery_id?: string
          crop_variety_id?: number | null
          planting_id?: number | null
          qty?: number | null
          unit?: string | null
          price_per?: number | null
          total_price?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_planting_id_fkey"
            columns: ["planting_id"]
            isOneToOne: false
            referencedRelation: "plantings"
            referencedColumns: ["id"]
          },
        ]
      }
      plantings: {
        Row: {
          bed_id: number | null
          created_at: string
          crop_variety_id: number
          ended_date: string | null
          id: number
          notes: string | null
          nursery_id: string | null
          nursery_started_date: string | null
          planted_date: string | null
          propagation_method: string
          status: Database["public"]["Enums"]["planting_status"]
          updated_at: string
        }
        Insert: {
          bed_id?: number | null
          created_at?: string
          crop_variety_id: number
          ended_date?: string | null
          id?: number
          notes?: string | null
          nursery_id?: string | null
          nursery_started_date?: string | null
          planted_date?: string | null
          propagation_method: string
          status: Database["public"]["Enums"]["planting_status"]
          updated_at?: string
        }
        Update: {
          bed_id?: number | null
          created_at?: string
          crop_variety_id?: number
          ended_date?: string | null
          id?: number
          notes?: string | null
          nursery_id?: string | null
          nursery_started_date?: string | null
          planted_date?: string | null
          propagation_method?: string
          status?: Database["public"]["Enums"]["planting_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plantings_bed_id_fkey"
            columns: ["bed_id"]
            isOneToOne: false
            referencedRelation: "beds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_crop_variety_id_fkey"
            columns: ["crop_variety_id"]
            isOneToOne: false
            referencedRelation: "crop_varieties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plantings_nursery_id_fkey"
            columns: ["nursery_id"]
            isOneToOne: false
            referencedRelation: "nurseries"
            referencedColumns: ["id"]
          },
        ]
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
      ,
      plantings_summary: {
        Row: {
          id: number | null
          planted_qty: number | null
          planted_weight_grams: number | null
          harvest_qty: number | null
          harvest_weight_grams: number | null
        }
        Insert: {
          id?: never
          planted_qty?: never
          planted_weight_grams?: never
          harvest_qty?: never
          harvest_weight_grams?: never
        }
        Update: {
          id?: never
          planted_qty?: never
          planted_weight_grams?: never
          harvest_qty?: never
          harvest_weight_grams?: never
        }
        Relationships: []
      }
    }
    Functions: {
      _current_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
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
      fn_create_direct_seed_planting: {
        Args: {
          p_bed_id: number
          p_crop_variety_id: number
          p_event_date: string
          p_notes?: string
          p_qty: number
          p_weight_grams?: number
        }
        Returns: number
      }
      fn_create_nursery_planting: {
        Args: {
          p_crop_variety_id: number
          p_event_date: string
          p_notes?: string
          p_nursery_id: string
          p_qty: number
          p_weight_grams?: number
        }
        Returns: number
      }
      fn_harvest_planting: {
        Args: {
          p_event_date: string
          p_planting_id: number
          p_qty_harvested?: number
          p_weight_grams?: number
        }
        Returns: undefined
      }
      fn_move_planting: {
        Args: { p_bed_id: number; p_event_date: string; p_planting_id: number }
        Returns: undefined
      }
      fn_remove_planting: {
        Args: { p_event_date: string; p_planting_id: number; p_reason?: string }
        Returns: undefined
      }
      fn_transplant_planting: {
        Args: { p_bed_id: number; p_event_date: string; p_planting_id: number }
        Returns: undefined
      }
    }
    Enums: {
      activity_type: "irrigation" | "soil_amendment" | "pest_management" | "asset_maintenance"
      bed_planting_status: "Planted" | "Harvested" | "Nursery"
      crop_type: "Vegetable" | "Fruit" | "Windbreak" | "Covercrop"
      planting_event_type:
        | "nursery_seeded"
        | "direct_seeded"
        | "transplanted"
        | "moved"
        | "harvested"
        | "removed"
      planting_status: "nursery" | "planted" | "harvested" | "removed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      bed_planting_status: ["Planted", "Harvested", "Nursery"],
      crop_type: ["Vegetable", "Fruit", "Windbreak", "Covercrop"],
      planting_event_type: [
        "nursery_seeded",
        "direct_seeded",
        "transplanted",
        "moved",
        "harvested",
        "removed",
      ],
      planting_status: ["nursery", "planted", "harvested", "removed"],
      planting_type: ["Direct Seed", "Transplant"],
      user_role: ["admin", "member"],
    },
  },
} as const

