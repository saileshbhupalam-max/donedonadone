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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      ai_match_explanations: {
        Row: {
          compatibility_score: number | null
          created_at: string | null
          explanation: string
          icebreaker: string | null
          id: string
          matched_user_id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          compatibility_score?: number | null
          created_at?: string | null
          explanation: string
          icebreaker?: string | null
          id?: string
          matched_user_id: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          compatibility_score?: number | null
          created_at?: string | null
          explanation?: string
          icebreaker?: string | null
          id?: string
          matched_user_id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_match_explanations_matched_user_id_fkey"
            columns: ["matched_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_explanations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_match_explanations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_providers: {
        Row: {
          api_key_env: string
          base_url: string
          created_at: string | null
          display_name: string
          id: string
          is_active: boolean | null
        }
        Insert: {
          api_key_env: string
          base_url: string
          created_at?: string | null
          display_name: string
          id: string
          is_active?: boolean | null
        }
        Update: {
          api_key_env?: string
          base_url?: string
          created_at?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
        }
        Relationships: []
      }
      ai_task_config: {
        Row: {
          fallback_to_template: boolean | null
          is_active: boolean | null
          max_tokens: number | null
          model: string
          provider_id: string | null
          system_prompt: string | null
          task_type: string
          temperature: number | null
          updated_at: string | null
        }
        Insert: {
          fallback_to_template?: boolean | null
          is_active?: boolean | null
          max_tokens?: number | null
          model: string
          provider_id?: string | null
          system_prompt?: string | null
          task_type: string
          temperature?: number | null
          updated_at?: string | null
        }
        Update: {
          fallback_to_template?: boolean | null
          is_active?: boolean | null
          max_tokens?: number | null
          model?: string
          provider_id?: string | null
          system_prompt?: string | null
          task_type?: string
          temperature?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_task_config_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "ai_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_log: {
        Row: {
          created_at: string | null
          id: string
          input_tokens: number | null
          model: string | null
          output_tokens: number | null
          provider_id: string | null
          source: string
          task_type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          provider_id?: string | null
          source?: string
          task_type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_tokens?: number | null
          model?: string | null
          output_tokens?: number | null
          provider_id?: string | null
          source?: string
          task_type?: string
        }
        Relationships: []
      }
      analytics_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      behavioral_signals: {
        Row: {
          context: string | null
          created_at: string | null
          event_id: string | null
          id: string
          location_id: string | null
          metadata: Json | null
          signal_type: string
          target_user_id: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json | null
          signal_type: string
          target_user_id?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          location_id?: string | null
          metadata?: Json | null
          signal_type?: string
          target_user_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavioral_signals_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_signals_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_signals_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavioral_signals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          auto_detected: boolean | null
          checked_in_at: string
          checked_out_at: string | null
          id: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          mode: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          auto_detected?: boolean | null
          checked_in_at?: string
          checked_out_at?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          mode?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          auto_detected?: boolean | null
          checked_in_at?: string
          checked_out_at?: string | null
          id?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          mode?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      coffee_roulette_queue: {
        Row: {
          id: string
          joined_at: string
          latitude: number | null
          location_id: string | null
          longitude: number | null
          matched_at: string | null
          matched_with: string | null
          mode: string
          status: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          matched_at?: string | null
          matched_with?: string | null
          mode?: string
          status?: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          latitude?: number | null
          location_id?: string | null
          longitude?: number | null
          matched_at?: string | null
          matched_with?: string | null
          mode?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coffee_roulette_queue_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_roulette_queue_matched_with_fkey"
            columns: ["matched_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coffee_roulette_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      community_rituals: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          ritual_type: string
          user_id: string
          week_of: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          ritual_type: string
          user_id: string
          week_of: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          ritual_type?: string
          user_id?: string
          week_of?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_rituals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          industry_tags: string[] | null
          logo_url: string | null
          name: string
          one_liner: string | null
          stage: string | null
          team_size: number | null
          updated_at: string
          website: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          industry_tags?: string[] | null
          logo_url?: string | null
          name: string
          one_liner?: string | null
          stage?: string | null
          team_size?: number | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          industry_tags?: string[] | null
          logo_url?: string | null
          name?: string
          one_liner?: string | null
          stage?: string | null
          team_size?: number | null
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_intros: {
        Row: {
          created_at: string
          from_company_id: string
          from_user_id: string
          id: string
          message: string | null
          need_id: string | null
          offer_id: string | null
          status: string
          to_company_id: string
        }
        Insert: {
          created_at?: string
          from_company_id: string
          from_user_id: string
          id?: string
          message?: string | null
          need_id?: string | null
          offer_id?: string | null
          status?: string
          to_company_id: string
        }
        Update: {
          created_at?: string
          from_company_id?: string
          from_user_id?: string
          id?: string
          message?: string | null
          need_id?: string | null
          offer_id?: string | null
          status?: string
          to_company_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_intros_from_company_id_fkey"
            columns: ["from_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intros_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intros_need_id_fkey"
            columns: ["need_id"]
            isOneToOne: false
            referencedRelation: "company_needs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intros_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "company_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_intros_to_company_id_fkey"
            columns: ["to_company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_needs: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          need_type: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          need_type: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          need_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_needs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_offers: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          offer_type: string
          title: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          offer_type: string
          title: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          offer_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_offers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      connection_requests: {
        Row: {
          created_at: string
          from_user: string
          id: string
          message: string | null
          responded_at: string | null
          status: string
          to_user: string
        }
        Insert: {
          created_at?: string
          from_user: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user: string
        }
        Update: {
          created_at?: string
          from_user?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "connection_requests_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connection_requests_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          connection_type: string
          context: string
          created_at: string | null
          first_interaction_at: string | null
          id: string
          interaction_count: number | null
          last_interaction_at: string | null
          metadata: Json | null
          strength: number | null
          user_a: string
          user_b: string
        }
        Insert: {
          connection_type: string
          context?: string
          created_at?: string | null
          first_interaction_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          metadata?: Json | null
          strength?: number | null
          user_a: string
          user_b: string
        }
        Update: {
          connection_type?: string
          context?: string
          created_at?: string | null
          first_interaction_at?: string | null
          id?: string
          interaction_count?: number | null
          last_interaction_at?: string | null
          metadata?: Json | null
          strength?: number | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cowork_preferences: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          preferred_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          preferred_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          preferred_user_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cowork_preferences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cowork_preferences_preferred_user_id_fkey"
            columns: ["preferred_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cowork_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_space_connections: {
        Row: {
          context: string | null
          created_at: string | null
          discovered_at_venue_id: string | null
          discovered_user_id: string
          id: string
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string | null
          discovered_at_venue_id?: string | null
          discovered_user_id: string
          id?: string
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string | null
          discovered_at_venue_id?: string | null
          discovered_user_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cross_space_connections_discovered_at_venue_id_fkey"
            columns: ["discovered_at_venue_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_space_connections_discovered_user_id_fkey"
            columns: ["discovered_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cross_space_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      energy_checks: {
        Row: {
          created_at: string | null
          energy_level: number
          event_id: string
          id: string
          phase: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          energy_level: number
          event_id: string
          id?: string
          phase?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          energy_level?: number
          event_id?: string
          id?: string
          phase?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "energy_checks_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "energy_checks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_feedback: {
        Row: {
          attended: boolean | null
          comment: string | null
          created_at: string | null
          event_id: string
          id: string
          rating: number | null
          user_id: string
        }
        Insert: {
          attended?: boolean | null
          comment?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          rating?: number | null
          user_id: string
        }
        Update: {
          attended?: boolean | null
          comment?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_feedback_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      event_rsvps: {
        Row: {
          buddy_user_id: string | null
          created_at: string | null
          event_id: string
          id: string
          is_captain: boolean | null
          is_first_session: boolean | null
          status: string
          user_id: string
        }
        Insert: {
          buddy_user_id?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          is_captain?: boolean | null
          is_first_session?: boolean | null
          status: string
          user_id: string
        }
        Update: {
          buddy_user_id?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          is_captain?: boolean | null
          is_first_session?: boolean | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_rsvps_buddy_user_id_fkey"
            columns: ["buddy_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_rsvps_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          created_at: string | null
          created_by: string | null
          date: string
          description: string | null
          end_time: string | null
          id: string
          max_spots: number | null
          neighborhood: string | null
          rsvp_count: number | null
          session_format: string | null
          start_time: string | null
          title: string
          venue_address: string | null
          venue_latitude: number | null
          venue_longitude: number | null
          venue_name: string | null
          venue_partner_id: string | null
          vibe_soundtrack: string | null
          whatsapp_group_link: string | null
          women_only: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          date: string
          description?: string | null
          end_time?: string | null
          id?: string
          max_spots?: number | null
          neighborhood?: string | null
          rsvp_count?: number | null
          session_format?: string | null
          start_time?: string | null
          title: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          venue_partner_id?: string | null
          vibe_soundtrack?: string | null
          whatsapp_group_link?: string | null
          women_only?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          date?: string
          description?: string | null
          end_time?: string | null
          id?: string
          max_spots?: number | null
          neighborhood?: string | null
          rsvp_count?: number | null
          session_format?: string | null
          start_time?: string | null
          title?: string
          venue_address?: string | null
          venue_latitude?: number | null
          venue_longitude?: number | null
          venue_name?: string | null
          venue_partner_id?: string | null
          vibe_soundtrack?: string | null
          whatsapp_group_link?: string | null
          women_only?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_venue_partner_id_fkey"
            columns: ["venue_partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      exclusive_achievements: {
        Row: {
          achieved_at: string | null
          achievement_type: string
          id: string
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          achievement_type: string
          id?: string
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          achievement_type?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exclusive_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string | null
          description: string | null
          enabled: boolean
          flag_name: string
          id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          flag_name: string
          id?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          enabled?: boolean
          flag_name?: string
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          event_id: string
          group_number: number
          id: string
          table_assignment: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          group_number: number
          id?: string
          table_assignment?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          group_number?: number
          id?: string
          table_assignment?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      icebreaker_questions: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          depth: string
          emoji: string | null
          id: string
          question: string
          times_used: number | null
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          depth: string
          emoji?: string | null
          id?: string
          question: string
          times_used?: number | null
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          depth?: string
          emoji?: string | null
          id?: string
          question?: string
          times_used?: number | null
        }
        Relationships: []
      }
      intro_credits: {
        Row: {
          credits_purchased: number
          credits_remaining: number
          id: string
          last_purchased_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          credits_purchased?: number
          credits_remaining?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          credits_purchased?: number
          credits_remaining?: number
          id?: string
          last_purchased_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intro_credits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string
          created_at: string | null
          id: string
          is_partner: boolean | null
          latitude: number
          location_type: string
          longitude: number
          member_count: number | null
          name: string
          neighborhood: string | null
          parent_location_id: string | null
          partner_user_id: string | null
          photo_url: string | null
          radius_meters: number
          updated_at: string | null
          venue_partner_id: string | null
          verified: boolean | null
        }
        Insert: {
          city?: string
          created_at?: string | null
          id?: string
          is_partner?: boolean | null
          latitude: number
          location_type: string
          longitude: number
          member_count?: number | null
          name: string
          neighborhood?: string | null
          parent_location_id?: string | null
          partner_user_id?: string | null
          photo_url?: string | null
          radius_meters?: number
          updated_at?: string | null
          venue_partner_id?: string | null
          verified?: boolean | null
        }
        Update: {
          city?: string
          created_at?: string | null
          id?: string
          is_partner?: boolean | null
          latitude?: number
          location_type?: string
          longitude?: number
          member_count?: number | null
          name?: string
          neighborhood?: string | null
          parent_location_id?: string | null
          partner_user_id?: string | null
          photo_url?: string | null
          radius_meters?: number
          updated_at?: string | null
          venue_partner_id?: string | null
          verified?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_location_id_fkey"
            columns: ["parent_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_partner_user_id_fkey"
            columns: ["partner_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_venue_partner_id_fkey"
            columns: ["venue_partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      match_templates: {
        Row: {
          icebreaker_template: string | null
          id: string
          is_active: boolean | null
          match_type: string
          priority: number | null
          template: string
        }
        Insert: {
          icebreaker_template?: string | null
          id?: string
          is_active?: boolean | null
          match_type: string
          priority?: number | null
          template: string
        }
        Update: {
          icebreaker_template?: string | null
          id?: string
          is_active?: boolean | null
          match_type?: string
          priority?: number | null
          template?: string
        }
        Relationships: []
      }
      member_badges: {
        Row: {
          badge_type: string
          earned_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          badge_type: string
          earned_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          badge_type?: string
          earned_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_flags: {
        Row: {
          created_at: string | null
          flagged_by: string
          flagged_user: string
          id: string
          notes: string | null
          reason: string
          resolution: string | null
          resolved_at: string | null
          session_id: string
        }
        Insert: {
          created_at?: string | null
          flagged_by: string
          flagged_user: string
          id?: string
          notes?: string | null
          reason: string
          resolution?: string | null
          resolved_at?: string | null
          session_id: string
        }
        Update: {
          created_at?: string | null
          flagged_by?: string
          flagged_user?: string
          id?: string
          notes?: string | null
          reason?: string
          resolution?: string | null
          resolved_at?: string | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_flags_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_flags_flagged_user_fkey"
            columns: ["flagged_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_flags_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      member_milestones: {
        Row: {
          achieved_at: string | null
          id: string
          milestone_type: string
          shared: boolean | null
          user_id: string
        }
        Insert: {
          achieved_at?: string | null
          id?: string
          milestone_type: string
          shared?: boolean | null
          user_id: string
        }
        Update: {
          achieved_at?: string | null
          id?: string
          milestone_type?: string
          shared?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_milestones_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      member_status: {
        Row: {
          event_id: string | null
          status: string
          topic: string | null
          until_time: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          event_id?: string | null
          status?: string
          topic?: string | null
          until_time?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          event_id?: string | null
          status?: string
          topic?: string | null
          until_time?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_status_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      micro_requests: {
        Row: {
          claimed_by: string | null
          created_at: string
          description: string | null
          expires_at: string
          id: string
          location_id: string | null
          request_type: string
          status: string
          title: string
          user_id: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          location_id?: string | null
          request_type: string
          status?: string
          title: string
          user_id: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string
          id?: string
          location_id?: string | null
          request_type?: string
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "micro_requests_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_requests_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "micro_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_titles: {
        Row: {
          created_at: string | null
          id: string
          month: string
          title_type: string
          user_id: string
          value: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          month: string
          title_type: string
          user_id: string
          value?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          month?: string
          title_type?: string
          user_id?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "monthly_titles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          category: string
          channel: string
          created_at: string
          id: string
          metadata: Json | null
          status: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          category: string
          channel: string
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          category?: string
          channel?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          status?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          channels: Json
          created_at: string
          email_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string
          quiet_hours_start: string
          updated_at: string
          user_id: string
          whatsapp_enabled: boolean
          whatsapp_number: string | null
        }
        Insert: {
          channels?: Json
          created_at?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          updated_at?: string
          user_id: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Update: {
          channels?: Json
          created_at?: string
          email_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string
          quiet_hours_start?: string
          updated_at?: string
          user_id?: string
          whatsapp_enabled?: boolean
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          link: string | null
          read: boolean | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          link?: string | null
          read?: boolean | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      partner_applications: {
        Row: {
          address: string
          amenities: string[] | null
          city: string
          contact_email: string | null
          contact_phone: string | null
          created_at: string
          description: string | null
          id: string
          latitude: number | null
          longitude: number | null
          neighborhood: string
          photos: string[] | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          seating_capacity: number | null
          status: string
          user_id: string
          venue_name: string
          venue_type: string
          wifi_available: boolean | null
        }
        Insert: {
          address: string
          amenities?: string[] | null
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood: string
          photos?: string[] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seating_capacity?: number | null
          status?: string
          user_id: string
          venue_name: string
          venue_type: string
          wifi_available?: boolean | null
        }
        Update: {
          address?: string
          amenities?: string[] | null
          city?: string
          contact_email?: string | null
          contact_phone?: string | null
          created_at?: string
          description?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string
          photos?: string[] | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          seating_capacity?: number | null
          status?: string
          user_id?: string
          venue_name?: string
          venue_type?: string
          wifi_available?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "partner_applications_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partner_applications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_paise: number
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          payment_id: string | null
          payment_provider: string
          payment_type: string
          status: string
          user_id: string
        }
        Insert: {
          amount_paise: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider: string
          payment_type: string
          status?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          payment_id?: string | null
          payment_provider?: string
          payment_type?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_props: {
        Row: {
          anonymous: boolean | null
          created_at: string | null
          delivered_at: string | null
          echo_deliver_at: string | null
          event_id: string
          from_user: string
          id: string
          is_echo: boolean | null
          prop_type: string
          to_user: string
        }
        Insert: {
          anonymous?: boolean | null
          created_at?: string | null
          delivered_at?: string | null
          echo_deliver_at?: string | null
          event_id: string
          from_user: string
          id?: string
          is_echo?: boolean | null
          prop_type: string
          to_user: string
        }
        Update: {
          anonymous?: boolean | null
          created_at?: string | null
          delivered_at?: string | null
          echo_deliver_at?: string | null
          event_id?: string
          from_user?: string
          id?: string
          is_echo?: boolean | null
          prop_type?: string
          to_user?: string
        }
        Relationships: [
          {
            foreignKeyName: "peer_props_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_props_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "peer_props_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      personality_config: {
        Row: {
          active: boolean | null
          category: string
          created_at: string | null
          id: string
          key: string | null
          sort_order: number | null
          updated_at: string | null
          value: string
        }
        Insert: {
          active?: boolean | null
          category: string
          created_at?: string | null
          id?: string
          key?: string | null
          sort_order?: number | null
          updated_at?: string | null
          value: string
        }
        Update: {
          active?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          key?: string | null
          sort_order?: number | null
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          id: string
          viewed_at: string | null
          viewed_id: string
          viewer_id: string
        }
        Insert: {
          id?: string
          viewed_at?: string | null
          viewed_id: string
          viewer_id: string
        }
        Update: {
          id?: string
          viewed_at?: string | null
          viewed_id?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_views_viewed_id_fkey"
            columns: ["viewed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          autopilot_days: string[] | null
          autopilot_enabled: boolean | null
          autopilot_max_per_week: number | null
          autopilot_prefer_circle: boolean | null
          autopilot_times: string[] | null
          avatar_url: string | null
          bio: string | null
          can_offer: string[] | null
          captain_sessions: number | null
          communication_style: string | null
          created_at: string | null
          current_streak: number | null
          display_name: string | null
          email: string | null
          events_attended: number | null
          events_no_show: number | null
          focus_hours: number | null
          focus_rank: string | null
          gender: string | null
          id: string
          instagram_handle: string | null
          intentions_completed: number | null
          interests: string[] | null
          is_table_captain: boolean | null
          is_welcome_buddy: boolean | null
          last_active_at: string | null
          linkedin_url: string | null
          looking_for: string[] | null
          neighborhood: string | null
          no_show_count: number | null
          noise_preference: string | null
          onboarding_completed: boolean | null
          phone: string | null
          preferred_days: string[] | null
          preferred_latitude: number | null
          preferred_longitude: number | null
          preferred_neighborhoods: string[] | null
          preferred_radius_km: number | null
          preferred_session_duration: number | null
          preferred_times: string[] | null
          profile_completion: number | null
          referral_code: string | null
          referred_by: string | null
          reliability_status: string | null
          sessions_rsvpd: number | null
          sessions_showed_up: number | null
          show_instagram: boolean | null
          show_linkedin: boolean | null
          show_twitter: boolean | null
          streak_insurance_used_at: string | null
          streak_saves_total: number | null
          subscription_tier: string | null
          suspended_until: string | null
          suspension_reason: string | null
          tagline: string | null
          twitter_handle: string | null
          updated_at: string | null
          user_type: string | null
          weekly_intention: string | null
          weekly_intention_set_at: string | null
          what_i_do: string | null
          women_only_interest: boolean | null
          work_vibe: string | null
        }
        Insert: {
          autopilot_days?: string[] | null
          autopilot_enabled?: boolean | null
          autopilot_max_per_week?: number | null
          autopilot_prefer_circle?: boolean | null
          autopilot_times?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          can_offer?: string[] | null
          captain_sessions?: number | null
          communication_style?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          email?: string | null
          events_attended?: number | null
          events_no_show?: number | null
          focus_hours?: number | null
          focus_rank?: string | null
          gender?: string | null
          id: string
          instagram_handle?: string | null
          intentions_completed?: number | null
          interests?: string[] | null
          is_table_captain?: boolean | null
          is_welcome_buddy?: boolean | null
          last_active_at?: string | null
          linkedin_url?: string | null
          looking_for?: string[] | null
          neighborhood?: string | null
          no_show_count?: number | null
          noise_preference?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_latitude?: number | null
          preferred_longitude?: number | null
          preferred_neighborhoods?: string[] | null
          preferred_radius_km?: number | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          profile_completion?: number | null
          referral_code?: string | null
          referred_by?: string | null
          reliability_status?: string | null
          sessions_rsvpd?: number | null
          sessions_showed_up?: number | null
          show_instagram?: boolean | null
          show_linkedin?: boolean | null
          show_twitter?: boolean | null
          streak_insurance_used_at?: string | null
          streak_saves_total?: number | null
          subscription_tier?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          tagline?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_type?: string | null
          weekly_intention?: string | null
          weekly_intention_set_at?: string | null
          what_i_do?: string | null
          women_only_interest?: boolean | null
          work_vibe?: string | null
        }
        Update: {
          autopilot_days?: string[] | null
          autopilot_enabled?: boolean | null
          autopilot_max_per_week?: number | null
          autopilot_prefer_circle?: boolean | null
          autopilot_times?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          can_offer?: string[] | null
          captain_sessions?: number | null
          communication_style?: string | null
          created_at?: string | null
          current_streak?: number | null
          display_name?: string | null
          email?: string | null
          events_attended?: number | null
          events_no_show?: number | null
          focus_hours?: number | null
          focus_rank?: string | null
          gender?: string | null
          id?: string
          instagram_handle?: string | null
          intentions_completed?: number | null
          interests?: string[] | null
          is_table_captain?: boolean | null
          is_welcome_buddy?: boolean | null
          last_active_at?: string | null
          linkedin_url?: string | null
          looking_for?: string[] | null
          neighborhood?: string | null
          no_show_count?: number | null
          noise_preference?: string | null
          onboarding_completed?: boolean | null
          phone?: string | null
          preferred_days?: string[] | null
          preferred_latitude?: number | null
          preferred_longitude?: number | null
          preferred_neighborhoods?: string[] | null
          preferred_radius_km?: number | null
          preferred_session_duration?: number | null
          preferred_times?: string[] | null
          profile_completion?: number | null
          referral_code?: string | null
          referred_by?: string | null
          reliability_status?: string | null
          sessions_rsvpd?: number | null
          sessions_showed_up?: number | null
          show_instagram?: boolean | null
          show_linkedin?: boolean | null
          show_twitter?: boolean | null
          streak_insurance_used_at?: string | null
          streak_saves_total?: number | null
          subscription_tier?: string | null
          suspended_until?: string | null
          suspension_reason?: string | null
          tagline?: string | null
          twitter_handle?: string | null
          updated_at?: string | null
          user_type?: string | null
          weekly_intention?: string | null
          weekly_intention_set_at?: string | null
          what_i_do?: string | null
          women_only_interest?: boolean | null
          work_vibe?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_reactions: {
        Row: {
          created_at: string | null
          id: string
          response_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          response_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          response_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_reactions_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "prompt_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompt_responses: {
        Row: {
          answer: string | null
          created_at: string | null
          fire_count: number | null
          id: string
          prompt_id: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          created_at?: string | null
          fire_count?: number | null
          id?: string
          prompt_id: string
          user_id: string
        }
        Update: {
          answer?: string | null
          created_at?: string | null
          fire_count?: number | null
          id?: string
          prompt_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prompt_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prompt_responses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prompts: {
        Row: {
          category: string | null
          created_at: string | null
          emoji: string | null
          id: string
          is_active: boolean | null
          question: string
          response_count: number | null
          sort_order: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          question: string
          response_count?: number | null
          sort_order?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          emoji?: string | null
          id?: string
          is_active?: boolean | null
          question?: string
          response_count?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          platform: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          token: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          platform?: string
          token?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ritual_likes: {
        Row: {
          created_at: string | null
          id: string
          ritual_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ritual_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ritual_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ritual_likes_ritual_id_fkey"
            columns: ["ritual_id"]
            isOneToOne: false
            referencedRelation: "community_rituals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ritual_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_boosts: {
        Row: {
          amount_paise: number
          boost_tier: string
          expires_at: string
          id: string
          payment_id: string | null
          purchased_at: string
          user_id: string
        }
        Insert: {
          amount_paise?: number
          boost_tier: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          purchased_at?: string
          user_id: string
        }
        Update: {
          amount_paise?: number
          boost_tier?: string
          expires_at?: string
          id?: string
          payment_id?: string | null
          purchased_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_boosts_boost_tier_fkey"
            columns: ["boost_tier"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_boosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_intentions: {
        Row: {
          accomplished: string | null
          created_at: string | null
          event_id: string
          id: string
          intention: string
          user_id: string
        }
        Insert: {
          accomplished?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          intention: string
          user_id: string
        }
        Update: {
          accomplished?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          intention?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_intentions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_intentions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_phases: {
        Row: {
          duration_minutes: number
          ended_at: string | null
          event_id: string
          id: string
          phase_label: string
          phase_order: number
          phase_type: string
          started_at: string | null
        }
        Insert: {
          duration_minutes: number
          ended_at?: string | null
          event_id: string
          id?: string
          phase_label: string
          phase_order: number
          phase_type: string
          started_at?: string | null
        }
        Update: {
          duration_minutes?: number
          ended_at?: string | null
          event_id?: string
          id?: string
          phase_label?: string
          phase_order?: number
          phase_type?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_phases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      session_photos: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          photo_url: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          photo_url: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_requests: {
        Row: {
          created_at: string | null
          id: string
          neighborhood: string | null
          notes: string | null
          preferred_days: string[] | null
          preferred_time: string | null
          request_type: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          request_type?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          neighborhood?: string | null
          notes?: string | null
          preferred_days?: string[] | null
          preferred_time?: string | null
          request_type?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_scrapbook: {
        Row: {
          cowork_again_picks: string[] | null
          created_at: string | null
          event_id: string
          focus_hours: number | null
          group_members: Json | null
          highlight: string | null
          id: string
          intention: string | null
          intention_accomplished: string | null
          personal_note: string | null
          photo_url: string | null
          props_received: Json | null
          session_date: string
          user_id: string
          venue_name: string | null
          venue_neighborhood: string | null
        }
        Insert: {
          cowork_again_picks?: string[] | null
          created_at?: string | null
          event_id: string
          focus_hours?: number | null
          group_members?: Json | null
          highlight?: string | null
          id?: string
          intention?: string | null
          intention_accomplished?: string | null
          personal_note?: string | null
          photo_url?: string | null
          props_received?: Json | null
          session_date: string
          user_id: string
          venue_name?: string | null
          venue_neighborhood?: string | null
        }
        Update: {
          cowork_again_picks?: string[] | null
          created_at?: string | null
          event_id?: string
          focus_hours?: number | null
          group_members?: Json | null
          highlight?: string | null
          id?: string
          intention?: string | null
          intention_accomplished?: string | null
          personal_note?: string | null
          photo_url?: string | null
          props_received?: Json | null
          session_date?: string
          user_id?: string
          venue_name?: string | null
          venue_neighborhood?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "session_scrapbook_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_scrapbook_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_waitlist: {
        Row: {
          created_at: string | null
          event_id: string
          id: string
          position: number
          promoted_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_id: string
          id?: string
          position: number
          promoted_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_id?: string
          id?: string
          position?: number
          promoted_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_waitlist_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_waitlist_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_tiers: {
        Row: {
          badge_color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_monthly: number
          price_yearly: number
          sort_order: number
        }
        Insert: {
          badge_color?: string | null
          created_at?: string
          description?: string | null
          id: string
          is_active?: boolean
          name: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
        }
        Update: {
          badge_color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_monthly?: number
          price_yearly?: number
          sort_order?: number
        }
        Relationships: []
      }
      taste_graph: {
        Row: {
          company_name: string | null
          company_visible: boolean | null
          connector_score: number | null
          consistency_score: number | null
          conversation_depth: string | null
          created_at: string | null
          current_project: string | null
          experience_years: number | null
          exploration_score: number | null
          food_preferences: string[] | null
          group_size_pref: string | null
          hobbies: string[] | null
          id: string
          industries: string[] | null
          last_enriched_at: string | null
          openness_to_new: number | null
          peak_hours: string[] | null
          play_can_offer: string[] | null
          play_looking_for: string[] | null
          play_profile_complete: number | null
          project_stage: string | null
          responsiveness_score: number | null
          role_type: string | null
          session_length_pref: string | null
          skills: string[] | null
          social_energy: string | null
          topics: string[] | null
          updated_at: string | null
          user_id: string
          values: string[] | null
          weekend_availability: string | null
          work_can_offer: string[] | null
          work_looking_for: string[] | null
          work_profile_complete: number | null
        }
        Insert: {
          company_name?: string | null
          company_visible?: boolean | null
          connector_score?: number | null
          consistency_score?: number | null
          conversation_depth?: string | null
          created_at?: string | null
          current_project?: string | null
          experience_years?: number | null
          exploration_score?: number | null
          food_preferences?: string[] | null
          group_size_pref?: string | null
          hobbies?: string[] | null
          id?: string
          industries?: string[] | null
          last_enriched_at?: string | null
          openness_to_new?: number | null
          peak_hours?: string[] | null
          play_can_offer?: string[] | null
          play_looking_for?: string[] | null
          play_profile_complete?: number | null
          project_stage?: string | null
          responsiveness_score?: number | null
          role_type?: string | null
          session_length_pref?: string | null
          skills?: string[] | null
          social_energy?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id: string
          values?: string[] | null
          weekend_availability?: string | null
          work_can_offer?: string[] | null
          work_looking_for?: string[] | null
          work_profile_complete?: number | null
        }
        Update: {
          company_name?: string | null
          company_visible?: boolean | null
          connector_score?: number | null
          consistency_score?: number | null
          conversation_depth?: string | null
          created_at?: string | null
          current_project?: string | null
          experience_years?: number | null
          exploration_score?: number | null
          food_preferences?: string[] | null
          group_size_pref?: string | null
          hobbies?: string[] | null
          id?: string
          industries?: string[] | null
          last_enriched_at?: string | null
          openness_to_new?: number | null
          peak_hours?: string[] | null
          play_can_offer?: string[] | null
          play_looking_for?: string[] | null
          play_profile_complete?: number | null
          project_stage?: string | null
          responsiveness_score?: number | null
          role_type?: string | null
          session_length_pref?: string | null
          skills?: string[] | null
          social_energy?: string | null
          topics?: string[] | null
          updated_at?: string | null
          user_id?: string
          values?: string[] | null
          weekend_availability?: string | null
          work_can_offer?: string[] | null
          work_looking_for?: string[] | null
          work_profile_complete?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "taste_graph_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_features: {
        Row: {
          category: string
          description: string | null
          feature_key: string
          is_active: boolean
          label: string
          min_tier_id: string
          sort_order: number
        }
        Insert: {
          category?: string
          description?: string | null
          feature_key: string
          is_active?: boolean
          label: string
          min_tier_id: string
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string | null
          feature_key?: string
          is_active?: boolean
          label?: string
          min_tier_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "tier_features_min_tier_id_fkey"
            columns: ["min_tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      tier_limits: {
        Row: {
          id: string
          label: string | null
          limit_key: string
          limit_value: number
          tier_id: string
        }
        Insert: {
          id?: string
          label?: string | null
          limit_key: string
          limit_value: number
          tier_id: string
        }
        Update: {
          id?: string
          label?: string | null
          limit_key?: string
          limit_value?: number
          tier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tier_limits_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_engagement_scores: {
        Row: {
          churn_risk: string | null
          connections_last_30d: number | null
          last_active_at: string | null
          score: number | null
          sessions_last_30d: number | null
          streak_days: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          churn_risk?: string | null
          connections_last_30d?: number | null
          last_active_at?: string | null
          score?: number | null
          sessions_last_30d?: number | null
          streak_days?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          churn_risk?: string | null
          connections_last_30d?: number | null
          last_active_at?: string | null
          score?: number | null
          sessions_last_30d?: number | null
          streak_days?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_engagement_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          notify_coffee_matches: boolean
          notify_connection_requests: boolean
          notify_micro_requests: boolean
          notify_props: boolean
          notify_system: boolean
          user_id: string
          visibility: string
          weekly_goal: number
        }
        Insert: {
          created_at?: string
          id?: string
          notify_coffee_matches?: boolean
          notify_connection_requests?: boolean
          notify_micro_requests?: boolean
          notify_props?: boolean
          notify_system?: boolean
          user_id: string
          visibility?: string
          weekly_goal?: number
        }
        Update: {
          created_at?: string
          id?: string
          notify_coffee_matches?: boolean
          notify_connection_requests?: boolean
          notify_micro_requests?: boolean
          notify_props?: boolean
          notify_system?: boolean
          user_id?: string
          visibility?: string
          weekly_goal?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_streaks: {
        Row: {
          created_at: string
          current_streak: number
          id: string
          last_checkin_date: string | null
          longest_streak: number
          updated_at: string
          user_id: string
          week_start: string | null
          weekly_checkins: number
          weekly_goal: number
        }
        Insert: {
          created_at?: string
          current_streak?: number
          id?: string
          last_checkin_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id: string
          week_start?: string | null
          weekly_checkins?: number
          weekly_goal?: number
        }
        Update: {
          created_at?: string
          current_streak?: number
          id?: string
          last_checkin_date?: string | null
          longest_streak?: number
          updated_at?: string
          user_id?: string
          week_start?: string | null
          weekly_checkins?: number
          weekly_goal?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          billing_cycle: string | null
          cancelled_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          payment_id: string | null
          payment_provider: string | null
          started_at: string
          status: string
          tier_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_provider?: string | null
          started_at?: string
          status?: string
          tier_id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string | null
          cancelled_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          payment_id?: string | null
          payment_provider?: string | null
          started_at?: string
          status?: string
          tier_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "subscription_tiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_partners: {
        Row: {
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string | null
          events_hosted: number | null
          google_maps_url: string | null
          id: string
          instagram_handle: string | null
          latitude: number | null
          longitude: number | null
          members_acquired: number | null
          neighborhood: string | null
          notes: string | null
          partnership_type: string
          qr_code_url: string | null
          revenue_share_pct: number | null
          status: string
          updated_at: string | null
          venue_address: string | null
          venue_name: string
        }
        Insert: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          events_hosted?: number | null
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          latitude?: number | null
          longitude?: number | null
          members_acquired?: number | null
          neighborhood?: string | null
          notes?: string | null
          partnership_type?: string
          qr_code_url?: string | null
          revenue_share_pct?: number | null
          status?: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name: string
        }
        Update: {
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string | null
          events_hosted?: number | null
          google_maps_url?: string | null
          id?: string
          instagram_handle?: string | null
          latitude?: number | null
          longitude?: number | null
          members_acquired?: number | null
          neighborhood?: string | null
          notes?: string | null
          partnership_type?: string
          qr_code_url?: string | null
          revenue_share_pct?: number | null
          status?: string
          updated_at?: string | null
          venue_address?: string | null
          venue_name?: string
        }
        Relationships: []
      }
      venue_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          event_id: string
          id: string
          rating: number
          user_id: string
          venue_partner_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          event_id: string
          id?: string
          rating: number
          user_id: string
          venue_partner_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          event_id?: string
          id?: string
          rating?: number
          user_id?: string
          venue_partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_reviews_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_reviews_venue_partner_id_fkey"
            columns: ["venue_partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_scans: {
        Row: {
          id: string
          resulted_in_signup: boolean | null
          scanned_at: string | null
          user_id: string | null
          venue_partner_id: string
        }
        Insert: {
          id?: string
          resulted_in_signup?: boolean | null
          scanned_at?: string | null
          user_id?: string | null
          venue_partner_id: string
        }
        Update: {
          id?: string
          resulted_in_signup?: boolean | null
          scanned_at?: string | null
          user_id?: string | null
          venue_partner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "venue_scans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_scans_venue_partner_id_fkey"
            columns: ["venue_partner_id"]
            isOneToOne: false
            referencedRelation: "venue_partners"
            referencedColumns: ["id"]
          },
        ]
      }
      venue_vibes: {
        Row: {
          coffee_quality: number | null
          created_at: string | null
          event_id: string | null
          id: string
          noise_level: number | null
          note: string | null
          overall_vibe: string | null
          power_outlets: number | null
          seating_comfort: number | null
          user_id: string
          venue_name: string
          wifi_quality: number | null
        }
        Insert: {
          coffee_quality?: number | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          noise_level?: number | null
          note?: string | null
          overall_vibe?: string | null
          power_outlets?: number | null
          seating_comfort?: number | null
          user_id: string
          venue_name: string
          wifi_quality?: number | null
        }
        Update: {
          coffee_quality?: number | null
          created_at?: string | null
          event_id?: string | null
          id?: string
          noise_level?: number | null
          note?: string | null
          overall_vibe?: string | null
          power_outlets?: number | null
          seating_comfort?: number | null
          user_id?: string
          venue_name?: string
          wifi_quality?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "venue_vibes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "venue_vibes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_digest_data: {
        Row: {
          connections_made: number | null
          created_at: string | null
          highlight: string | null
          id: string
          props_received: number | null
          rank_progress: string | null
          sessions_attended: number | null
          user_id: string
          week_start: string
        }
        Insert: {
          connections_made?: number | null
          created_at?: string | null
          highlight?: string | null
          id?: string
          props_received?: number | null
          rank_progress?: string | null
          sessions_attended?: number | null
          user_id: string
          week_start: string
        }
        Update: {
          connections_made?: number | null
          created_at?: string | null
          highlight?: string | null
          id?: string
          props_received?: number | null
          rank_progress?: string | null
          sessions_attended?: number | null
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_digest_data_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      taste_graph_public: {
        Row: {
          company_name: string | null
          current_project: string | null
          hobbies: string[] | null
          industries: string[] | null
          play_profile_complete: number | null
          project_stage: string | null
          role_type: string | null
          skills: string[] | null
          topics: string[] | null
          user_id: string | null
          values: string[] | null
          work_profile_complete: number | null
        }
        Insert: {
          company_name?: never
          current_project?: string | null
          hobbies?: string[] | null
          industries?: string[] | null
          play_profile_complete?: number | null
          project_stage?: string | null
          role_type?: string | null
          skills?: string[] | null
          topics?: string[] | null
          user_id?: string | null
          values?: string[] | null
          work_profile_complete?: number | null
        }
        Update: {
          company_name?: never
          current_project?: string | null
          hobbies?: string[] | null
          industries?: string[] | null
          play_profile_complete?: number | null
          project_stage?: string | null
          role_type?: string | null
          skills?: string[] | null
          topics?: string[] | null
          user_id?: string | null
          values?: string[] | null
          work_profile_complete?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "taste_graph_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_connection_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      approve_partner_application: {
        Args: { p_application_id: string }
        Returns: string
      }
      auto_expire_check_ins: { Args: never; Returns: undefined }
      award_badge: {
        Args: { p_badge_type: string; p_user_id: string }
        Returns: undefined
      }
      award_milestone: {
        Args: { p_milestone_type: string; p_user_id: string }
        Returns: undefined
      }
      calculate_taste_match: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: number
      }
      checkin_with_location: {
        Args: {
          p_event_id: string
          p_latitude: number
          p_longitude: number
          p_user_id: string
        }
        Returns: boolean
      }
      checkin_with_pin: {
        Args: { p_event_id: string; p_pin: string; p_user_id: string }
        Returns: boolean
      }
      cleanup_stale_roulette: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      compute_all_engagement_scores: { Args: never; Returns: number }
      compute_engagement_score: { Args: { p_user_id: string }; Returns: number }
      create_system_notification: {
        Args: {
          p_action_url?: string
          p_body: string
          p_title: string
          p_type?: string
          p_user_id: string
        }
        Returns: string
      }
      find_nearby_sessions: {
        Args: {
          p_latitude: number
          p_limit?: number
          p_longitude: number
          p_radius_km?: number
        }
        Returns: {
          date: string
          distance_km: number
          end_time: string
          event_id: string
          max_spots: number
          neighborhood: string
          rsvp_count: number
          start_time: string
          title: string
          venue_address: string
          venue_latitude: number
          venue_longitude: number
          venue_name: string
        }[]
      }
      get_activity_summary: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
          total_checkins: number
          total_connections: number
          total_requests_helped: number
          weekly_checkins: number
          weekly_goal: number
        }[]
      }
      get_companies_here: {
        Args: { p_location_id?: string; p_user_id: string }
        Returns: {
          company_id: string
          company_logo_url: string
          company_name: string
          company_one_liner: string
          company_stage: string
          has_matching_needs: boolean
          industry_tags: string[]
          member_count: number
          members_here: number
        }[]
      }
      get_company_analytics: { Args: { p_company_id: string }; Returns: Json }
      get_company_matches: {
        Args: { p_company_id: string }
        Returns: {
          company_logo_url: string
          company_name: string
          company_one_liner: string
          company_stage: string
          match_type: string
          matched_company_id: string
          their_need_title: string
          their_offer_title: string
          your_need_title: string
          your_offer_title: string
        }[]
      }
      get_cross_space_people: { Args: never; Returns: Json }
      get_daily_metrics: {
        Args: { p_days?: number }
        Returns: {
          active_users: number
          checkins: number
          connections: number
          date: string
          new_users: number
        }[]
      }
      get_effective_tier: {
        Args: { p_user_id: string }
        Returns: {
          badge_color: string
          boost_expires_at: string
          is_boosted: boolean
          tier_id: string
          tier_name: string
          tier_sort_order: number
        }[]
      }
      get_location_activity: {
        Args: { p_user_id: string }
        Returns: {
          active_count: number
          location_id: string
          location_name: string
          location_type: string
          neighborhood: string
          top_roles: string[]
        }[]
      }
      get_match_explanation: {
        Args: { p_matched_user_id: string; p_session_id?: string }
        Returns: Json
      }
      get_my_circle: {
        Args: { p_user_id: string }
        Returns: {
          avatar_url: string
          circle_user_id: string
          cowork_count: number
          display_name: string
          tagline: string
        }[]
      }
      get_partner_stats: {
        Args: { p_location_id: string }
        Returns: {
          avg_session_minutes: number
          checkins_this_week: number
          checkins_today: number
          repeat_rate: number
          top_times: string[]
          total_checkins: number
          unique_visitors: number
        }[]
      }
      get_platform_analytics: {
        Args: never
        Returns: {
          active_locations: number
          active_now: number
          avg_dna_completion: number
          avg_taste_match: number
          checkins_this_week: number
          checkins_today: number
          connections_this_week: number
          requests_completed: number
          total_checkins: number
          total_connections: number
          total_locations: number
          total_requests: number
          total_users: number
          users_this_month: number
          users_this_week: number
        }[]
      }
      get_public_profile: {
        Args: { p_profile_id: string; p_viewer_id: string }
        Returns: {
          avatar_url: string
          bio: string
          can_offer: string[]
          company: string
          company_visible: boolean
          connection_strength: number
          connection_type: string
          display_name: string
          events_attended: number
          looking_for: string[]
          member_since: string
          mutual_sessions: number
          role_type: string
          skills: string[]
          taste_match_score: number
          topics: string[]
          user_id: string
          values: string[]
          work_style: Json
          work_type: string
        }[]
      }
      get_top_locations: {
        Args: { p_days?: number }
        Returns: {
          checkin_count: number
          location_id: string
          location_name: string
          location_type: string
          unique_users: number
        }[]
      }
      get_user_limit: {
        Args: { p_limit_key: string; p_user_id: string }
        Returns: number
      }
      get_weekly_digest: { Args: { p_user_id?: string }; Returns: Json }
      get_whos_here: {
        Args: {
          p_latitude?: number
          p_location_id?: string
          p_longitude?: number
          p_radius_meters?: number
          p_user_id: string
        }
        Returns: {
          avatar_url: string
          checked_in_at: string
          display_name: string
          location_name: string
          location_type: string
          looking_for: string[]
          mode: string
          note: string
          role_type: string
          skills: string[]
          status: string
          taste_match_score: number
          user_id: string
        }[]
      }
      increment_location_member_count: {
        Args: { p_location_id: string }
        Returns: undefined
      }
      is_feature_enabled: { Args: { p_flag_name: string }; Returns: boolean }
      match_coffee_roulette: {
        Args: { p_user_id: string }
        Returns: {
          matched_avatar_url: string
          matched_display_name: string
          matched_role_type: string
          matched_user_id: string
          taste_match: number
        }[]
      }
      promote_waitlist: { Args: { p_event_id: string }; Returns: string }
      recalculate_behavioral_scores: { Args: never; Returns: undefined }
      recalculate_connection_strength: { Args: never; Returns: undefined }
      record_behavioral_signal: {
        Args: {
          p_context?: string
          p_event_id?: string
          p_location_id?: string
          p_metadata?: Json
          p_signal_type: string
          p_target_user_id?: string
          p_user_id: string
        }
        Returns: undefined
      }
      reject_partner_application: {
        Args: { p_application_id: string; p_reason?: string }
        Returns: undefined
      }
      resolve_check_in_location: {
        Args: { p_latitude: number; p_longitude: number }
        Returns: {
          distance_meters: number
          location_id: string
          location_type: string
          name: string
        }[]
      }
      update_reliability: {
        Args: { p_type: string; p_user_id: string }
        Returns: undefined
      }
      update_user_streak: {
        Args: { p_user_id: string }
        Returns: {
          current_streak: number
          longest_streak: number
          streak_extended: boolean
          weekly_checkins: number
          weekly_goal: number
        }[]
      }
      upsert_connection: {
        Args: {
          p_context?: string
          p_metadata?: Json
          p_type: string
          p_user_a: string
          p_user_b: string
        }
        Returns: string
      }
      user_has_feature: {
        Args: { p_feature_key: string; p_user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
