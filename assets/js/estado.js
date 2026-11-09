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
  locErro: "",

  /* efetivo e programação semanal (migração 003) */
  colaboradores: [],        // linhas da tabela colaboradores (ativos e inativos, sem excluídos)
  programacao: [],          // linhas da tabela programacao da semana carregada
  progAtivo: false,         // false enquanto a migração 003 não rodar
  progErro: "",
  jornadaSemana: null,      // horas por dia da semana [dom..sáb] (config "jornada_semana"); null = padrão 9 h seg–qui, 8 h sex
  semanaInicio: ""          // segunda-feira da semana mostrada na aba Semana
};
