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
      capture_items: {
        Row: {
          chance_drop: number
          cor: string
          created_at: string
          id: number
          nome: string
          taxa_sucesso: number
          tier: number
        }
        Insert: {
          chance_drop: number
          cor?: string
          created_at?: string
          id: number
          nome: string
          taxa_sucesso: number
          tier: number
        }
        Update: {
          chance_drop?: number
          cor?: string
          created_at?: string
          id?: number
          nome?: string
          taxa_sucesso?: number
          tier?: number
        }
        Relationships: []
      }
      creatures: {
        Row: {
          capturada_em: string
          exp: number
          id: string
          is_shiny: boolean
          iv_ataque: number
          iv_defesa: number
          iv_hp: number
          iv_velocidade: number
          nature: string
          nivel: number
          raridade: string
          species_id: number
          user_id: string
        }
        Insert: {
          capturada_em?: string
          exp?: number
          id?: string
          is_shiny?: boolean
          iv_ataque?: number
          iv_defesa?: number
          iv_hp?: number
          iv_velocidade?: number
          nature?: string
          nivel?: number
          raridade?: string
          species_id: number
          user_id: string
        }
        Update: {
          capturada_em?: string
          exp?: number
          id?: string
          is_shiny?: boolean
          iv_ataque?: number
          iv_defesa?: number
          iv_hp?: number
          iv_velocidade?: number
          nature?: string
          nivel?: number
          raridade?: string
          species_id?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creatures_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      hunting_sessions: {
        Row: {
          creature_id: string
          exp_total: number
          fase: number
          fase_kills: number
          id: string
          iniciado_em: string
          kills_total: number
          pending_expira_em: string | null
          pending_nivel: number | null
          pending_species_id: number | null
          pressao: number
          region_id: number
          ultima_coleta_em: string
          ultima_resolucao_em: string
          user_id: string
        }
        Insert: {
          creature_id: string
          exp_total?: number
          fase?: number
          fase_kills?: number
          id?: string
          iniciado_em?: string
          kills_total?: number
          pending_expira_em?: string | null
          pending_nivel?: number | null
          pending_species_id?: number | null
          pressao?: number
          region_id: number
          ultima_coleta_em?: string
          ultima_resolucao_em?: string
          user_id: string
        }
        Update: {
          creature_id?: string
          exp_total?: number
          fase?: number
          fase_kills?: number
          id?: string
          iniciado_em?: string
          kills_total?: number
          pending_expira_em?: string | null
          pending_nivel?: number | null
          pending_species_id?: number | null
          pressao?: number
          region_id?: number
          ultima_coleta_em?: string
          ultima_resolucao_em?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hunting_sessions_creature_id_fkey"
            columns: ["creature_id"]
            isOneToOne: false
            referencedRelation: "creatures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hunting_sessions_pending_species_id_fkey"
            columns: ["pending_species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hunting_sessions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auto_captura: boolean
          criado_em: string
          id: string
          nome_treinador: string
          starter_escolhido: boolean
        }
        Insert: {
          auto_captura?: boolean
          criado_em?: string
          id: string
          nome_treinador: string
          starter_escolhido?: boolean
        }
        Update: {
          auto_captura?: boolean
          criado_em?: string
          id?: string
          nome_treinador?: string
          starter_escolhido?: boolean
        }
        Relationships: []
      }
      regions: {
        Row: {
          descricao: string | null
          fases: number
          id: number
          multiplicador_raridade: number
          nivel_maximo: number
          nivel_minimo: number
          nome: string
          species_ids: number[]
        }
        Insert: {
          descricao?: string | null
          fases?: number
          id?: number
          multiplicador_raridade?: number
          nivel_maximo: number
          nivel_minimo: number
          nome: string
          species_ids?: number[]
        }
        Update: {
          descricao?: string | null
          fases?: number
          id?: number
          multiplicador_raridade?: number
          nivel_maximo?: number
          nivel_minimo?: number
          nome?: string
          species_ids?: number[]
        }
        Relationships: []
      }
      species: {
        Row: {
          ataque_base: number
          defesa_base: number
          hp_base: number
          id: number
          is_starter: boolean
          nome: string
          sprite_url: string | null
          taxa_raridade_base: number
          tipo_primario: string
          tipo_secundario: string | null
          velocidade_base: number
        }
        Insert: {
          ataque_base: number
          defesa_base: number
          hp_base: number
          id?: number
          is_starter?: boolean
          nome: string
          sprite_url?: string | null
          taxa_raridade_base?: number
          tipo_primario: string
          tipo_secundario?: string | null
          velocidade_base: number
        }
        Update: {
          ataque_base?: number
          defesa_base?: number
          hp_base?: number
          id?: number
          is_starter?: boolean
          nome?: string
          sprite_url?: string | null
          taxa_raridade_base?: number
          tipo_primario?: string
          tipo_secundario?: string | null
          velocidade_base?: number
        }
        Relationships: []
      }
      user_items: {
        Row: {
          created_at: string
          item_id: number
          quantidade: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: number
          quantidade?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: number
          quantidade?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "capture_items"
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
    Enums: {},
  },
} as const
