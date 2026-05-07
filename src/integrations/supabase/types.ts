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
      admin_access_logs: {
        Row: {
          accessed_at: string
          id: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          accessed_at?: string
          id?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          accessed_at?: string
          id?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          course_id: string
          created_at: string
          date: string
          duration_minutes: number
          id: string
          status: string
          type: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          status?: string
          type?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          date?: string
          duration_minutes?: number
          id?: string
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      bulk_import_audit: {
        Row: {
          created_at: string
          created_count: number
          error_count: number
          id: string
          performed_by: string
          skipped_count: number
          summary: Json | null
          total_rows: number
        }
        Insert: {
          created_at?: string
          created_count?: number
          error_count?: number
          id?: string
          performed_by: string
          skipped_count?: number
          summary?: Json | null
          total_rows?: number
        }
        Update: {
          created_at?: string
          created_count?: number
          error_count?: number
          id?: string
          performed_by?: string
          skipped_count?: number
          summary?: Json | null
          total_rows?: number
        }
        Relationships: []
      }
      certificate_templates: {
        Row: {
          active: boolean
          created_at: string
          file_url: string
          id: string
          name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          file_url: string
          id?: string
          name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          file_url?: string
          id?: string
          name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      certificates: {
        Row: {
          code: string
          course_id: string
          created_at: string
          id: string
          issued_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          code?: string
          course_id: string
          created_at?: string
          id?: string
          issued_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          course_id?: string
          created_at?: string
          id?: string
          issued_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      cooperado_pending_registrations: {
        Row: {
          cooperativa: string | null
          cpf: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          password_hash: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          cooperativa?: string | null
          cpf: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          password_hash: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          cooperativa?: string | null
          cpf?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          password_hash?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cooperativas: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      course_books: {
        Row: {
          cooperado_only: boolean
          course_id: string
          created_at: string
          file_url: string | null
          id: string
          size: string | null
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          cooperado_only?: boolean
          course_id: string
          created_at?: string
          file_url?: string | null
          id?: string
          size?: string | null
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          cooperado_only?: boolean
          course_id?: string
          created_at?: string
          file_url?: string | null
          id?: string
          size?: string | null
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_books_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_chat_messages: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      course_evaluations: {
        Row: {
          course_id: string
          created_at: string
          duration: number
          id: string
          lesson_id: string | null
          questions: number
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          duration?: number
          id?: string
          lesson_id?: string | null
          questions?: number
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          duration?: number
          id?: string
          lesson_id?: string | null
          questions?: number
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_evaluations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_lessons: {
        Row: {
          completed: boolean
          content_url: string | null
          created_at: string
          duration: string | null
          id: string
          module_id: string
          sort_order: number
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          content_url?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          module_id: string
          sort_order?: number
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          content_url?: string | null
          created_at?: string
          duration?: string | null
          id?: string
          module_id?: string
          sort_order?: number
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          locked: boolean
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          locked?: boolean
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          locked?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          cooperado_only: boolean
          created_at: string
          created_by: string | null
          description: string | null
          duration: string | null
          id: string
          image: string | null
          is_paid: boolean
          price: number | null
          promotional_price: number | null
          title: string
          updated_at: string
        }
        Insert: {
          cooperado_only?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          image?: string | null
          is_paid?: boolean
          price?: number | null
          promotional_price?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          cooperado_only?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          image?: string | null
          is_paid?: boolean
          price?: number | null
          promotional_price?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      edge_function_rate_limits: {
        Row: {
          function_name: string
          id: string
          identifier: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          function_name: string
          id?: string
          identifier: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Update: {
          function_name?: string
          id?: string
          identifier?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_id: string
          enrolled_at: string
          id: string
          last_accessed_at: string | null
          last_accessed_lesson_id: string | null
          progress: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          last_accessed_lesson_id?: string | null
          progress?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string
          enrolled_at?: string
          id?: string
          last_accessed_at?: string | null
          last_accessed_lesson_id?: string | null
          progress?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluation_questions: {
        Row: {
          correct_option: string
          created_at: string
          evaluation_id: string
          id: string
          option_a: string
          option_b: string
          option_c: string
          option_d: string
          question_text: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          correct_option?: string
          created_at?: string
          evaluation_id: string
          id?: string
          option_a: string
          option_b: string
          option_c?: string
          option_d?: string
          question_text: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          correct_option?: string
          created_at?: string
          evaluation_id?: string
          id?: string
          option_a?: string
          option_b?: string
          option_c?: string
          option_d?: string
          question_text?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_questions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "course_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          answers: Json
          correct_count: number
          evaluation_id: string
          id: string
          score: number
          submitted_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          answers?: Json
          correct_count?: number
          evaluation_id: string
          id?: string
          score?: number
          submitted_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          answers?: Json
          correct_count?: number
          evaluation_id?: string
          id?: string
          score?: number
          submitted_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      forum_replies: {
        Row: {
          content: string
          created_at: string
          id: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_replies_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "forum_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      forum_topics: {
        Row: {
          category: string
          closed: boolean
          content: string
          course_id: string | null
          created_at: string
          id: string
          pinned: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          closed?: boolean
          content: string
          course_id?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          closed?: boolean
          content?: string
          course_id?: string | null
          created_at?: string
          id?: string
          pinned?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "forum_topics_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: []
      }
      lesson_notes: {
        Row: {
          content: string
          course_id: string
          created_at: string
          id: string
          lesson_id: string
          updated_at: string
          user_id: string
          video_timestamp_seconds: number | null
        }
        Insert: {
          content: string
          course_id: string
          created_at?: string
          id?: string
          lesson_id: string
          updated_at?: string
          user_id: string
          video_timestamp_seconds?: number | null
        }
        Update: {
          content?: string
          course_id?: string
          created_at?: string
          id?: string
          lesson_id?: string
          updated_at?: string
          user_id?: string
          video_timestamp_seconds?: number | null
        }
        Relationships: []
      }
      media_files: {
        Row: {
          cooperado_only: boolean
          course_id: string | null
          created_at: string
          description: string | null
          file_size: string | null
          file_type: string
          file_url: string
          id: string
          module_name: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          cooperado_only?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: string | null
          file_type: string
          file_url: string
          id?: string
          module_name?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          cooperado_only?: boolean
          course_id?: string | null
          created_at?: string
          description?: string | null
          file_size?: string | null
          file_type?: string
          file_url?: string
          id?: string
          module_name?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          cooperativa: string | null
          cpf: string | null
          created_at: string
          deactivated_at: string | null
          enrollment_number: string | null
          full_name: string
          id: string
          is_active: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          cooperativa?: string | null
          cpf?: string | null
          created_at?: string
          deactivated_at?: string | null
          enrollment_number?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          cooperativa?: string | null
          cpf?: string | null
          created_at?: string
          deactivated_at?: string | null
          enrollment_number?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          course_id: string
          created_at: string
          currency: string
          environment: string
          id: string
          paid_at: string | null
          provider: string | null
          provider_payment_id: string | null
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          course_id: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          course_id?: string
          created_at?: string
          currency?: string
          environment?: string
          id?: string
          paid_at?: string | null
          provider?: string | null
          provider_payment_id?: string | null
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          features: Json
          id: string
          interval: string
          is_active: boolean
          name: string
          price: number
          slug: string
          sort_order: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name: string
          price?: number
          slug: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          interval?: string
          is_active?: boolean
          name?: string
          price?: number
          slug?: string
          sort_order?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          status: string
          subject: string
          unread_for_admin: number
          unread_for_user: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          subject?: string
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          subject?: string
          unread_for_admin?: number
          unread_for_user?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
          sender_role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
          sender_role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mfa_factors: {
        Row: {
          factor_id: string
          factor_type: string
          friendly_name: string | null
          id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          factor_id: string
          factor_type?: string
          friendly_name?: string | null
          id?: string
          user_id: string
          verified_at?: string
        }
        Update: {
          factor_id?: string
          factor_type?: string
          friendly_name?: string | null
          id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          plan_id: string
          price_id: string | null
          product_id: string | null
          provider: string | null
          provider_subscription_id: string | null
          started_at: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_id: string
          price_id?: string | null
          product_id?: string | null
          provider?: string | null
          provider_subscription_id?: string | null
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          plan_id?: string
          price_id?: string | null
          product_id?: string | null
          provider?: string | null
          provider_subscription_id?: string | null
          started_at?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      evaluation_questions_safe: {
        Row: {
          created_at: string | null
          evaluation_id: string | null
          id: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question_text: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_questions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "course_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          cooperativa: string | null
          full_name: string | null
          is_active: boolean | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          cooperativa?: string | null
          full_name?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          cooperativa?: string | null
          full_name?: string | null
          is_active?: boolean | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_evaluation_questions: {
        Row: {
          created_at: string | null
          evaluation_id: string | null
          id: string | null
          option_a: string | null
          option_b: string | null
          option_c: string | null
          option_d: string | null
          question_text: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          evaluation_id?: string | null
          id?: string | null
          option_a?: string | null
          option_b?: string | null
          option_c?: string | null
          option_d?: string | null
          question_text?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evaluation_questions_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "course_evaluations"
            referencedColumns: ["id"]
          },
        ]
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          full_name: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          full_name?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      assign_default_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      assign_default_role_bulk: { Args: never; Returns: number }
      can_access_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      get_admin_reports: { Args: never; Returns: Json }
      get_duplicate_enrollments: {
        Args: never
        Returns: {
          enrollment_number: string
          occurrences: number
          user_ids: string[]
        }[]
      }
      get_enrollment_diagnostics: {
        Args: never
        Returns: {
          total_duplicates: number
          total_invalid_format: number
          total_missing_gaps: number
          total_profiles: number
          total_with_valid_enrollment: number
          total_without_enrollment: number
        }[]
      }
      get_missing_enrollments_with_users: {
        Args: never
        Returns: {
          missing_enrollment_number: string
          possible_user_created_at: string
          possible_user_email: string
          possible_user_id: string
          possible_user_name: string
        }[]
      }
      get_public_profiles: {
        Args: { _user_ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      get_question_answer: { Args: { _question_id: string }; Returns: string }
      get_users_with_invalid_enrollment: {
        Args: never
        Returns: {
          cooperativa: string
          created_at: string
          email: string
          enrollment_number: string
          full_name: string
          is_active: boolean
          reason: string
          user_id: string
        }[]
      }
      get_users_without_role: {
        Args: never
        Returns: {
          cooperativa: string
          created_at: string
          enrollment_number: string
          full_name: string
          is_active: boolean
          user_id: string
        }[]
      }
      has_active_subscription: { Args: { _user_id: string }; Returns: boolean }
      has_purchased_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_master_admin: { Args: { _user_id: string }; Returns: boolean }
      link_enrollment_to_user: {
        Args: { _enrollment_number: string; _user_id: string }
        Returns: undefined
      }
      list_public_profiles: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          user_id: string
        }[]
      }
      log_admin_access: { Args: { _user_agent?: string }; Returns: undefined }
      mark_lesson_access: {
        Args: { _course_id: string; _lesson_id: string }
        Returns: undefined
      }
      reset_course_progress: {
        Args: { _course_id: string }
        Returns: undefined
      }
      submit_exam_answers: {
        Args: { _answers: Json; _evaluation_id: string }
        Returns: Json
      }
      validate_certificate: {
        Args: { _code: string }
        Returns: {
          code: string
          course_duration: string
          course_title: string
          issued_at: string
          status: string
          student_name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "aluno" | "cooperado" | "moderador"
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
      app_role: ["admin", "aluno", "cooperado", "moderador"],
    },
  },
} as const
