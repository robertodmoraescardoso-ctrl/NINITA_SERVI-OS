/* ------------------------------------------------------------
   ESTADO
   ------------------------------------------------------------ */
export const estado = {
  servicos: [],
  urls: new Map(),          // idFoto -> objectURL
  abaAtiva: "painel",
  visao: "quadro",
  selecionado: null,
  filtros: { busca:"", status:"", resp:"", titulo:"", ordem:"inicio", lista:"abertos" },
  nomeObra: ""
};
