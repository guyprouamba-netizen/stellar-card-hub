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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cards: {
        Row: {
          balance: number
          brand: string | null
          created_at: string
          currency: string
          id: string
          last4: string | null
          metadata: Json | null
          provider: string
          provider_card_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          brand?: string | null
          created_at?: string
          currency?: string
          id?: string
          last4?: string | null
          metadata?: Json | null
          provider?: string
          provider_card_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          brand?: string | null
          created_at?: string
          currency?: string
          id?: string
          last4?: string | null
          metadata?: Json | null
          provider?: string
          provider_card_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      kyc_submissions: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string | null
          id: string
          id_image_url: string | null
          id_number: string | null
          id_type: string | null
          last_name: string | null
          provider_response: Json | null
          provider_status: string | null
          selfie_url: string | null
          status: string
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          id?: string
          id_image_url?: string | null
          id_number?: string | null
          id_type?: string | null
          last_name?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string | null
          id?: string
          id_image_url?: string | null
          id_number?: string | null
          id_type?: string | null
          last_name?: string | null
          provider_response?: Json | null
          provider_status?: string | null
          selfie_url?: string | null
          status?: string
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          strowallet_customer_id: string | null
          updated_at: string
        }
        Insert: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          strowallet_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          strowallet_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          description: string | null
          id: string
          metadata: Json | null
          provider: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          provider?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["tx_status"]
          type?: Database["public"]["Enums"]["tx_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          currency: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          currency?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      tx_status: "pending" | "success" | "failed" | "cancelled"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "card_issue"
        | "card_fund"
        | "fee"
        | "refund"
        | "transfer"
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
      app_role: ["admin", "user"],
      tx_status: ["pending", "success", "failed", "cancelled"],
      tx_type: [
        "deposit",
        "withdrawal",
        "card_issue",
        "card_fund",
        "fee",
        "refund",
        "transfer",
      ],
    },
  },
} as const
