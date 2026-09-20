// Generated from the Supabase project schema (supabase/migrations). Regenerate
// after every migration; do not hand-edit.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      challenge_entries: {
        Row: {
          challenge_id: string
          created_at: string
          duration_ms: number
          play_id: string
          user_id: string
        }
        Insert: {
          challenge_id: string
          created_at?: string
          duration_ms: number
          play_id: string
          user_id: string
        }
        Update: {
          challenge_id?: string
          created_at?: string
          duration_ms?: number
          play_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenge_entries_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_entries_play_id_fkey"
            columns: ["play_id"]
            isOneToOne: false
            referencedRelation: "plays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "challenge_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          creator_id: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          game_id: Database["public"]["Enums"]["game_id"]
          id: string
          seed: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          difficulty: Database["public"]["Enums"]["difficulty"]
          game_id: Database["public"]["Enums"]["game_id"]
          id?: string
          seed: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          difficulty?: Database["public"]["Enums"]["difficulty"]
          game_id?: Database["public"]["Enums"]["game_id"]
          id?: string
          seed?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plays: {
        Row: {
          completed_at: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          duration_ms: number | null
          game_id: Database["public"]["Enums"]["game_id"]
          id: string
          mistakes: number
          mode: Database["public"]["Enums"]["play_mode"]
          move_log: Json | null
          puzzle_date: string | null
          seed: string
          started_at: string
          state: Json | null
          status: Database["public"]["Enums"]["play_status"]
          updated_at: string
          user_id: string
          validated: boolean
        }
        Insert: {
          completed_at?: string | null
          difficulty: Database["public"]["Enums"]["difficulty"]
          duration_ms?: number | null
          game_id: Database["public"]["Enums"]["game_id"]
          id?: string
          mistakes?: number
          mode: Database["public"]["Enums"]["play_mode"]
          move_log?: Json | null
          puzzle_date?: string | null
          seed: string
          started_at?: string
          state?: Json | null
          status?: Database["public"]["Enums"]["play_status"]
          updated_at?: string
          user_id: string
          validated?: boolean
        }
        Update: {
          completed_at?: string | null
          difficulty?: Database["public"]["Enums"]["difficulty"]
          duration_ms?: number | null
          game_id?: Database["public"]["Enums"]["game_id"]
          id?: string
          mistakes?: number
          mode?: Database["public"]["Enums"]["play_mode"]
          move_log?: Json | null
          puzzle_date?: string | null
          seed?: string
          started_at?: string
          state?: Json | null
          status?: Database["public"]["Enums"]["play_status"]
          updated_at?: string
          user_id?: string
          validated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plays_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          handle: string | null
          id: string
          is_anonymous: boolean
        }
        Insert: {
          created_at?: string
          handle?: string | null
          id: string
          is_anonymous?: boolean
        }
        Update: {
          created_at?: string
          handle?: string | null
          id?: string
          is_anonymous?: boolean
        }
        Relationships: []
      }
      streaks: {
        Row: {
          current: number
          game_id: Database["public"]["Enums"]["game_id"]
          last_solved_date: string | null
          longest: number
          user_id: string
        }
        Insert: {
          current?: number
          game_id: Database["public"]["Enums"]["game_id"]
          last_solved_date?: string | null
          longest?: number
          user_id: string
        }
        Update: {
          current?: number
          game_id?: Database["public"]["Enums"]["game_id"]
          last_solved_date?: string | null
          longest?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "streaks_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
      difficulty: "easy" | "normal" | "hard"
      game_id: "nine" | "crowns" | "eclipse" | "thread" | "quilt"
      play_mode: "daily" | "practice" | "challenge"
      play_status: "in_progress" | "solved" | "abandoned"
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

export const Constants = {
  public: {
    Enums: {
      difficulty: ["easy", "normal", "hard"],
      game_id: ["nine", "crowns", "eclipse", "thread", "quilt"],
      play_mode: ["daily", "practice", "challenge"],
      play_status: ["in_progress", "solved", "abandoned"],
    },
  },
} as const
