import { listaAcompanhamento, pintarDetalhe, pintarListaServicos } from "./acompanhamento.js";
import { estado } from "./estado.js";
import { pintarIndicadores, pintarPainel } from "./painel.js";
import { pintarPlanejamento } from "./planejamento.js";
import { $ } from "./ui.js";

/* ------------------------------------------------------------
   RENDER GERAL E ABAS
   ------------------------------------------------------------ */
export function pintarTudo(){
  pintarIndicadores();
  if(estado.abaAtiva === "painel") pintarPainel();
  else if(estado.abaAtiva === "planejamento") pintarPlanejamento();
  else { pintarListaServicos(); pintarDetalhe(); }
}

export function trocarAba(nome){
  estado.abaAtiva = nome;
  $("#tabPainel").setAttribute("aria-selected", String(nome === "painel"));
  $("#tabAcomp").setAttribute("aria-selected", String(nome === "acompanhamento"));
  $("#tabPlano").setAttribute("aria-selected", String(nome === "planejamento"));
  $("#painel").classList.toggle("oculto", nome !== "painel");
  $("#acompanhamento").classList.toggle("oculto", nome !== "acompanhamento");
  $("#planejamento").classList.toggle("oculto", nome !== "planejamento");
  if(nome === "acompanhamento" && !estado.selecionado){
    const l = listaAcompanhamento();
    if(l.length) estado.selecionado = l[0].id;
  }
  pintarTudo();
}
