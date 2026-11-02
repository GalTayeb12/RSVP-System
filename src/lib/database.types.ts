// Generated from supabase/migrations — keep in sync with every migration.
// Rule: every schema change = new migration file + update this file.

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string
          full_name: string | null
          role: 'admin' | 'owner' | 'helper'
          created_at: string
        }
        Insert: {
          id: string
          username: string
          full_name?: string | null
          role?: 'admin' | 'owner' | 'helper'
          created_at?: string
        }
        Update: {
          id?: string
          username?: string
          full_name?: string | null
          role?: 'admin' | 'owner' | 'helper'
          created_at?: string
        }
        Relationships: []
      }

      events: {
        Row: {
          id: string
          owner_id: string
          title: string
          host_names: string | null
          partner_a_name: string | null
          partner_b_name: string | null
          event_date: string | null
          venue_name: string | null
          venue_address: string | null
          waze_url: string | null
          gift_url: string | null
          show_seating: boolean
          invitation_image_url: string | null
          og_image_url: string | null
          message_quota: number
          rsvp_deadline: string | null
          rsvp_settings: Record<string, unknown>
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          title: string
          host_names?: string | null
          partner_a_name?: string | null
          partner_b_name?: string | null
          event_date?: string | null
          venue_name?: string | null
          venue_address?: string | null
          waze_url?: string | null
          gift_url?: string | null
          show_seating?: boolean
          invitation_image_url?: string | null
          og_image_url?: string | null
          message_quota?: number
          rsvp_deadline?: string | null
          rsvp_settings?: Record<string, unknown>
          created_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          title?: string
          host_names?: string | null
          partner_a_name?: string | null
          partner_b_name?: string | null
          event_date?: string | null
          venue_name?: string | null
          venue_address?: string | null
          waze_url?: string | null
          gift_url?: string | null
          show_seating?: boolean
          invitation_image_url?: string | null
          og_image_url?: string | null
          message_quota?: number
          rsvp_deadline?: string | null
          rsvp_settings?: Record<string, unknown>
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'events_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      event_members: {
        Row: {
          event_id: string
          user_id: string
          role: 'admin' | 'owner' | 'helper'
        }
        Insert: {
          event_id: string
          user_id: string
          role?: 'admin' | 'owner' | 'helper'
        }
        Update: {
          event_id?: string
          user_id?: string
          role?: 'admin' | 'owner' | 'helper'
        }
        Relationships: [
          {
            foreignKeyName: 'event_members_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'event_members_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }

      guests: {
        Row: {
          id: string
          event_id: string
          first_name: string
          last_name: string | null
          phone: string
          side: 'groom' | 'bride' | 'shared'
          group_name: string | null
          invited_count: number
          status: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count: number
          meal_notes: string | null
          note: string | null
          table_number: number | null
          rsvp_token: string
          opted_out: boolean
          responded_at: string | null
          rsvp_answers: Record<string, unknown> | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          first_name: string
          last_name?: string | null
          phone: string
          side?: 'groom' | 'bride' | 'shared'
          group_name?: string | null
          invited_count?: number
          status?: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count?: number
          meal_notes?: string | null
          note?: string | null
          table_number?: number | null
          rsvp_token?: string
          opted_out?: boolean
          responded_at?: string | null
          rsvp_answers?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          first_name?: string
          last_name?: string | null
          phone?: string
          side?: 'groom' | 'bride' | 'shared'
          group_name?: string | null
          invited_count?: number
          status?: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count?: number
          meal_notes?: string | null
          note?: string | null
          table_number?: number | null
          rsvp_token?: string
          opted_out?: boolean
          responded_at?: string | null
          rsvp_answers?: Record<string, unknown> | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'guests_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }

      rsvp_history: {
        Row: {
          id: number
          guest_id: string
          status: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count: number
          source: string
          changed_by: string | null
          rsvp_answers: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          guest_id: string
          status: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count?: number
          source: string
          changed_by?: string | null
          rsvp_answers?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          guest_id?: string
          status?: 'pending' | 'attending' | 'declined' | 'maybe'
          attending_count?: number
          source?: string
          changed_by?: string | null
          rsvp_answers?: Record<string, unknown> | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'rsvp_history_guest_id_fkey'
            columns: ['guest_id']
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
        ]
      }

      campaigns: {
        Row: {
          id: string
          event_id: string
          kind: 'invitation' | 'reminder' | 'event_day' | 'thank_you'
          channel: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          template_text: string
          audience: string
          scheduled_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          event_id: string
          kind: 'invitation' | 'reminder' | 'event_day' | 'thank_you'
          channel?: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          template_text: string
          audience?: string
          scheduled_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          kind?: 'invitation' | 'reminder' | 'event_day' | 'thank_you'
          channel?: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          template_text?: string
          audience?: string
          scheduled_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'campaigns_event_id_fkey'
            columns: ['event_id']
            referencedRelation: 'events'
            referencedColumns: ['id']
          },
        ]
      }

      messages: {
        Row: {
          id: string
          campaign_id: string
          guest_id: string
          channel: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
          text: string | null
          provider_id: string | null
          error: string | null
          error_code: string | null
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          failed_at: string | null
          locked_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          campaign_id: string
          guest_id: string
          channel: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
          text?: string | null
          provider_id?: string | null
          error?: string | null
          error_code?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          campaign_id?: string
          guest_id?: string
          channel?: 'whatsapp_link' | 'whatsapp_api' | 'sms'
          status?: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
          text?: string | null
          provider_id?: string | null
          error?: string | null
          error_code?: string | null
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          failed_at?: string | null
          locked_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_campaign_id_fkey'
            columns: ['campaign_id']
            referencedRelation: 'campaigns'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_guest_id_fkey'
            columns: ['guest_id']
            referencedRelation: 'guests'
            referencedColumns: ['id']
          },
        ]
      }

      webhook_events: {
        Row: {
          id: number
          received_at: string
          payload: Record<string, unknown>
          processed: boolean
          error: string | null
        }
        Insert: {
          id?: number
          received_at?: string
          payload: Record<string, unknown>
          processed?: boolean
          error?: string | null
        }
        Update: {
          id?: number
          received_at?: string
          payload?: Record<string, unknown>
          processed?: boolean
          error?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      can_access_event: {
        Args: { e: string }
        Returns: boolean
      }
      can_manage_event: {
        Args: { e: string }
        Returns: boolean
      }
      claim_messages_batch: {
        Args: { p_campaign_id: string; p_limit?: number }
        Returns: Array<{ id: string; guest_id: string; msg_text: string | null }>
      }
    }
    Enums: {
      user_role: 'admin' | 'owner' | 'helper'
      rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe'
      guest_side: 'groom' | 'bride' | 'shared'
      campaign_kind: 'invitation' | 'reminder' | 'event_day' | 'thank_you'
      message_channel: 'whatsapp_link' | 'whatsapp_api' | 'sms'
      message_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
