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
    PostgrestVersion: "14.18"
  }
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
      asignaciones: {
        Row: {
          alumno_id: string
          created_at: string
          estado: Database["public"]["Enums"]["estado_asignacion"]
          estimulo_actual: number
          fecha_fin: string | null
          fecha_inicio: string
          id: string
          plan_id: string
          semana_actual: number
          updated_at: string
        }
        Insert: {
          alumno_id: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          estimulo_actual?: number
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          plan_id: string
          semana_actual?: number
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_asignacion"]
          estimulo_actual?: number
          fecha_fin?: string | null
          fecha_inicio?: string
          id?: string
          plan_id?: string
          semana_actual?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "asignaciones_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "asignaciones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      bloque_ejercicios: {
        Row: {
          alternativa_id: string | null
          bloque_id: string
          carga_sugerida: string | null
          created_at: string
          ejercicio_id: string
          id: string
          nota: string | null
          orden: number
          registra_carga: boolean
          reps: string | null
          series: string | null
          updated_at: string
        }
        Insert: {
          alternativa_id?: string | null
          bloque_id: string
          carga_sugerida?: string | null
          created_at?: string
          ejercicio_id: string
          id?: string
          nota?: string | null
          orden: number
          registra_carga?: boolean
          reps?: string | null
          series?: string | null
          updated_at?: string
        }
        Update: {
          alternativa_id?: string | null
          bloque_id?: string
          carga_sugerida?: string | null
          created_at?: string
          ejercicio_id?: string
          id?: string
          nota?: string | null
          orden?: number
          registra_carga?: boolean
          reps?: string | null
          series?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloque_ejercicios_alternativa_id_fkey"
            columns: ["alternativa_id"]
            isOneToOne: false
            referencedRelation: "ejercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloque_ejercicios_bloque_id_fkey"
            columns: ["bloque_id"]
            isOneToOne: false
            referencedRelation: "bloques"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloque_ejercicios_ejercicio_id_fkey"
            columns: ["ejercicio_id"]
            isOneToOne: false
            referencedRelation: "ejercicios"
            referencedColumns: ["id"]
          },
        ]
      }
      bloques: {
        Row: {
          created_at: string
          id: string
          indicacion: string | null
          nombre: string
          orden: number
          sesion_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          indicacion?: string | null
          nombre: string
          orden: number
          sesion_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          indicacion?: string | null
          nombre?: string
          orden?: number
          sesion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bloques_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      ejercicios: {
        Row: {
          activo: boolean
          created_at: string
          descripcion: string | null
          gym_id: string
          id: string
          nombre: string
          updated_at: string
          video_url: string | null
          youtube_id: string | null
        }
        Insert: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          gym_id: string
          id?: string
          nombre: string
          updated_at?: string
          video_url?: string | null
          youtube_id?: string | null
        }
        Update: {
          activo?: boolean
          created_at?: string
          descripcion?: string | null
          gym_id?: string
          id?: string
          nombre?: string
          updated_at?: string
          video_url?: string | null
          youtube_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ejercicios_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      fichas_salud: {
        Row: {
          actividad_fisica_actual: string | null
          actividad_laboral: string | null
          alcohol: string | null
          alumno_id: string
          cirugias: string | null
          created_at: string
          lesiones: string | null
          medicacion: string | null
          plan_nutricional: string | null
          suplementos: string | null
          tabaco: string | null
          updated_at: string
        }
        Insert: {
          actividad_fisica_actual?: string | null
          actividad_laboral?: string | null
          alcohol?: string | null
          alumno_id: string
          cirugias?: string | null
          created_at?: string
          lesiones?: string | null
          medicacion?: string | null
          plan_nutricional?: string | null
          suplementos?: string | null
          tabaco?: string | null
          updated_at?: string
        }
        Update: {
          actividad_fisica_actual?: string | null
          actividad_laboral?: string | null
          alcohol?: string | null
          alumno_id?: string
          cirugias?: string | null
          created_at?: string
          lesiones?: string | null
          medicacion?: string | null
          plan_nutricional?: string | null
          suplementos?: string | null
          tabaco?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fichas_salud_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gyms: {
        Row: {
          created_at: string
          id: string
          nombre: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          nombre: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          nombre?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      planes: {
        Row: {
          alumno_id: string | null
          created_at: string
          gym_id: string
          id: string
          nivel: string | null
          nombre: string
          origen_id: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          alumno_id?: string | null
          created_at?: string
          gym_id: string
          id?: string
          nivel?: string | null
          nombre: string
          origen_id?: string | null
          tipo: string
          updated_at?: string
        }
        Update: {
          alumno_id?: string | null
          created_at?: string
          gym_id?: string
          id?: string
          nivel?: string | null
          nombre?: string
          origen_id?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planes_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "planes_origen_id_fkey"
            columns: ["origen_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          apellido: string
          created_at: string
          dni: string
          email: string
          estado: Database["public"]["Enums"]["estado_usuario"]
          gym_id: string
          id: string
          nombre: string
          rol: Database["public"]["Enums"]["rol"]
          updated_at: string
        }
        Insert: {
          apellido: string
          created_at?: string
          dni: string
          email: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          gym_id: string
          id: string
          nombre: string
          rol?: Database["public"]["Enums"]["rol"]
          updated_at?: string
        }
        Update: {
          apellido?: string
          created_at?: string
          dni?: string
          email?: string
          estado?: Database["public"]["Enums"]["estado_usuario"]
          gym_id?: string
          id?: string
          nombre?: string
          rol?: Database["public"]["Enums"]["rol"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_gym_id_fkey"
            columns: ["gym_id"]
            isOneToOne: false
            referencedRelation: "gyms"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ejercicios: {
        Row: {
          bloque_ejercicio_id: string
          created_at: string
          hecho: boolean
          id: string
          registro_id: string
          updated_at: string
        }
        Insert: {
          bloque_ejercicio_id: string
          created_at?: string
          hecho?: boolean
          id?: string
          registro_id: string
          updated_at?: string
        }
        Update: {
          bloque_ejercicio_id?: string
          created_at?: string
          hecho?: boolean
          id?: string
          registro_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_ejercicios_bloque_ejercicio_id_fkey"
            columns: ["bloque_ejercicio_id"]
            isOneToOne: false
            referencedRelation: "bloque_ejercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ejercicios_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_sesion"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_series: {
        Row: {
          bloque_ejercicio_id: string | null
          created_at: string
          ejercicio_usado_id: string
          id: string
          n_serie: number
          peso: number | null
          registro_id: string
          reps: number | null
          updated_at: string
        }
        Insert: {
          bloque_ejercicio_id?: string | null
          created_at?: string
          ejercicio_usado_id: string
          id?: string
          n_serie: number
          peso?: number | null
          registro_id: string
          reps?: number | null
          updated_at?: string
        }
        Update: {
          bloque_ejercicio_id?: string | null
          created_at?: string
          ejercicio_usado_id?: string
          id?: string
          n_serie?: number
          peso?: number | null
          registro_id?: string
          reps?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_series_bloque_ejercicio_id_fkey"
            columns: ["bloque_ejercicio_id"]
            isOneToOne: false
            referencedRelation: "bloque_ejercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_series_ejercicio_usado_id_fkey"
            columns: ["ejercicio_usado_id"]
            isOneToOne: false
            referencedRelation: "ejercicios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_series_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "registros_sesion"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_sesion: {
        Row: {
          asignacion_id: string
          completada: boolean
          created_at: string
          fecha: string
          id: string
          sesion_id: string
          updated_at: string
        }
        Insert: {
          asignacion_id: string
          completada?: boolean
          created_at?: string
          fecha?: string
          id?: string
          sesion_id: string
          updated_at?: string
        }
        Update: {
          asignacion_id?: string
          completada?: boolean
          created_at?: string
          fecha?: string
          id?: string
          sesion_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_sesion_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "asignaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_sesion_sesion_id_fkey"
            columns: ["sesion_id"]
            isOneToOne: false
            referencedRelation: "sesiones"
            referencedColumns: ["id"]
          },
        ]
      }
      sesiones: {
        Row: {
          created_at: string
          estimulo: number
          id: string
          plan_id: string
          semana: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          estimulo: number
          id?: string
          plan_id: string
          semana: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          estimulo?: number
          id?: string
          plan_id?: string
          semana?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sesiones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "planes"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitudes_ciclo: {
        Row: {
          alumno_id: string
          asignacion_id: string
          atendida_por: string | null
          created_at: string
          estado: Database["public"]["Enums"]["estado_solicitud"]
          id: string
          nota: string | null
          tipo_solicitado: string
          updated_at: string
        }
        Insert: {
          alumno_id: string
          asignacion_id: string
          atendida_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota?: string | null
          tipo_solicitado: string
          updated_at?: string
        }
        Update: {
          alumno_id?: string
          asignacion_id?: string
          atendida_por?: string | null
          created_at?: string
          estado?: Database["public"]["Enums"]["estado_solicitud"]
          id?: string
          nota?: string | null
          tipo_solicitado?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitudes_ciclo_alumno_id_fkey"
            columns: ["alumno_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_ciclo_asignacion_id_fkey"
            columns: ["asignacion_id"]
            isOneToOne: false
            referencedRelation: "asignaciones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitudes_ciclo_atendida_por_fkey"
            columns: ["atendida_por"]
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
      _clonar_bloques: {
        Args: { p_destino: string; p_origen: string }
        Returns: undefined
      }
      alumno_en_mi_gym: { Args: { p_alumno_id: string }; Returns: boolean }
      alumno_tiene_plan: { Args: { p_plan_id: string }; Returns: boolean }
      alumno_ve_ejercicio: {
        Args: { p_ejercicio_id: string }
        Returns: boolean
      }
      asignar_plan: {
        Args: { p_alumno_id: string; p_plan_id: string }
        Returns: string
      }
      atender_solicitud: {
        Args: { p_plan_id: string; p_solicitud_id: string }
        Returns: string
      }
      completar_sesion: {
        Args: { p_asignacion_id: string; p_sesion_id: string }
        Returns: boolean
      }
      copiar_semana: {
        Args: {
          p_plan_id: string
          p_semana_destino: number
          p_semana_origen: number
        }
        Returns: number
      }
      current_estado: {
        Args: never
        Returns: Database["public"]["Enums"]["estado_usuario"]
      }
      current_gym_id: { Args: never; Returns: string }
      current_rol: { Args: never; Returns: Database["public"]["Enums"]["rol"] }
      duplicar_plan: {
        Args: {
          p_nivel: string
          p_nombre: string
          p_plan_id: string
          p_tipo: string
        }
        Returns: string
      }
      email_por_dni: { Args: { p_dni: string }; Returns: string }
      is_alumno_activo: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      personalizar_plan: {
        Args: { p_alumno_id: string; p_plan_id: string }
        Returns: string
      }
      plan_en_mi_gym: { Args: { p_plan_id: string }; Returns: boolean }
    }
    Enums: {
      estado_asignacion: "activa" | "finalizada"
      estado_solicitud: "pendiente" | "atendida"
      estado_usuario: "pendiente" | "activo" | "inactivo"
      rol: "admin" | "profe" | "alumno"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      estado_asignacion: ["activa", "finalizada"],
      estado_solicitud: ["pendiente", "atendida"],
      estado_usuario: ["pendiente", "activo", "inactivo"],
      rol: ["admin", "profe", "alumno"],
    },
  },
} as const
