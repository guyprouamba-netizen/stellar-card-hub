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
      accounting_accounts: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          id: string
          is_active: boolean
          kind: string
          name: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_accounts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_categories: {
        Row: {
          business_id: string
          color: string | null
          created_at: string
          id: string
          kind: string
          name: string
        }
        Insert: {
          business_id: string
          color?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
        }
        Update: {
          business_id?: string
          color?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_entries: {
        Row: {
          account_id: string | null
          amount: number
          attachment_url: string | null
          auto_generated: boolean
          business_id: string
          category_id: string | null
          counterparty: string | null
          created_at: string
          currency: string
          entry_date: string
          id: string
          kind: string
          label: string
          notes: string | null
          related_invoice_id: string | null
          related_order_id: string | null
          syscohada_code: string | null
          tva_amount: number
          tva_rate: number
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          attachment_url?: string | null
          auto_generated?: boolean
          business_id: string
          category_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          entry_date?: string
          id?: string
          kind: string
          label: string
          notes?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          syscohada_code?: string | null
          tva_amount?: number
          tva_rate?: number
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          attachment_url?: string | null
          auto_generated?: boolean
          business_id?: string
          category_id?: string | null
          counterparty?: string | null
          created_at?: string
          currency?: string
          entry_date?: string
          id?: string
          kind?: string
          label?: string
          notes?: string | null
          related_invoice_id?: string | null
          related_order_id?: string | null
          syscohada_code?: string | null
          tva_amount?: number
          tva_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounting_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "accounting_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_related_invoice_id_fkey"
            columns: ["related_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_entries_related_order_id_fkey"
            columns: ["related_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      accounting_settings: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          currency: string
          email: string | null
          fiscal_year_start: string
          id: string
          ifu: string | null
          legal_name: string | null
          logo_url: string | null
          phone: string | null
          rccm: string | null
          regime: string
          tva_enabled: boolean
          tva_rate: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          currency?: string
          email?: string | null
          fiscal_year_start?: string
          id?: string
          ifu?: string | null
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          rccm?: string | null
          regime?: string
          tva_enabled?: boolean
          tva_rate?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          email?: string | null
          fiscal_year_start?: string
          id?: string
          ifu?: string | null
          legal_name?: string | null
          logo_url?: string | null
          phone?: string | null
          rccm?: string | null
          regime?: string
          tva_enabled?: boolean
          tva_rate?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      action_plans: {
        Row: {
          ai_generated: boolean
          business_id: string
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          project_id: string
          status: string
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          business_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id: string
          status?: string
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          business_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          project_id?: string
          status?: string
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: number
          metadata: Json
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: number
          metadata?: Json
          target_user_id?: string | null
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          action: string | null
          created_at: string
          duration_ms: number
          funnel_step: string | null
          id: number
          kind: string
          meta: Json
          path: string | null
          session_key: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          duration_ms?: number
          funnel_step?: string | null
          id?: number
          kind?: string
          meta?: Json
          path?: string | null
          session_key: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          duration_ms?: number
          funnel_step?: string | null
          id?: number
          kind?: string
          meta?: Json
          path?: string | null
          session_key?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      analytics_sessions: {
        Row: {
          browser: string | null
          city: string | null
          country: string | null
          country_code: string | null
          created_at: string
          device_type: string | null
          duration_ms: number
          id: string
          is_returning: boolean
          landing_path: string | null
          last_seen_at: string
          os: string | null
          page_views: number
          referrer: string | null
          session_key: string
          source: string
          started_at: string
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          visitor_key: string | null
        }
        Insert: {
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number
          id?: string
          is_returning?: boolean
          landing_path?: string | null
          last_seen_at?: string
          os?: string | null
          page_views?: number
          referrer?: string | null
          session_key: string
          source?: string
          started_at?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_key?: string | null
        }
        Update: {
          browser?: string | null
          city?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          device_type?: string | null
          duration_ms?: number
          id?: string
          is_returning?: boolean
          landing_path?: string | null
          last_seen_at?: string
          os?: string | null
          page_views?: number
          referrer?: string | null
          session_key?: string
          source?: string
          started_at?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          visitor_key?: string | null
        }
        Relationships: []
      }
      api_key_usage: {
        Row: {
          count: number
          id: string
          key_id: string
          window_start: string
        }
        Insert: {
          count?: number
          id?: string
          key_id: string
          window_start: string
        }
        Update: {
          count?: number
          id?: string
          key_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: false
            referencedRelation: "business_api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_ai_conversations: {
        Row: {
          business_id: string | null
          contact_jid: string
          contact_name: string | null
          created_at: string
          handoff: boolean
          id: string
          last_message_at: string
          session_id: string
          unread_count: number
          updated_at: string
        }
        Insert: {
          business_id?: string | null
          contact_jid: string
          contact_name?: string | null
          created_at?: string
          handoff?: boolean
          id?: string
          last_message_at?: string
          session_id: string
          unread_count?: number
          updated_at?: string
        }
        Update: {
          business_id?: string | null
          contact_jid?: string
          contact_name?: string | null
          created_at?: string
          handoff?: boolean
          id?: string
          last_message_at?: string
          session_id?: string
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_ai_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_ai_conversations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_ai_conversations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_ai_faq: {
        Row: {
          active: boolean
          answer: string
          business_id: string
          created_at: string
          id: string
          question: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          answer: string
          business_id: string
          created_at?: string
          id?: string
          question: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          answer?: string
          business_id?: string
          created_at?: string
          id?: string
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_ai_faq_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_ai_faq_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          meta: Json | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          meta?: Json | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          meta?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "bot_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_call_events: {
        Row: {
          blocked_until: string | null
          created_at: string
          event: string
          from_jid: string
          id: string
          session_id: string
        }
        Insert: {
          blocked_until?: string | null
          created_at?: string
          event: string
          from_jid: string
          id?: string
          session_id: string
        }
        Update: {
          blocked_until?: string | null
          created_at?: string
          event?: string
          from_jid?: string
          id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_call_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_config: {
        Row: {
          ai_dm_only: boolean
          ai_enabled: boolean
          ai_language: string
          ai_persona: string
          business_id: string | null
          call_block_hours: number
          call_spam_threshold: number
          call_spam_window_min: number
          created_at: string
          human_max_ms: number
          human_min_ms: number
          human_mode: boolean
          id: string
          link_removal: boolean
          link_whitelist: string[]
          night_end_hour: number
          night_mode: boolean
          night_start_hour: number
          rate_per_hour: number
          rate_per_minute: number
          reject_calls: boolean
          session_id: string
          updated_at: string
          warning_expire_days: number
          warnings_enabled: boolean
          warnings_threshold: number
          welcome_enabled: boolean
          welcome_message: string
        }
        Insert: {
          ai_dm_only?: boolean
          ai_enabled?: boolean
          ai_language?: string
          ai_persona?: string
          business_id?: string | null
          call_block_hours?: number
          call_spam_threshold?: number
          call_spam_window_min?: number
          created_at?: string
          human_max_ms?: number
          human_min_ms?: number
          human_mode?: boolean
          id?: string
          link_removal?: boolean
          link_whitelist?: string[]
          night_end_hour?: number
          night_mode?: boolean
          night_start_hour?: number
          rate_per_hour?: number
          rate_per_minute?: number
          reject_calls?: boolean
          session_id: string
          updated_at?: string
          warning_expire_days?: number
          warnings_enabled?: boolean
          warnings_threshold?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Update: {
          ai_dm_only?: boolean
          ai_enabled?: boolean
          ai_language?: string
          ai_persona?: string
          business_id?: string | null
          call_block_hours?: number
          call_spam_threshold?: number
          call_spam_window_min?: number
          created_at?: string
          human_max_ms?: number
          human_min_ms?: number
          human_mode?: boolean
          id?: string
          link_removal?: boolean
          link_whitelist?: string[]
          night_end_hour?: number
          night_mode?: boolean
          night_start_hour?: number
          rate_per_hour?: number
          rate_per_minute?: number
          reject_calls?: boolean
          session_id?: string
          updated_at?: string
          warning_expire_days?: number
          warnings_enabled?: boolean
          warnings_threshold?: number
          welcome_enabled?: boolean
          welcome_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_config_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_config_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_groups: {
        Row: {
          active: boolean
          created_at: string
          group_jid: string
          id: string
          link_removal_override: boolean | null
          member_count: number | null
          name: string | null
          rules: string | null
          session_id: string
          updated_at: string
          warnings_enabled_override: boolean | null
          welcome_enabled_override: boolean | null
          welcome_message: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_jid: string
          id?: string
          link_removal_override?: boolean | null
          member_count?: number | null
          name?: string | null
          rules?: string | null
          session_id: string
          updated_at?: string
          warnings_enabled_override?: boolean | null
          welcome_enabled_override?: boolean | null
          welcome_message?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          group_jid?: string
          id?: string
          link_removal_override?: boolean | null
          member_count?: number | null
          name?: string | null
          rules?: string | null
          session_id?: string
          updated_at?: string
          warnings_enabled_override?: boolean | null
          welcome_enabled_override?: boolean | null
          welcome_message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_groups_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_logs: {
        Row: {
          created_at: string
          group_jid: string | null
          id: string
          kind: string
          payload: Json | null
          session_id: string
          user_jid: string | null
        }
        Insert: {
          created_at?: string
          group_jid?: string | null
          id?: string
          kind: string
          payload?: Json | null
          session_id: string
          user_jid?: string | null
        }
        Update: {
          created_at?: string
          group_jid?: string | null
          id?: string
          kind?: string
          payload?: Json | null
          session_id?: string
          user_jid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bot_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_menus: {
        Row: {
          active: boolean
          created_at: string
          group_jid: string | null
          id: string
          items: Json
          kind: string
          name: string
          session_id: string
          trigger: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          group_jid?: string | null
          id?: string
          items?: Json
          kind?: string
          name: string
          session_id: string
          trigger: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          group_jid?: string | null
          id?: string
          items?: Json
          kind?: string
          name?: string
          session_id?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_menus_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_warnings: {
        Row: {
          banned_at: string | null
          count: number
          created_at: string
          expires_at: string | null
          group_jid: string
          id: string
          last_at: string
          reason: string | null
          session_id: string
          user_jid: string
        }
        Insert: {
          banned_at?: string | null
          count?: number
          created_at?: string
          expires_at?: string | null
          group_jid: string
          id?: string
          last_at?: string
          reason?: string | null
          session_id: string
          user_jid: string
        }
        Update: {
          banned_at?: string | null
          count?: number
          created_at?: string
          expires_at?: string | null
          group_jid?: string
          id?: string
          last_at?: string
          reason?: string | null
          session_id?: string
          user_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_warnings_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      business_api_keys: {
        Row: {
          allowed_ips: string[]
          business_id: string
          created_at: string
          id: string
          key_hash: string
          key_prefix: string
          label: string
          last_used_at: string | null
          mode: string
          rate_limit_per_min: number
          revoked_at: string | null
          scopes: string[]
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          allowed_ips?: string[]
          business_id: string
          created_at?: string
          id?: string
          key_hash: string
          key_prefix: string
          label?: string
          last_used_at?: string | null
          mode?: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          allowed_ips?: string[]
          business_id?: string
          created_at?: string
          id?: string
          key_hash?: string
          key_prefix?: string
          label?: string
          last_used_at?: string | null
          mode?: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_api_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_api_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      business_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string | null
          created_at: string
          id: string
          ip: unknown
          metadata: Json
          target: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          target?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string | null
          created_at?: string
          id?: string
          ip?: unknown
          metadata?: Json
          target?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_audit_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      business_posts: {
        Row: {
          body: string | null
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          product_id: string | null
          published: boolean
          published_at: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          product_id?: string | null
          published?: boolean
          published_at?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          product_id?: string | null
          published?: boolean
          published_at?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_posts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_posts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          balance: number
          contact_email: string | null
          contact_phone: string | null
          country: string
          cover_url: string | null
          created_at: string
          description: string | null
          fee_bps: number
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          tagline: string | null
          template_id: string | null
          theme: Json
          updated_at: string
        }
        Insert: {
          balance?: number
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          fee_bps?: number
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          tagline?: string | null
          template_id?: string | null
          theme?: Json
          updated_at?: string
        }
        Update: {
          balance?: number
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          fee_bps?: number
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          tagline?: string | null
          template_id?: string | null
          theme?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "shop_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          auto_frozen_at: string | null
          balance: number
          brand: string | null
          created_at: string
          currency: string
          failed_attempts: number
          id: string
          last4: string | null
          metadata: Json | null
          provider: string
          provider_card_id: string | null
          status: string
          total_funded_usd: number
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_frozen_at?: string | null
          balance?: number
          brand?: string | null
          created_at?: string
          currency?: string
          failed_attempts?: number
          id?: string
          last4?: string | null
          metadata?: Json | null
          provider?: string
          provider_card_id?: string | null
          status?: string
          total_funded_usd?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          auto_frozen_at?: string | null
          balance?: number
          brand?: string | null
          created_at?: string
          currency?: string
          failed_attempts?: number
          id?: string
          last4?: string | null
          metadata?: Json | null
          provider?: string
          provider_card_id?: string | null
          status?: string
          total_funded_usd?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coach_messages: {
        Row: {
          business_id: string
          content: string
          created_at: string
          id: string
          kind: string
          metadata: Json
          project_id: string | null
          read_at: string | null
          role: string
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          project_id?: string | null
          read_at?: string | null
          role?: string
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          project_id?: string | null
          read_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "coach_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coach_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_templates: {
        Row: {
          business_id: string
          content: string
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
          variables: string[]
        }
        Insert: {
          business_id: string
          content: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
          variables?: string[]
        }
        Update: {
          business_id?: string
          content?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
          variables?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "contract_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          amount: number | null
          business_id: string
          client_email: string | null
          client_name: string | null
          client_phone: string | null
          content: string
          created_at: string
          currency: string | null
          id: string
          kind: string
          number: string
          sent_at: string | null
          signed_at: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          variables: Json
        }
        Insert: {
          amount?: number | null
          business_id: string
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          content: string
          created_at?: string
          currency?: string | null
          id?: string
          kind?: string
          number: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          amount?: number | null
          business_id?: string
          client_email?: string | null
          client_name?: string | null
          client_phone?: string | null
          content?: string
          created_at?: string
          currency?: string | null
          id?: string
          kind?: string
          number?: string
          sent_at?: string | null
          signed_at?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: [
          {
            foreignKeyName: "contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_ai_conversations: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dashboard_ai_messages: {
        Row: {
          chart: Json | null
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          chart?: Json | null
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          chart?: Json | null
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dashboard_ai_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_campaigns: {
        Row: {
          business_id: string
          created_at: string
          currency: string | null
          daily_budget: number | null
          id: string
          insights: Json | null
          integration_id: string | null
          last_synced_at: string | null
          meta_campaign_id: string | null
          name: string
          objective: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          id?: string
          insights?: Json | null
          integration_id?: string | null
          last_synced_at?: string | null
          meta_campaign_id?: string | null
          name: string
          objective?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string | null
          daily_budget?: number | null
          id?: string
          insights?: Json | null
          integration_id?: string | null
          last_synced_at?: string | null
          meta_campaign_id?: string | null
          name?: string
          objective?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_campaigns_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_campaigns_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "facebook_integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      facebook_integrations: {
        Row: {
          access_token: string
          ad_account_id: string | null
          business_id: string
          created_at: string
          expires_at: string | null
          id: string
          meta_user_id: string | null
          page_id: string | null
          page_name: string | null
          scopes: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          ad_account_id?: string | null
          business_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          meta_user_id?: string | null
          page_id?: string | null
          page_name?: string | null
          scopes?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          ad_account_id?: string | null
          business_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          meta_user_id?: string | null
          page_id?: string | null
          page_name?: string | null
          scopes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "facebook_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "facebook_integrations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_transfers: {
        Row: {
          amount: number
          claimed_at: string | null
          created_at: string
          currency: string
          id: string
          note: string | null
          recipient_id: string | null
          recipient_name: string | null
          recipient_phone: string
          reference: string | null
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          claimed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_phone: string
          reference?: string | null
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          claimed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          note?: string | null
          recipient_id?: string | null
          recipient_name?: string | null
          recipient_phone?: string
          reference?: string | null
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          id: string
          items: Json
          kind: string
          number: string
          payment_id: string | null
          pdf_url: string | null
          project_id: string | null
          status: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          kind?: string
          number: string
          payment_id?: string | null
          pdf_url?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          id?: string
          items?: Json
          kind?: string
          number?: string
          payment_id?: string | null
          pdf_url?: string | null
          project_id?: string | null
          status?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_link_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
      momo_transfers: {
        Row: {
          admin_note: string | null
          amount_send: number
          cashout_ref: string | null
          cashout_response: Json | null
          checkout_url: string | null
          created_at: string
          currency: string
          delivered_at: string | null
          dest_holder: string | null
          dest_operator: string
          dest_phone: string
          fees_xof: number
          id: string
          metadata: Json
          paid_at: string | null
          payment_intent_id: string | null
          payment_reference: string | null
          source_operator: string
          source_phone: string | null
          status: string
          total_charged_xof: number
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_send: number
          cashout_ref?: string | null
          cashout_response?: Json | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          dest_holder?: string | null
          dest_operator: string
          dest_phone: string
          fees_xof?: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_reference?: string | null
          source_operator: string
          source_phone?: string | null
          status?: string
          total_charged_xof: number
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_send?: number
          cashout_ref?: string | null
          cashout_response?: Json | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          delivered_at?: string | null
          dest_holder?: string | null
          dest_operator?: string
          dest_phone?: string
          fees_xof?: number
          id?: string
          metadata?: Json
          paid_at?: string | null
          payment_intent_id?: string | null
          payment_reference?: string | null
          source_operator?: string
          source_phone?: string | null
          status?: string
          total_charged_xof?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          name: string
          order_id: string
          product_id: string | null
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_id: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_id?: string
          product_id?: string | null
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          business_id: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_note: string | null
          customer_phone: string | null
          id: string
          merchant_note: string | null
          metadata: Json | null
          order_number: string
          paid_at: string | null
          public_token: string
          shipping_address: string | null
          status: Database["public"]["Enums"]["order_status"]
          total_amount: number
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          id?: string
          merchant_note?: string | null
          metadata?: Json | null
          order_number: string
          paid_at?: string | null
          public_token?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_note?: string | null
          customer_phone?: string | null
          id?: string
          merchant_note?: string | null
          metadata?: Json | null
          order_number?: string
          paid_at?: string | null
          public_token?: string
          shipping_address?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_link_payments: {
        Row: {
          amount: number
          business_id: string
          created_at: string
          currency: string
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          fee_amount: number
          id: string
          ip: unknown
          link_id: string | null
          metadata: Json | null
          net_amount: number
          order_id: string | null
          paid_at: string | null
          payment_intent_id: string | null
          product_id: string | null
          project_id: string | null
          provider: string
          provider_ref: string | null
          receipt_sent_at: string | null
          receipt_url: string | null
          reference: string
          status: Database["public"]["Enums"]["payment_link_payment_status"]
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          amount: number
          business_id: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          fee_amount?: number
          id?: string
          ip?: unknown
          link_id?: string | null
          metadata?: Json | null
          net_amount?: number
          order_id?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          product_id?: string | null
          project_id?: string | null
          provider?: string
          provider_ref?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          reference: string
          status?: Database["public"]["Enums"]["payment_link_payment_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          amount?: number
          business_id?: string
          created_at?: string
          currency?: string
          customer_email?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          fee_amount?: number
          id?: string
          ip?: unknown
          link_id?: string | null
          metadata?: Json | null
          net_amount?: number
          order_id?: string | null
          paid_at?: string | null
          payment_intent_id?: string | null
          product_id?: string | null
          project_id?: string | null
          provider?: string
          provider_ref?: string | null
          receipt_sent_at?: string | null
          receipt_url?: string | null
          reference?: string
          status?: Database["public"]["Enums"]["payment_link_payment_status"]
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_link_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_payments_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "payment_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_payments_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_link_payments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_links: {
        Row: {
          amount: number | null
          business_id: string
          callback_url: string | null
          channel: string
          created_at: string
          currency: string
          description: string | null
          id: string
          max_amount: number | null
          min_amount: number | null
          product_id: string | null
          project_id: string | null
          redirect_url: string | null
          slug: string
          status: Database["public"]["Enums"]["payment_link_status"]
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          business_id: string
          callback_url?: string | null
          channel?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          product_id?: string | null
          project_id?: string | null
          redirect_url?: string | null
          slug: string
          status?: Database["public"]["Enums"]["payment_link_status"]
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          business_id?: string
          callback_url?: string | null
          channel?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          max_amount?: number | null
          min_amount?: number | null
          product_id?: string | null
          project_id?: string | null
          redirect_url?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["payment_link_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      phone_otp: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_config: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      product_downloads: {
        Row: {
          access_token: string
          business_id: string
          created_at: string
          customer_email: string | null
          customer_name: string | null
          download_limit: number | null
          downloads_used: number
          expires_at: string | null
          file_name: string | null
          file_url: string
          id: string
          last_downloaded_at: string | null
          order_id: string | null
          payment_id: string | null
          product_id: string | null
          product_name: string
          updated_at: string
        }
        Insert: {
          access_token: string
          business_id: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          download_limit?: number | null
          downloads_used?: number
          expires_at?: string | null
          file_name?: string | null
          file_url: string
          id?: string
          last_downloaded_at?: string | null
          order_id?: string | null
          payment_id?: string | null
          product_id?: string | null
          product_name: string
          updated_at?: string
        }
        Update: {
          access_token?: string
          business_id?: string
          created_at?: string
          customer_email?: string | null
          customer_name?: string | null
          download_limit?: number | null
          downloads_used?: number
          expires_at?: string | null
          file_name?: string | null
          file_url?: string
          id?: string
          last_downloaded_at?: string | null
          order_id?: string | null
          payment_id?: string | null
          product_id?: string | null
          product_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_downloads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_downloads_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_downloads_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_downloads_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payment_link_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_downloads_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          type: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          product_id: string
          type?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          access_instructions: string | null
          business_id: string
          created_at: string
          currency: string
          description: string | null
          download_expiry_days: number | null
          download_limit: number | null
          download_name: string | null
          download_url: string | null
          downloadable: boolean
          id: string
          image_url: string | null
          manage_stock: boolean
          name: string
          price: number
          project_id: string | null
          purchase_note: string | null
          sale_price: number | null
          short_description: string | null
          show_in_shop: boolean
          sku: string | null
          slug: string
          status: string
          stock: number | null
          tax_rate: number
          type: string
          updated_at: string
          weight: number | null
        }
        Insert: {
          access_instructions?: string | null
          business_id: string
          created_at?: string
          currency?: string
          description?: string | null
          download_expiry_days?: number | null
          download_limit?: number | null
          download_name?: string | null
          download_url?: string | null
          downloadable?: boolean
          id?: string
          image_url?: string | null
          manage_stock?: boolean
          name: string
          price?: number
          project_id?: string | null
          purchase_note?: string | null
          sale_price?: number | null
          short_description?: string | null
          show_in_shop?: boolean
          sku?: string | null
          slug: string
          status?: string
          stock?: number | null
          tax_rate?: number
          type?: string
          updated_at?: string
          weight?: number | null
        }
        Update: {
          access_instructions?: string | null
          business_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          download_expiry_days?: number | null
          download_limit?: number | null
          download_name?: string | null
          download_url?: string | null
          downloadable?: boolean
          id?: string
          image_url?: string | null
          manage_stock?: boolean
          name?: string
          price?: number
          project_id?: string | null
          purchase_note?: string | null
          sale_price?: number | null
          short_description?: string | null
          show_in_shop?: boolean
          sku?: string | null
          slug?: string
          status?: string
          stock?: number | null
          tax_rate?: number
          type?: string
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          referral_code: string | null
          referrer_code: string | null
          strowallet_customer_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          referral_code?: string | null
          referrer_code?: string | null
          strowallet_customer_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          referral_code?: string | null
          referrer_code?: string | null
          strowallet_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      project_api_keys: {
        Row: {
          business_id: string
          created_at: string
          id: string
          last_used_at: string | null
          mode: string
          project_id: string
          public_key: string
          revoked_at: string | null
          secret_hash: string
          secret_prefix: string
          updated_at: string
          webhook_secret: string
          webhook_url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          mode?: string
          project_id: string
          public_key: string
          revoked_at?: string | null
          secret_hash: string
          secret_prefix: string
          updated_at?: string
          webhook_secret: string
          webhook_url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          last_used_at?: string | null
          mode?: string
          project_id?: string
          public_key?: string
          revoked_at?: string | null
          secret_hash?: string
          secret_prefix?: string
          updated_at?: string
          webhook_secret?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_api_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_api_keys_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_api_keys_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_webhook_deliveries: {
        Row: {
          business_id: string
          created_at: string
          error: string | null
          event: string
          id: string
          payload: Json
          project_id: string
          response_body: string | null
          simulated: boolean
          status_code: number | null
          success: boolean
          url: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          error?: string | null
          event: string
          id?: string
          payload?: Json
          project_id: string
          response_body?: string | null
          simulated?: boolean
          status_code?: number | null
          success?: boolean
          url?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          error?: string | null
          event?: string
          id?: string
          payload?: Json
          project_id?: string
          response_body?: string | null
          simulated?: boolean
          status_code?: number | null
          success?: boolean
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_webhook_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_webhook_deliveries_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_webhook_deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          balance: number
          business_id: string
          cover_url: string | null
          created_at: string
          currency: string
          description: string | null
          financial_goal: number
          goal_deadline: string | null
          id: string
          logo_url: string | null
          name: string
          show_in_shop: boolean
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          balance?: number
          business_id: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          financial_goal?: number
          goal_deadline?: string | null
          id?: string
          logo_url?: string | null
          name: string
          show_in_shop?: boolean
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          balance?: number
          business_id?: string
          cover_url?: string | null
          created_at?: string
          currency?: string
          description?: string | null
          financial_goal?: number
          goal_deadline?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          show_in_shop?: boolean
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          keys: Json
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          keys: Json
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          keys?: Json
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          bucket: string
          hit_at: string
          id: number
          ip: string
        }
        Insert: {
          bucket: string
          hit_at?: string
          id?: number
          ip: string
        }
        Update: {
          bucket?: string
          hit_at?: string
          id?: number
          ip?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          cards_rewarded: number
          created_at: string
          id: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status: string
          total_reward_xof: number
        }
        Insert: {
          cards_rewarded?: number
          created_at?: string
          id?: string
          referral_code: string
          referred_id: string
          referrer_id: string
          status?: string
          total_reward_xof?: number
        }
        Update: {
          cards_rewarded?: number
          created_at?: string
          id?: string
          referral_code?: string
          referred_id?: string
          referrer_id?: string
          status?: string
          total_reward_xof?: number
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          details: Json | null
          id: number
          ip: string | null
          kind: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          id?: number
          ip?: string | null
          kind: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          id?: number
          ip?: string | null
          kind?: string
          user_id?: string | null
        }
        Relationships: []
      }
      shop_templates: {
        Row: {
          category: string | null
          config: Json | null
          created_at: string | null
          description: string | null
          id: string
          is_free: boolean | null
          name: string
          preview_url: string | null
          price: number | null
          slug: string
          thumbnail_url: string | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          name: string
          preview_url?: string | null
          price?: number | null
          slug: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          config?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          name?: string
          preview_url?: string | null
          price?: number | null
          slug?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      sms_config: {
        Row: {
          admin_phones: string[]
          created_at: string
          daily_limit: number
          enabled: boolean
          event_card_recharge: boolean
          event_wallet_recharge: boolean
          event_withdrawal: boolean
          event_withdrawal_paid: boolean
          id: string
          notify_admin: boolean
          sender_id: string
          updated_at: string
        }
        Insert: {
          admin_phones?: string[]
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          event_card_recharge?: boolean
          event_wallet_recharge?: boolean
          event_withdrawal?: boolean
          event_withdrawal_paid?: boolean
          id?: string
          notify_admin?: boolean
          sender_id?: string
          updated_at?: string
        }
        Update: {
          admin_phones?: string[]
          created_at?: string
          daily_limit?: number
          enabled?: boolean
          event_card_recharge?: boolean
          event_wallet_recharge?: boolean
          event_withdrawal?: boolean
          event_withdrawal_paid?: boolean
          id?: string
          notify_admin?: boolean
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_contacts: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_credits: {
        Row: {
          balance: number
          business_id: string
          created_at: string
          id: string
          sender_id: string
          total_purchased: number
          total_used: number
          updated_at: string
        }
        Insert: {
          balance?: number
          business_id: string
          created_at?: string
          id?: string
          sender_id: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          business_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          total_purchased?: number
          total_used?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_credits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_credits_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_logs: {
        Row: {
          created_at: string
          error: string | null
          event_key: string | null
          id: string
          message: string
          provider_response: Json | null
          provider_uid: string | null
          recipient: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_key?: string | null
          id?: string
          message: string
          provider_response?: Json | null
          provider_uid?: string | null
          recipient: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          event_key?: string | null
          id?: string
          message?: string
          provider_response?: Json | null
          provider_uid?: string | null
          recipient?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      sms_sender_requests: {
        Row: {
          admin_note: string | null
          business_id: string | null
          company_name: string
          created_at: string
          id: string
          sender_id: string
          status: string
          updated_at: string
          usage_note: string | null
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          business_id?: string | null
          company_name: string
          created_at?: string
          id?: string
          sender_id: string
          status?: string
          updated_at?: string
          usage_note?: string | null
          user_id: string
        }
        Update: {
          admin_note?: string | null
          business_id?: string | null
          company_name?: string
          created_at?: string
          id?: string
          sender_id?: string
          status?: string
          updated_at?: string
          usage_note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_sender_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_sender_requests_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          body: string
          created_at: string
          enabled: boolean
          event_key: string
          id: string
          label: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          enabled?: boolean
          event_key: string
          id?: string
          label: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          enabled?: boolean
          event_key?: string
          id?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_items: {
        Row: {
          alert_threshold: number
          business_id: string
          created_at: string
          id: string
          image_url: string | null
          is_active: boolean
          linked_product_id: string | null
          name: string
          purchase_price: number
          sale_price: number
          sku: string | null
          stock_qty: number
          unit: string
          updated_at: string
        }
        Insert: {
          alert_threshold?: number
          business_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          linked_product_id?: string | null
          name: string
          purchase_price?: number
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          alert_threshold?: number
          business_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          linked_product_id?: string | null
          name?: string
          purchase_price?: number
          sale_price?: number
          sku?: string | null
          stock_qty?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_linked_product_id_fkey"
            columns: ["linked_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          business_id: string
          created_at: string
          id: string
          item_id: string
          kind: string
          note: string | null
          qty: number
          related_entry_id: string | null
          unit_cost: number | null
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          item_id: string
          kind: string
          note?: string | null
          qty: number
          related_entry_id?: string | null
          unit_cost?: number | null
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          item_id?: string
          kind?: string
          note?: string | null
          qty?: number
          related_entry_id?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_related_entry_id_fkey"
            columns: ["related_entry_id"]
            isOneToOne: false
            referencedRelation: "accounting_entries"
            referencedColumns: ["id"]
          },
        ]
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
      user_otp: {
        Row: {
          code: string
          created_at: string | null
          expires_at: string
          id: string
          phone: string
          purpose: string
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          expires_at: string
          id?: string
          phone: string
          purpose: string
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          user_id?: string | null
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
      whatsapp_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload?: Json
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_outbound: {
        Row: {
          body: string
          created_at: string
          error: string | null
          id: string
          sent_at: string | null
          session_id: string
          status: string
          to_jid: string
        }
        Insert: {
          body: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          session_id: string
          status?: string
          to_jid: string
        }
        Update: {
          body?: string
          created_at?: string
          error?: string | null
          id?: string
          sent_at?: string | null
          session_id?: string
          status?: string
          to_jid?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_outbound_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          business_id: string
          connection_secret: string
          created_at: string
          id: string
          last_seen_at: string | null
          phone_number: string | null
          qr_data_url: string | null
          status: string
          updated_at: string
          worker_version: string | null
        }
        Insert: {
          business_id: string
          connection_secret: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          phone_number?: string | null
          qr_data_url?: string | null
          status?: string
          updated_at?: string
          worker_version?: string | null
        }
        Update: {
          business_id?: string
          connection_secret?: string
          created_at?: string
          id?: string
          last_seen_at?: string | null
          phone_number?: string | null
          qr_data_url?: string | null
          status?: string
          updated_at?: string
          worker_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_sessions_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "public_business_view"
            referencedColumns: ["id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount: number
          created_at: string
          currency: string
          destination: Json
          failure_reason: string | null
          id: string
          method: string
          paid_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount: number
          created_at?: string
          currency?: string
          destination?: Json
          failure_reason?: string | null
          id?: string
          method: string
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount?: number
          created_at?: string
          currency?: string
          destination?: Json
          failure_reason?: string | null
          id?: string
          method?: string
          paid_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_business_view: {
        Row: {
          country: string | null
          description: string | null
          id: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
          status: Database["public"]["Enums"]["business_status"] | null
        }
        Insert: {
          country?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["business_status"] | null
        }
        Update: {
          country?: string | null
          description?: string | null
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
          status?: Database["public"]["Enums"]["business_status"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_contract_number: { Args: never; Returns: string }
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_bf_phone: { Args: { input: string }; Returns: string }
      purge_rate_limit_hits: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "user"
      business_status: "pending" | "active" | "suspended"
      order_status:
        | "pending_payment"
        | "paid"
        | "preparing"
        | "shipped"
        | "delivered"
        | "cancelled"
        | "refunded"
      payment_link_payment_status: "pending" | "success" | "failed" | "expired"
      payment_link_status: "active" | "paused" | "archived"
      tx_status: "pending" | "success" | "failed" | "cancelled"
      tx_type:
        | "deposit"
        | "withdrawal"
        | "card_issue"
        | "card_fund"
        | "fee"
        | "refund"
        | "transfer"
        | "withdrawal_refund"
        | "card_auto_freeze"
        | "card_fee"
        | "card_tx"
        | "card_withdraw"
        | "card_terminated"
        | "referral_reward"
        | "admin_credit"
        | "admin_debit"
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
      business_status: ["pending", "active", "suspended"],
      order_status: [
        "pending_payment",
        "paid",
        "preparing",
        "shipped",
        "delivered",
        "cancelled",
        "refunded",
      ],
      payment_link_payment_status: ["pending", "success", "failed", "expired"],
      payment_link_status: ["active", "paused", "archived"],
      tx_status: ["pending", "success", "failed", "cancelled"],
      tx_type: [
        "deposit",
        "withdrawal",
        "card_issue",
        "card_fund",
        "fee",
        "refund",
        "transfer",
        "withdrawal_refund",
        "card_auto_freeze",
        "card_fee",
        "card_tx",
        "card_withdraw",
        "card_terminated",
        "referral_reward",
        "admin_credit",
        "admin_debit",
      ],
    },
  },
} as const
