import { listaAcompanhamento, pintarDetalhe, pintarListaServicos } from "./acompanhamento.js";
import { estado } from "./estado.js";
import { pintarIndicadores, pintarPainel } from "./painel.js";
import { pintarPlanejamento } from "./planejamento.js";
import { contaSemana, pintarSemana } from "./semana.js";
import { $ } from "./ui.js";

/* ------------------------------------------------------------
   RENDER GERAL E ABAS
   ------------------------------------------------------------ */
const ABAS = [
  { nome:"painel",         aba:"#tabPainel", tela:"#painel" },
  { nome:"acompanhamento", aba:"#tabAcomp",  tela:"#acompanhamento" },
  { nome:"semana",         aba:"#tabSemana", tela:"#semana" },
  { nome:"planejamento",   aba:"#tabPlano",  tela:"#planejamento" }
];

export function pintarTudo(){
  pintarIndicadores();
  const c = $("#contaSemana"); if(c) c.textContent = contaSemana();
  if(estado.abaAtiva === "painel") pintarPainel();
  else if(estado.abaAtiva === "planejamento") pintarPlanejamento();
  else if(estado.abaAtiva === "semana") pintarSemana();
  else { pintarListaServicos(); pintarDetalhe(); }
}

export function trocarAba(nome){
  estado.abaAtiva = nome;
  ABAS.forEach(function(a){
    const aba = $(a.aba), tela = $(a.tela);
    if(aba) aba.setAttribute("aria-selected", String(nome === a.nome));
    if(tela) tela.classList.toggle("oculto", nome !== a.nome);
  });
  if(nome === "acompanhamento" && !estado.selecionado){
    const l = listaAcompanhamento();
    if(l.length) estado.selecionado = l[0].id;
  }
  pintarTudo();
}
