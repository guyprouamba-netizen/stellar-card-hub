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
          created_at: string
          description: string | null
          fee_bps: number
          id: string
          logo_url: string | null
          name: string
          owner_id: string
          slug: string
          status: Database["public"]["Enums"]["business_status"]
          updated_at: string
        }
        Insert: {
          balance?: number
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          description?: string | null
          fee_bps?: number
          id?: string
          logo_url?: string | null
          name: string
          owner_id: string
          slug: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Update: {
          balance?: number
          contact_email?: string | null
          contact_phone?: string | null
          country?: string
          created_at?: string
          description?: string | null
          fee_bps?: number
          id?: string
          logo_url?: string | null
          name?: string
          owner_id?: string
          slug?: string
          status?: Database["public"]["Enums"]["business_status"]
          updated_at?: string
        }
        Relationships: []
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
          link_id: string
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
          link_id: string
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
          link_id?: string
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
          business_id: string
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number
          project_id: string
          sku: string | null
          slug: string
          status: string
          stock: number | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          project_id: string
          sku?: string | null
          slug: string
          status?: string
          stock?: number | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          project_id?: string
          sku?: string | null
          slug?: string
          status?: string
          stock?: number | null
          updated_at?: string
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
          referral_code?: string | null
          referrer_code?: string | null
          strowallet_customer_id?: string | null
          updated_at?: string
        }
        Relationships: []
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
      generate_order_number: { Args: never; Returns: string }
      generate_referral_code: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
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
      ],
    },
  },
} as const
