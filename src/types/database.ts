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

export type StatusSolicitacao = "pendente" | "aprovada" | "recusada";

export type SolicitacaoAcesso = {
  id: string;
  nome: string;
  email: string;
  modulos_solicitados: Modulo[];
  secretaria_sugerida: string | null;
  justificativa: string | null;
  status: StatusSolicitacao;
  decidido_por: string | null;
  decidido_em: string | null;
  observacao_decisao: string | null;
  criado_em: string;
};

export type ConfigModulo = {
  modulo: Modulo;
  login_direto_bloqueado: boolean;
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
      solicitacoes_acesso: Tabela<SolicitacaoAcesso, "nome" | "email" | "modulos_solicitados", "id" | "criado_em">;
      config_modulo: Tabela<ConfigModulo, "modulo", never>;
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
      rejeitar_solicitacao: {
        Args: { p_id: string; p_observacao: string | null };
        Returns: undefined;
      };
      esta_bloqueado_login_direto: {
        Args: { p_modulo: Modulo };
        Returns: boolean;
      };
      definir_bloqueio_login_direto: {
        Args: { p_modulo: Modulo; p_bloqueado: boolean };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
