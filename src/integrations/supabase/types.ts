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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_logs: {
        Row: {
          action: string
          admin_email: string | null
          admin_user_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: []
      }
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ai_cost_rates: {
        Row: {
          cost_brl: number
          cost_usd: number
          created_at: string
          credits: number
          id: string
          is_active: boolean
          key: string
          kind: string
          label: string
          model: string | null
          notes: string | null
          price_brl: number
          provider: string
          unit: string
          updated_at: string
        }
        Insert: {
          cost_brl?: number
          cost_usd?: number
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          key: string
          kind?: string
          label: string
          model?: string | null
          notes?: string | null
          price_brl?: number
          provider?: string
          unit?: string
          updated_at?: string
        }
        Update: {
          cost_brl?: number
          cost_usd?: number
          created_at?: string
          credits?: number
          id?: string
          is_active?: boolean
          key?: string
          kind?: string
          label?: string
          model?: string | null
          notes?: string | null
          price_brl?: number
          provider?: string
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          cost_brl: number
          cost_usd: number
          created_at: string
          credits: number
          id: string
          kind: string
          metadata: Json
          model: string | null
          provider: string | null
          quantity: number
          rate_key: string | null
          reference_id: string | null
          user_id: string | null
        }
        Insert: {
          cost_brl?: number
          cost_usd?: number
          created_at?: string
          credits?: number
          id?: string
          kind?: string
          metadata?: Json
          model?: string | null
          provider?: string | null
          quantity?: number
          rate_key?: string | null
          reference_id?: string | null
          user_id?: string | null
        }
        Update: {
          cost_brl?: number
          cost_usd?: number
          created_at?: string
          credits?: number
          id?: string
          kind?: string
          metadata?: Json
          model?: string | null
          provider?: string | null
          quantity?: number
          rate_key?: string | null
          reference_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      app_errors: {
        Row: {
          created_at: string
          details: Json
          id: string
          kind: string
          message: string
          resolved: boolean
          resolved_at: string | null
          route: string | null
          severity: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          details?: Json
          id?: string
          kind: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          route?: string | null
          severity?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          route?: string | null
          severity?: string
          user_id?: string | null
        }
        Relationships: []
      }
      automatic_sales: {
        Row: {
          amount: number
          created_at: string
          end_at: string | null
          id: string
          interval_minutes: number
          product_id: string | null
          quantity: number
          start_at: string | null
          status: string
          target_user_id: string | null
        }
        Insert: {
          amount?: number
          created_at?: string
          end_at?: string | null
          id?: string
          interval_minutes?: number
          product_id?: string | null
          quantity?: number
          start_at?: string | null
          status?: string
          target_user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          end_at?: string | null
          id?: string
          interval_minutes?: number
          product_id?: string | null
          quantity?: number
          start_at?: string | null
          status?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automatic_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_product_compliance: {
        Row: {
          anatel_manufacturer: string | null
          anatel_model: string | null
          anatel_registration_id: string | null
          anvisa_code: string | null
          blockers: Json | null
          checked_at: string | null
          data_updated_at: string
          gtin: string | null
          has_radio: boolean | null
          inmetro_code: string | null
          manufacturer: string | null
          model: string | null
          part_number: string | null
          product_id: string
          publish_status: string
          shopee_attributes: Json | null
          shopee_category_id: number | null
          shopee_reference: Json | null
          size_chart_image_url: string | null
          size_chart_template_name: string | null
          suggested_category_id: number | null
          updated_at: string
          warnings: Json | null
        }
        Insert: {
          anatel_manufacturer?: string | null
          anatel_model?: string | null
          anatel_registration_id?: string | null
          anvisa_code?: string | null
          blockers?: Json | null
          checked_at?: string | null
          data_updated_at?: string
          gtin?: string | null
          has_radio?: boolean | null
          inmetro_code?: string | null
          manufacturer?: string | null
          model?: string | null
          part_number?: string | null
          product_id: string
          publish_status?: string
          shopee_attributes?: Json | null
          shopee_category_id?: number | null
          shopee_reference?: Json | null
          size_chart_image_url?: string | null
          size_chart_template_name?: string | null
          suggested_category_id?: number | null
          updated_at?: string
          warnings?: Json | null
        }
        Update: {
          anatel_manufacturer?: string | null
          anatel_model?: string | null
          anatel_registration_id?: string | null
          anvisa_code?: string | null
          blockers?: Json | null
          checked_at?: string | null
          data_updated_at?: string
          gtin?: string | null
          has_radio?: boolean | null
          inmetro_code?: string | null
          manufacturer?: string | null
          model?: string | null
          part_number?: string | null
          product_id?: string
          publish_status?: string
          shopee_attributes?: Json | null
          shopee_category_id?: number | null
          shopee_reference?: Json | null
          size_chart_image_url?: string | null
          size_chart_template_name?: string | null
          suggested_category_id?: number | null
          updated_at?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      catalog_snapshot: {
        Row: {
          body: string | null
          built_at: string | null
          changed_at: string
          id: string
        }
        Insert: {
          body?: string | null
          built_at?: string | null
          changed_at?: string
          id?: string
        }
        Update: {
          body?: string | null
          built_at?: string | null
          changed_at?: string
          id?: string
        }
        Relationships: []
      }
      coupon_offers: {
        Row: {
          code: string
          created_at: string
          is_active: boolean
          owner_user_id: string | null
          total_slots: number
        }
        Insert: {
          code: string
          created_at?: string
          is_active?: boolean
          owner_user_id?: string | null
          total_slots?: number
        }
        Update: {
          code?: string
          created_at?: string
          is_active?: boolean
          owner_user_id?: string | null
          total_slots?: number
        }
        Relationships: []
      }
      coupon_slot_claims: {
        Row: {
          claim_key: string
          code: string
          created_at: string
          id: string
          user_id: string | null
        }
        Insert: {
          claim_key: string
          code: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Update: {
          claim_key?: string
          code?: string
          created_at?: string
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_slot_claims_code_fkey"
            columns: ["code"]
            isOneToOne: false
            referencedRelation: "coupon_offers"
            referencedColumns: ["code"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string | null
          id: string
          sale_id: string | null
          used_at: string
          user_id: string | null
        }
        Insert: {
          coupon_id?: string | null
          id?: string
          sale_id?: string | null
          used_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_id?: string | null
          id?: string
          sale_id?: string | null
          used_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          end_at: string | null
          id: string
          minimum_order_value: number
          start_at: string | null
          status: string
          updated_at: string
          usage_count: number
          usage_limit: number | null
          user_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          end_at?: string | null
          id?: string
          minimum_order_value?: number
          start_at?: string | null
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          user_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          end_at?: string | null
          id?: string
          minimum_order_value?: number
          start_at?: string | null
          status?: string
          updated_at?: string
          usage_count?: number
          usage_limit?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      creator_promotions: {
        Row: {
          commission: number | null
          coupon_id: string | null
          created_at: string
          creator_user_id: string | null
          end_at: string | null
          id: string
          influencer_id: string | null
          promotion_id: string | null
          start_at: string | null
          status: string
        }
        Insert: {
          commission?: number | null
          coupon_id?: string | null
          created_at?: string
          creator_user_id?: string | null
          end_at?: string | null
          id?: string
          influencer_id?: string | null
          promotion_id?: string | null
          start_at?: string | null
          status?: string
        }
        Update: {
          commission?: number | null
          coupon_id?: string | null
          created_at?: string
          creator_user_id?: string | null
          end_at?: string | null
          id?: string
          influencer_id?: string | null
          promotion_id?: string | null
          start_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_promotions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_promotions_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_packs: {
        Row: {
          bonus_credits: number
          created_at: string
          credits: number
          description: string | null
          highlight: boolean
          id: string
          is_active: boolean
          name: string
          price_brl: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name: string
          price_brl?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bonus_credits?: number
          created_at?: string
          credits?: number
          description?: string | null
          highlight?: boolean
          id?: string
          is_active?: boolean
          name?: string
          price_brl?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      facebook_groups: {
        Row: {
          created_at: string
          facebook_url: string
          heat: string
          id: string
          image_url: string | null
          is_active: boolean
          members_count: string | null
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          facebook_url: string
          heat?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          members_count?: string | null
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          facebook_url?: string
          heat?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          members_count?: string | null
          name?: string
          position?: number
        }
        Relationships: []
      }
      influencer_catalog: {
        Row: {
          character_prompt: string
          created_at: string
          id: string
          image_url: string
          is_active: boolean
          name: string
          negative_prompt: string
          reference_urls: string[]
          sort_order: number
          type: string
          updated_at: string
        }
        Insert: {
          character_prompt: string
          created_at?: string
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          negative_prompt?: string
          reference_urls?: string[]
          sort_order: number
          type?: string
          updated_at?: string
        }
        Update: {
          character_prompt?: string
          created_at?: string
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          negative_prompt?: string
          reference_urls?: string[]
          sort_order?: number
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      influencers: {
        Row: {
          accessories: string[] | null
          apparent_age: string | null
          body_type: string | null
          catalog_source_id: string | null
          character_dna: Json | null
          character_prompt: string | null
          clothing_items: string[] | null
          clothing_style: string | null
          color_palette: string | null
          created_at: string
          custom_scene: string | null
          default_scene: string | null
          expression: string | null
          eye_color: string | null
          eyebrow_style: string | null
          face_shape: string | null
          facial_features: string[] | null
          generation_metadata: Json | null
          hair_color: string | null
          hair_length: string | null
          hair_style: string | null
          hair_texture: string | null
          hand_accessories: string[] | null
          hand_shape: string | null
          height_type: string | null
          id: string
          identity_image_url: string | null
          identity_reference_urls: string[] | null
          keep_face: boolean
          keep_hair: boolean
          lighting: string | null
          lip_style: string | null
          main_niche: string | null
          makeup_style: string | null
          model_used: string | null
          nail_color: string | null
          nail_style: string | null
          name: string
          negative_prompt: string | null
          nose_style: string | null
          personality_traits: string[] | null
          photography_style: string | null
          pov_mode: boolean
          preservation_level: string | null
          quality_mode: string | null
          secondary_niches: string[] | null
          skin_tone: string | null
          source: string
          source_image_url: string | null
          time_of_day: string | null
          type: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          accessories?: string[] | null
          apparent_age?: string | null
          body_type?: string | null
          catalog_source_id?: string | null
          character_dna?: Json | null
          character_prompt?: string | null
          clothing_items?: string[] | null
          clothing_style?: string | null
          color_palette?: string | null
          created_at?: string
          custom_scene?: string | null
          default_scene?: string | null
          expression?: string | null
          eye_color?: string | null
          eyebrow_style?: string | null
          face_shape?: string | null
          facial_features?: string[] | null
          generation_metadata?: Json | null
          hair_color?: string | null
          hair_length?: string | null
          hair_style?: string | null
          hair_texture?: string | null
          hand_accessories?: string[] | null
          hand_shape?: string | null
          height_type?: string | null
          id?: string
          identity_image_url?: string | null
          identity_reference_urls?: string[] | null
          keep_face?: boolean
          keep_hair?: boolean
          lighting?: string | null
          lip_style?: string | null
          main_niche?: string | null
          makeup_style?: string | null
          model_used?: string | null
          nail_color?: string | null
          nail_style?: string | null
          name: string
          negative_prompt?: string | null
          nose_style?: string | null
          personality_traits?: string[] | null
          photography_style?: string | null
          pov_mode?: boolean
          preservation_level?: string | null
          quality_mode?: string | null
          secondary_niches?: string[] | null
          skin_tone?: string | null
          source?: string
          source_image_url?: string | null
          time_of_day?: string | null
          type?: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          accessories?: string[] | null
          apparent_age?: string | null
          body_type?: string | null
          catalog_source_id?: string | null
          character_dna?: Json | null
          character_prompt?: string | null
          clothing_items?: string[] | null
          clothing_style?: string | null
          color_palette?: string | null
          created_at?: string
          custom_scene?: string | null
          default_scene?: string | null
          expression?: string | null
          eye_color?: string | null
          eyebrow_style?: string | null
          face_shape?: string | null
          facial_features?: string[] | null
          generation_metadata?: Json | null
          hair_color?: string | null
          hair_length?: string | null
          hair_style?: string | null
          hair_texture?: string | null
          hand_accessories?: string[] | null
          hand_shape?: string | null
          height_type?: string | null
          id?: string
          identity_image_url?: string | null
          identity_reference_urls?: string[] | null
          keep_face?: boolean
          keep_hair?: boolean
          lighting?: string | null
          lip_style?: string | null
          main_niche?: string | null
          makeup_style?: string | null
          model_used?: string | null
          nail_color?: string | null
          nail_style?: string | null
          name?: string
          negative_prompt?: string | null
          nose_style?: string | null
          personality_traits?: string[] | null
          photography_style?: string | null
          pov_mode?: boolean
          preservation_level?: string | null
          quality_mode?: string | null
          secondary_niches?: string[] | null
          skin_tone?: string | null
          source?: string
          source_image_url?: string | null
          time_of_day?: string | null
          type?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "influencers_catalog_source_id_fkey"
            columns: ["catalog_source_id"]
            isOneToOne: false
            referencedRelation: "influencer_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_products: {
        Row: {
          id: string
          launch_id: string
          product_id: string
        }
        Insert: {
          id?: string
          launch_id: string
          product_id: string
        }
        Update: {
          id?: string
          launch_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "launch_products_launch_id_fkey"
            columns: ["launch_id"]
            isOneToOne: false
            referencedRelation: "launches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      launches: {
        Row: {
          banner_url: string | null
          created_at: string
          description: string | null
          end_at: string | null
          goal: number | null
          id: string
          landing_url: string | null
          name: string
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          goal?: number | null
          id?: string
          landing_url?: string | null
          name: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          created_at?: string
          description?: string | null
          end_at?: string | null
          goal?: number | null
          id?: string
          landing_url?: string | null
          name?: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      partner_coupons: {
        Row: {
          background_image: string | null
          banner_image: string | null
          code: string
          created_at: string
          description: string | null
          headline: string | null
          id: string
          partner_id: string
          primary_color: string | null
          secondary_color: string | null
          status: string
          theme_id: string | null
          updated_at: string
        }
        Insert: {
          background_image?: string | null
          banner_image?: string | null
          code: string
          created_at?: string
          description?: string | null
          headline?: string | null
          id?: string
          partner_id: string
          primary_color?: string | null
          secondary_color?: string | null
          status?: string
          theme_id?: string | null
          updated_at?: string
        }
        Update: {
          background_image?: string | null
          banner_image?: string | null
          code?: string
          created_at?: string
          description?: string | null
          headline?: string | null
          id?: string
          partner_id?: string
          primary_color?: string | null
          secondary_color?: string | null
          status?: string
          theme_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partner_coupons_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partner_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_profiles: {
        Row: {
          activated_at: string
          brand_color: string | null
          brand_logo: string | null
          brand_name: string | null
          brand_theme: Json
          checkout_lifetime_url: string | null
          checkout_monthly_url: string | null
          created_at: string
          email: string
          id: string
          legacy_slugs: string[]
          name: string
          notes: string | null
          sidebar_side: string
          slug: string | null
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          activated_at?: string
          brand_color?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          brand_theme?: Json
          checkout_lifetime_url?: string | null
          checkout_monthly_url?: string | null
          created_at?: string
          email: string
          id?: string
          legacy_slugs?: string[]
          name: string
          notes?: string | null
          sidebar_side?: string
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          activated_at?: string
          brand_color?: string | null
          brand_logo?: string | null
          brand_name?: string | null
          brand_theme?: Json
          checkout_lifetime_url?: string | null
          checkout_monthly_url?: string | null
          created_at?: string
          email?: string
          id?: string
          legacy_slugs?: string[]
          name?: string
          notes?: string | null
          sidebar_side?: string
          slug?: string | null
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      platform_recharges: {
        Row: {
          amount_brl: number
          created_at: string
          created_by: string | null
          credits: number
          description: string | null
          expires_at: string | null
          id: string
          occurred_at: string
          provider: string
        }
        Insert: {
          amount_brl?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          expires_at?: string | null
          id?: string
          occurred_at?: string
          provider?: string
        }
        Update: {
          amount_brl?: number
          created_at?: string
          created_by?: string | null
          credits?: number
          description?: string | null
          expires_at?: string | null
          id?: string
          occurred_at?: string
          provider?: string
        }
        Relationships: []
      }
      product_copies: {
        Row: {
          content: string
          created_at: string
          id: string
          position: number
          product_id: string
          title: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          position?: number
          product_id: string
          title: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_copies_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_import_jobs: {
        Row: {
          admin_user_id: string | null
          created_at: string
          failed_rows: number
          filename: string | null
          id: string
          imported_rows: number
          status: string
          total_rows: number
          warning_rows: number
        }
        Insert: {
          admin_user_id?: string | null
          created_at?: string
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_rows?: number
          status?: string
          total_rows?: number
          warning_rows?: number
        }
        Update: {
          admin_user_id?: string | null
          created_at?: string
          failed_rows?: number
          filename?: string | null
          id?: string
          imported_rows?: number
          status?: string
          total_rows?: number
          warning_rows?: number
        }
        Relationships: []
      }
      product_import_rows: {
        Row: {
          error: string | null
          id: string
          job_id: string
          product_id: string | null
          raw: Json
          row_number: number
          status: string
        }
        Insert: {
          error?: string | null
          id?: string
          job_id: string
          product_id?: string | null
          raw?: Json
          row_number?: number
          status?: string
        }
        Update: {
          error?: string | null
          id?: string
          job_id?: string
          product_id?: string | null
          raw?: Json
          row_number?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_import_rows_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "product_import_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          commission: number
          created_at: string
          created_by: string | null
          description: string | null
          description_key: string | null
          gallery_images: string[]
          id: string
          name: string
          price: number
          primary_image: string | null
          promo_price: number | null
          rating: number | null
          reviews_label: string | null
          sku: string | null
          sold_count: number
          status: string
          subcategory: string | null
          supplier_cost: number | null
          supplier_external_id: string | null
          supplier_source: string | null
          supplier_url: string | null
          tags: string[]
          updated_at: string
          url: string | null
          video_url: string | null
          viral_score: number
        }
        Insert: {
          brand?: string | null
          category?: string | null
          commission?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_key?: string | null
          gallery_images?: string[]
          id?: string
          name: string
          price?: number
          primary_image?: string | null
          promo_price?: number | null
          rating?: number | null
          reviews_label?: string | null
          sku?: string | null
          sold_count?: number
          status?: string
          subcategory?: string | null
          supplier_cost?: number | null
          supplier_external_id?: string | null
          supplier_source?: string | null
          supplier_url?: string | null
          tags?: string[]
          updated_at?: string
          url?: string | null
          video_url?: string | null
          viral_score?: number
        }
        Update: {
          brand?: string | null
          category?: string | null
          commission?: number
          created_at?: string
          created_by?: string | null
          description?: string | null
          description_key?: string | null
          gallery_images?: string[]
          id?: string
          name?: string
          price?: number
          primary_image?: string | null
          promo_price?: number | null
          rating?: number | null
          reviews_label?: string | null
          sku?: string | null
          sold_count?: number
          status?: string
          subcategory?: string | null
          supplier_cost?: number | null
          supplier_external_id?: string | null
          supplier_source?: string | null
          supplier_url?: string | null
          tags?: string[]
          updated_at?: string
          url?: string | null
          video_url?: string | null
          viral_score?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          last_seen_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      promotion_products: {
        Row: {
          id: string
          product_id: string
          promotion_id: string
        }
        Insert: {
          id?: string
          product_id: string
          promotion_id: string
        }
        Update: {
          id?: string
          product_id?: string
          promotion_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_products_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
        ]
      }
      promotions: {
        Row: {
          banner_url: string | null
          coupon_id: string | null
          created_at: string
          description: string | null
          discount_type: string | null
          discount_value: number | null
          end_at: string | null
          id: string
          kind: string
          name: string
          start_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          banner_url?: string | null
          coupon_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_at?: string | null
          id?: string
          kind?: string
          name: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          banner_url?: string | null
          coupon_id?: string | null
          created_at?: string
          description?: string | null
          discount_type?: string | null
          discount_value?: number | null
          end_at?: string | null
          id?: string
          kind?: string
          name?: string
          start_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotions_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount: number
          coupon_code: string | null
          created_at: string
          discount: number
          final_amount: number
          id: string
          product_id: string | null
          source: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount?: number
          coupon_code?: string | null
          created_at?: string
          discount?: number
          final_amount?: number
          id?: string
          product_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          coupon_code?: string | null
          created_at?: string
          discount?: number
          final_amount?: number
          id?: string
          product_id?: string | null
          source?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_month_products: {
        Row: {
          commission_brl: number
          gross_brl: number
          id: string
          month: string
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          commission_brl?: number
          gross_brl?: number
          id?: string
          month: string
          product_id: string
          quantity?: number
          unit_price?: number
        }
        Update: {
          commission_brl?: number
          gross_brl?: number
          id?: string
          month?: string
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_month_products_month_fkey"
            columns: ["month"]
            isOneToOne: false
            referencedRelation: "sales_months"
            referencedColumns: ["month"]
          },
          {
            foreignKeyName: "sales_month_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_months: {
        Row: {
          clicks: number
          commission_brl: number
          created_at: string
          data_source: string
          gross_brl: number
          is_current: boolean
          items: number
          month: string
          views: number
        }
        Insert: {
          clicks?: number
          commission_brl?: number
          created_at?: string
          data_source?: string
          gross_brl?: number
          is_current?: boolean
          items?: number
          month: string
          views?: number
        }
        Update: {
          clicks?: number
          commission_brl?: number
          created_at?: string
          data_source?: string
          gross_brl?: number
          is_current?: boolean
          items?: number
          month?: string
          views?: number
        }
        Relationships: []
      }
      saved_products: {
        Row: {
          created_at: string
          id: string
          product_data: Json
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_data?: Json
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_data?: Json
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      shopee_listings: {
        Row: {
          attributes: Json
          category_id: number | null
          category_name: string | null
          condition: string
          connection_id: string | null
          created_at: string
          description: string
          description_key: string | null
          description_len: number | null
          id: string
          images: string[]
          is_max_ad: boolean
          last_synced_at: string | null
          logistics: Json
          package_height: number | null
          package_length: number | null
          package_width: number | null
          price: number
          product_id: string
          promoted: boolean
          promoted_at: string | null
          published_at: string | null
          request_payload: Json | null
          response_payload: Json | null
          shopee_image_ids: string[]
          shopee_item_id: number | null
          shopee_link: string | null
          size_chart_url: string | null
          sku: string | null
          status: string
          status_detail: string | null
          stock: number
          title: string
          updated_at: string
          user_id: string
          variations: Json
          video_url: string | null
          weight: number | null
        }
        Insert: {
          attributes?: Json
          category_id?: number | null
          category_name?: string | null
          condition?: string
          connection_id?: string | null
          created_at?: string
          description?: string
          description_key?: string | null
          description_len?: number | null
          id?: string
          images?: string[]
          is_max_ad?: boolean
          last_synced_at?: string | null
          logistics?: Json
          package_height?: number | null
          package_length?: number | null
          package_width?: number | null
          price: number
          product_id: string
          promoted?: boolean
          promoted_at?: string | null
          published_at?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          shopee_image_ids?: string[]
          shopee_item_id?: number | null
          shopee_link?: string | null
          size_chart_url?: string | null
          sku?: string | null
          status?: string
          status_detail?: string | null
          stock?: number
          title: string
          updated_at?: string
          user_id: string
          variations?: Json
          video_url?: string | null
          weight?: number | null
        }
        Update: {
          attributes?: Json
          category_id?: number | null
          category_name?: string | null
          condition?: string
          connection_id?: string | null
          created_at?: string
          description?: string
          description_key?: string | null
          description_len?: number | null
          id?: string
          images?: string[]
          is_max_ad?: boolean
          last_synced_at?: string | null
          logistics?: Json
          package_height?: number | null
          package_length?: number | null
          package_width?: number | null
          price?: number
          product_id?: string
          promoted?: boolean
          promoted_at?: string | null
          published_at?: string | null
          request_payload?: Json | null
          response_payload?: Json | null
          shopee_image_ids?: string[]
          shopee_item_id?: number | null
          shopee_link?: string | null
          size_chart_url?: string | null
          sku?: string | null
          status?: string
          status_detail?: string | null
          stock?: number
          title?: string
          updated_at?: string
          user_id?: string
          variations?: Json
          video_url?: string | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shopee_listings_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shopee_shop_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shopee_listings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_oauth_states: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          state_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          state_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          state_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      shopee_orders: {
        Row: {
          buyer_label: string | null
          completed_time: string | null
          connection_id: string
          created_at: string
          created_time: string | null
          currency: string
          id: string
          items: Json
          order_sn: string
          raw_summary: Json
          status: string
          synced_at: string
          total_amount: number
          updated_at: string
          updated_time: string | null
          user_id: string
        }
        Insert: {
          buyer_label?: string | null
          completed_time?: string | null
          connection_id: string
          created_at?: string
          created_time?: string | null
          currency?: string
          id?: string
          items?: Json
          order_sn: string
          raw_summary?: Json
          status: string
          synced_at?: string
          total_amount?: number
          updated_at?: string
          updated_time?: string | null
          user_id: string
        }
        Update: {
          buyer_label?: string | null
          completed_time?: string | null
          connection_id?: string
          created_at?: string
          created_time?: string | null
          currency?: string
          id?: string
          items?: Json
          order_sn?: string
          raw_summary?: Json
          status?: string
          synced_at?: string
          total_amount?: number
          updated_at?: string
          updated_time?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_orders_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shopee_shop_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      shopee_publications: {
        Row: {
          attempts: number
          blockers: Json | null
          created_at: string
          item_id: number | null
          last_error: string | null
          product_id: string
          shop_id: number
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          blockers?: Json | null
          created_at?: string
          item_id?: number | null
          last_error?: string | null
          product_id: string
          shop_id: number
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          blockers?: Json | null
          created_at?: string
          item_id?: number | null
          last_error?: string | null
          product_id?: string
          shop_id?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shopee_shop_connections: {
        Row: {
          access_token: string
          alert_low_stock: boolean
          created_at: string
          id: string
          last_synced_at: string | null
          low_stock_threshold: number
          merchant_id: number | null
          pause_when_out_of_stock: boolean
          refresh_token: string
          refresh_token_expires_at: string | null
          region: string
          shop_id: number
          shop_name: string | null
          status: string
          sync_prices: boolean
          sync_stock: boolean
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          alert_low_stock?: boolean
          created_at?: string
          id?: string
          last_synced_at?: string | null
          low_stock_threshold?: number
          merchant_id?: number | null
          pause_when_out_of_stock?: boolean
          refresh_token: string
          refresh_token_expires_at?: string | null
          region?: string
          shop_id: number
          shop_name?: string | null
          status?: string
          sync_prices?: boolean
          sync_stock?: boolean
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          alert_low_stock?: boolean
          created_at?: string
          id?: string
          last_synced_at?: string | null
          low_stock_threshold?: number
          merchant_id?: number | null
          pause_when_out_of_stock?: boolean
          refresh_token?: string
          refresh_token_expires_at?: string | null
          region?: string
          shop_id?: number
          shop_name?: string | null
          status?: string
          sync_prices?: boolean
          sync_stock?: boolean
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shopee_sync_logs: {
        Row: {
          changed_count: number
          connection_id: string
          created_at: string
          details: Json
          error_count: number
          finished_at: string | null
          id: string
          message: string | null
          operation: string
          processed_count: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          changed_count?: number
          connection_id: string
          created_at?: string
          details?: Json
          error_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          operation: string
          processed_count?: number
          started_at?: string
          status: string
          user_id: string
        }
        Update: {
          changed_count?: number
          connection_id?: string
          created_at?: string
          details?: Json
          error_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          operation?: string
          processed_count?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopee_sync_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "shopee_shop_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_product_settings: {
        Row: {
          allow_repeat: boolean
          cooldown_seconds: number | null
          custom_commission: number | null
          custom_interval_max_seconds: number | null
          custom_interval_min_seconds: number | null
          custom_price: number | null
          enabled: boolean
          priority: string
          product_id: string
          quantity_max: number | null
          quantity_min: number | null
          updated_at: string
          weight: number
        }
        Insert: {
          allow_repeat?: boolean
          cooldown_seconds?: number | null
          custom_commission?: number | null
          custom_interval_max_seconds?: number | null
          custom_interval_min_seconds?: number | null
          custom_price?: number | null
          enabled?: boolean
          priority?: string
          product_id: string
          quantity_max?: number | null
          quantity_min?: number | null
          updated_at?: string
          weight?: number
        }
        Update: {
          allow_repeat?: boolean
          cooldown_seconds?: number | null
          custom_commission?: number | null
          custom_interval_max_seconds?: number | null
          custom_interval_min_seconds?: number | null
          custom_price?: number | null
          enabled?: boolean
          priority?: string
          product_id?: string
          quantity_max?: number | null
          quantity_min?: number | null
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_product_settings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_sales: {
        Row: {
          clicks_delta: number
          commission_value: number
          created_at: string
          gross_value: number
          id: string
          origin: string
          product_id: string | null
          product_image: string | null
          product_name: string
          quantity: number
          simulated: boolean
          unit_price: number
          views_delta: number
        }
        Insert: {
          clicks_delta?: number
          commission_value?: number
          created_at?: string
          gross_value?: number
          id?: string
          origin?: string
          product_id?: string | null
          product_image?: string | null
          product_name: string
          quantity?: number
          simulated?: boolean
          unit_price?: number
          views_delta?: number
        }
        Update: {
          clicks_delta?: number
          commission_value?: number
          created_at?: string
          gross_value?: number
          id?: string
          origin?: string
          product_id?: string | null
          product_image?: string | null
          product_name?: string
          quantity?: number
          simulated?: boolean
          unit_price?: number
          views_delta?: number
        }
        Relationships: [
          {
            foreignKeyName: "simulation_sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      simulation_settings: {
        Row: {
          allow_repeat: boolean
          chart_updates_enabled: boolean
          clicks_per_sale_max: number
          clicks_per_sale_min: number
          custom_commission_type: string
          custom_commission_value: number | null
          custom_price_max: number | null
          custom_price_min: number | null
          daily_commission_target: number | null
          daily_reset: boolean
          daily_revenue_target: number | null
          daily_sales_limit: number | null
          distribution_mode: string
          enabled: boolean
          exact_interval_seconds: number
          forced_next_product_id: string | null
          global_cooldown_seconds: number
          id: string
          interval_max_seconds: number
          interval_min_seconds: number
          max_notifications: number
          metrics_enabled: Json
          mode: string
          notification_animation: string
          notification_duration_seconds: number
          notification_fields: Json
          notification_position: string
          notification_title: string
          notifications_enabled: boolean
          precise_mode: boolean
          quantity_max: number
          quantity_min: number
          quantity_mode: string
          quantity_weights: Json
          schedule_enabled: boolean
          schedule_end_date: string | null
          schedule_end_time: string
          schedule_start_date: string | null
          schedule_start_time: string
          timezone: string
          traffic_simulation_enabled: boolean
          updated_at: string
          updated_by: string | null
          use_custom_commission: boolean
          use_custom_price: boolean
          views_per_sale_max: number
          views_per_sale_min: number
          weekdays: number[]
        }
        Insert: {
          allow_repeat?: boolean
          chart_updates_enabled?: boolean
          clicks_per_sale_max?: number
          clicks_per_sale_min?: number
          custom_commission_type?: string
          custom_commission_value?: number | null
          custom_price_max?: number | null
          custom_price_min?: number | null
          daily_commission_target?: number | null
          daily_reset?: boolean
          daily_revenue_target?: number | null
          daily_sales_limit?: number | null
          distribution_mode?: string
          enabled?: boolean
          exact_interval_seconds?: number
          forced_next_product_id?: string | null
          global_cooldown_seconds?: number
          id?: string
          interval_max_seconds?: number
          interval_min_seconds?: number
          max_notifications?: number
          metrics_enabled?: Json
          mode?: string
          notification_animation?: string
          notification_duration_seconds?: number
          notification_fields?: Json
          notification_position?: string
          notification_title?: string
          notifications_enabled?: boolean
          precise_mode?: boolean
          quantity_max?: number
          quantity_min?: number
          quantity_mode?: string
          quantity_weights?: Json
          schedule_enabled?: boolean
          schedule_end_date?: string | null
          schedule_end_time?: string
          schedule_start_date?: string | null
          schedule_start_time?: string
          timezone?: string
          traffic_simulation_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          use_custom_commission?: boolean
          use_custom_price?: boolean
          views_per_sale_max?: number
          views_per_sale_min?: number
          weekdays?: number[]
        }
        Update: {
          allow_repeat?: boolean
          chart_updates_enabled?: boolean
          clicks_per_sale_max?: number
          clicks_per_sale_min?: number
          custom_commission_type?: string
          custom_commission_value?: number | null
          custom_price_max?: number | null
          custom_price_min?: number | null
          daily_commission_target?: number | null
          daily_reset?: boolean
          daily_revenue_target?: number | null
          daily_sales_limit?: number | null
          distribution_mode?: string
          enabled?: boolean
          exact_interval_seconds?: number
          forced_next_product_id?: string | null
          global_cooldown_seconds?: number
          id?: string
          interval_max_seconds?: number
          interval_min_seconds?: number
          max_notifications?: number
          metrics_enabled?: Json
          mode?: string
          notification_animation?: string
          notification_duration_seconds?: number
          notification_fields?: Json
          notification_position?: string
          notification_title?: string
          notifications_enabled?: boolean
          precise_mode?: boolean
          quantity_max?: number
          quantity_min?: number
          quantity_mode?: string
          quantity_weights?: Json
          schedule_enabled?: boolean
          schedule_end_date?: string | null
          schedule_end_time?: string
          schedule_start_date?: string | null
          schedule_start_time?: string
          timezone?: string
          traffic_simulation_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
          use_custom_commission?: boolean
          use_custom_price?: boolean
          views_per_sale_max?: number
          views_per_sale_min?: number
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "simulation_settings_forced_next_product_id_fkey"
            columns: ["forced_next_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_generations: {
        Row: {
          created_at: string
          favorite: boolean
          id: string
          kind: string
          metadata: Json | null
          model: string | null
          project_id: string | null
          prompt: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          favorite?: boolean
          id?: string
          kind?: string
          metadata?: Json | null
          model?: string | null
          project_id?: string | null
          prompt?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          favorite?: boolean
          id?: string
          kind?: string
          metadata?: Json | null
          model?: string | null
          project_id?: string | null
          prompt?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "studio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_projects: {
        Row: {
          aspect_ratio: string | null
          audio_prompt: string | null
          audio_settings: Json | null
          camera_settings: Json | null
          created_at: string
          dialogue: string | null
          duration: number | null
          flow_recipe: Json | null
          id: string
          image_prompt: string | null
          influencer_id: string | null
          lighting_settings: Json | null
          master_frame_url: string | null
          name: string
          negative_prompt: string | null
          product_data: Json | null
          product_id: string | null
          quality: string | null
          scene_data: Json | null
          scene_id: string | null
          status: string
          style: string | null
          style_dna: Json | null
          updated_at: string
          user_id: string | null
          video_prompt: string | null
        }
        Insert: {
          aspect_ratio?: string | null
          audio_prompt?: string | null
          audio_settings?: Json | null
          camera_settings?: Json | null
          created_at?: string
          dialogue?: string | null
          duration?: number | null
          flow_recipe?: Json | null
          id?: string
          image_prompt?: string | null
          influencer_id?: string | null
          lighting_settings?: Json | null
          master_frame_url?: string | null
          name: string
          negative_prompt?: string | null
          product_data?: Json | null
          product_id?: string | null
          quality?: string | null
          scene_data?: Json | null
          scene_id?: string | null
          status?: string
          style?: string | null
          style_dna?: Json | null
          updated_at?: string
          user_id?: string | null
          video_prompt?: string | null
        }
        Update: {
          aspect_ratio?: string | null
          audio_prompt?: string | null
          audio_settings?: Json | null
          camera_settings?: Json | null
          created_at?: string
          dialogue?: string | null
          duration?: number | null
          flow_recipe?: Json | null
          id?: string
          image_prompt?: string | null
          influencer_id?: string | null
          lighting_settings?: Json | null
          master_frame_url?: string | null
          name?: string
          negative_prompt?: string | null
          product_data?: Json | null
          product_id?: string | null
          quality?: string | null
          scene_data?: Json | null
          scene_id?: string | null
          status?: string
          style?: string | null
          style_dna?: Json | null
          updated_at?: string
          user_id?: string | null
          video_prompt?: string | null
        }
        Relationships: []
      }
      studio_scenes: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          name: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      supplier_activation_sessions: {
        Row: {
          completed_at: string | null
          expires_at: string
          id: string
          started_at: string
          supplier_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          expires_at?: string
          id?: string
          started_at?: string
          supplier_id?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          expires_at?: string
          id?: string
          started_at?: string
          supplier_id?: string
          user_id?: string
        }
        Relationships: []
      }
      supplier_site_products: {
        Row: {
          available: boolean
          brand: string | null
          category: string | null
          description: string | null
          ean: string | null
          external_id: string
          id: string
          image_url: string | null
          images: Json
          imported_at: string
          list_price: number | null
          price: number | null
          sku_id: string | null
          source: string
          title: string
          url: string
        }
        Insert: {
          available?: boolean
          brand?: string | null
          category?: string | null
          description?: string | null
          ean?: string | null
          external_id: string
          id?: string
          image_url?: string | null
          images?: Json
          imported_at?: string
          list_price?: number | null
          price?: number | null
          sku_id?: string | null
          source: string
          title: string
          url: string
        }
        Update: {
          available?: boolean
          brand?: string | null
          category?: string | null
          description?: string | null
          ean?: string | null
          external_id?: string
          id?: string
          image_url?: string | null
          images?: Json
          imported_at?: string
          list_price?: number | null
          price?: number | null
          sku_id?: string | null
          source?: string
          title?: string
          url?: string
        }
        Relationships: []
      }
      user_limits: {
        Row: {
          blocked: boolean
          created_at: string
          daily_limit: number
          notes: string | null
          purchased_at: string
          trial_days: number
          unlimited: boolean
          unlimited_until: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          blocked?: boolean
          created_at?: string
          daily_limit?: number
          notes?: string | null
          purchased_at?: string
          trial_days?: number
          unlimited?: boolean
          unlimited_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          blocked?: boolean
          created_at?: string
          daily_limit?: number
          notes?: string | null
          purchased_at?: string
          trial_days?: number
          unlimited?: boolean
          unlimited_until?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_role_of: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["admin_role"]
      }
      begin_supplier_activation: { Args: never; Returns: Json }
      claim_coupon_slot: {
        Args: { _claim_key: string; _code: string }
        Returns: Json
      }
      complete_supplier_activation: {
        Args: { session_id: string }
        Returns: Json
      }
      get_coupon_offer: { Args: { _code: string }; Returns: Json }
      get_public_pricing: { Args: never; Returns: Json }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      owns_shopee_shop: { Args: { _shop_id: number }; Returns: boolean }
      pas_community_listing_candidates: { Args: never; Returns: Json }
      pas_lock_publication: {
        Args: { p_product_id: string; p_shop_id: number }
        Returns: boolean
      }
      pas_supplier_category: { Args: { _path: string }; Returns: string }
      pas_sync_supplier_catalog: { Args: { _source: string }; Returns: Json }
      read_supplier_activation: { Args: never; Returns: Json }
      resolve_partner_branding: {
        Args: { _slug: string }
        Returns: {
          brand_logo: string
          brand_name: string
        }[]
      }
      resolve_partner_by_slug: {
        Args: { _slug: string }
        Returns: {
          checkout_lifetime_url: string
          checkout_monthly_url: string
          partner_name: string
          slug: string
        }[]
      }
      resolve_partner_coupon: {
        Args: { _code: string }
        Returns: {
          checkout_lifetime_url: string
          checkout_monthly_url: string
          code: string
          partner_name: string
        }[]
      }
      resolve_partner_legacy_slug: { Args: { _slug: string }; Returns: string }
    }
    Enums: {
      admin_role: "super_admin" | "admin" | "editor" | "support" | "analyst"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      admin_role: ["super_admin", "admin", "editor", "support", "analyst"],
    },
  },
} as const
