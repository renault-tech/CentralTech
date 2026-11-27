/**
 * Seletor de pastas do Google (Google Picker). Carrega o script do Google só quando o administrador clica.
 * O Google só deixa o app enxergar uma pasta existente se a pessoa a escolher por aqui (escopo `drive.file`).
 */
type Dados = { token: string; chave: string; projeto: string };

type PickerBuilderT = {
  addView(v: unknown): PickerBuilderT;
  setOAuthToken(t: string): PickerBuilderT;
  setDeveloperKey(k: string): PickerBuilderT;
  setAppId(a: string): PickerBuilderT;
  setLocale(l: string): PickerBuilderT;
  setTitle(t: string): PickerBuilderT;
  setCallback(cb: (r: { action: string; docs?: { id: string; name: string }[] }) => void): PickerBuilderT;
  build(): { setVisible(v: boolean): void };
};
type GoogleGlobal = {
  picker: {
    PickerBuilder: new () => PickerBuilderT;
    DocsView: new (id: unknown) => { setIncludeFolders(b: boolean): unknown; setSelectFolderEnabled(b: boolean): unknown; setMimeTypes(m: string): unknown };
    ViewId: { FOLDERS: unknown };
    Action: { PICKED: string; CANCEL: string };
  };
};
type JanelaGoogle = Window & { gapi?: { load(nome: string, cb: () => void): void }; google?: GoogleGlobal };

function carregarScript(): Promise<void> {
  return new Promise((ok, erro) => {
    const w = window as JanelaGoogle;
    if (w.gapi) return ok();
    const s = document.createElement("script");
    s.src = "https://apis.google.com/js/api.js";
    s.async = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error("Não foi possível carregar o seletor do Google."));
    document.head.appendChild(s);
  });
}

/** Abre o seletor e devolve a pasta escolhida (ou `null` se a pessoa cancelar). */
export async function escolherPastaNoGoogle(d: Dados): Promise<{ id: string; nome: string } | null> {
  await carregarScript();
  const w = window as JanelaGoogle;
  await new Promise<void>((ok) => w.gapi!.load("picker", () => ok()));
  const g = w.google!.picker;
  const vista = new g.DocsView(g.ViewId.FOLDERS);
  vista.setIncludeFolders(true);
  vista.setSelectFolderEnabled(true);
  vista.setMimeTypes("application/vnd.google-apps.folder");
  return new Promise((resolver) => {
    new g.PickerBuilder()
      .addView(vista)
      .setOAuthToken(d.token)
      .setDeveloperKey(d.chave)
      .setAppId(d.projeto)
      .setLocale("pt-BR")
      .setTitle("Escolha a pasta dos documentos")
      .setCallback((r) => {
        if (r.action === g.Action.PICKED && r.docs?.[0]) resolver({ id: r.docs[0].id, nome: r.docs[0].name });
        else if (r.action === g.Action.CANCEL) resolver(null);
      })
      .build()
      .setVisible(true);
  });
}
