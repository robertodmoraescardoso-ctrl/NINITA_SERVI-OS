/* ------------------------------------------------------------
   ESTADO
   ------------------------------------------------------------ */
export const estado = {
  servicos: [],
  urls: new Map(),          // idFoto -> objectURL
  abaAtiva: "painel",
  visao: "quadro",
  selecionado: null,
  /* status "aberto" = tudo que não está concluído (padrão do painel);
     local = id de frente/pavimento, "__sem" (sem localização) ou "" (todos) */
  filtros: { busca:"", status:"aberto", resp:"", titulo:"", local:"", ordem:"inicio", lista:"abertos" },
  nomeObra: "",

  /* localização (Fase 2) */
  localizacoes: [],         // linhas da tabela localizacoes (só ativas)
  ligacoes: new Map(),      // servicoId -> Set(localizacaoId)
  locAtivo: false,          // false enquanto a migração 002 não rodar
  locErro: ""
};
