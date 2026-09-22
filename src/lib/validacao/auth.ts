import { z } from "zod";

export const esquemaLogin = z.object({
  email: z.email({ message: "Informe um e-mail válido" }),
  senha: z.string().min(1, "Informe a senha"),
});

export const esquemaRecuperacao = z.object({
  email: z.email({ message: "Informe um e-mail válido" }),
});

export const esquemaNovaSenha = z
  .object({
    senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, {
    message: "As senhas não conferem",
    path: ["confirmar"],
  });

export const esquemaMudarSenhaLogado = z
  .object({
    senhaAtual: z.string().min(1, "Informe a senha atual"),
    senhaNova: z.string().min(8, "A nova senha precisa ter pelo menos 8 caracteres"),
    confirmar: z.string(),
  })
  .refine((d) => d.senhaNova === d.confirmar, {
    message: "As senhas não conferem",
    path: ["confirmar"],
  })
  .refine((d) => d.senhaAtual !== d.senhaNova, {
    message: "A nova senha não pode ser igual à senha atual",
    path: ["senhaNova"],
  });
