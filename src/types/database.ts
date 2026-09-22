/**
 * Tipos do banco de dados (espelham supabase/migrations).
 * Schema `hub`, no mesmo projeto Supabase do App-Compras/Requerimentos.
 */

export type UsuarioHub = {
  id: string;
  nome: string;
  email: string;
  admin_hub: boolean;
  ativo: boolean;
  criado_em: string;
};

export type Modulo = "compras" | "numera" | "requerimentos";

export type AcessoModulo = {
  id: string;
  usuario_id: string;
  modulo: Modulo;
};

type Tabela<Row, Obrigatorios extends keyof Row, Gerados extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Obrigatorios> & Partial<Omit<Row, Obrigatorios | Gerados>>;
  Update: Partial<Omit<Row, Gerados>>;
  Relationships: [];
};

export type Database = {
  hub: {
    Tables: {
      usuarios: Tabela<UsuarioHub, "id" | "nome" | "email", never>;
      acessos_modulo: Tabela<AcessoModulo, "usuario_id" | "modulo", "id">;
    };
    Views: Record<string, never>;
    Functions: {
      definir_acesso: {
        Args: {
          p_email: string;
          p_nome: string;
          p_admin_hub: boolean;
          p_modulos: Modulo[];
          p_ativo: boolean;
        };
        Returns: string;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
