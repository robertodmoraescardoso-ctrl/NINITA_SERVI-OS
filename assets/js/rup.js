import { diasUteis, hojeISO, somarDiasUteis } from "./datas.js";
import { estado } from "./estado.js";
import { quantExecutada, quantPrevista } from "./servicos.js";

/* ============================================================
   PRODUTIVIDADE — RUP (Razão Unitária de Produção)
   Metodologia do prof. Ubiraci Espinelli Lemes de Souza (Poli-USP):

     RUP = Hh / QS      homens-hora gastos por unidade de serviço
                        (ex.: 0,45 Hh/m²). QUANTO MENOR, MELHOR.

     Hh do dia          = pessoas no serviço x jornada daquele dia (h)
     QS do dia          = quantidade executada lançada no apontamento

     RUP diária         = Hh do dia / QS do dia
     RUP cumulativa     = soma dos Hh / soma das QS, do início até a data
     RUP potencial      = mediana das RUPs diárias que ficaram iguais ou
                          abaixo da RUP cumulativa — o desempenho bom e
                          repetível da equipe ("produtividade máxima
                          alcançável"), usado nas projeções
     Perda              = RUP cumulativa - RUP potencial: o quanto as
                          anormalidades (falta de material, retrabalho,
                          chuva, frente não liberada) estão custando

   RUP global = oficiais + ajudantes. RUP oficial = só os oficiais
   (calculada quando os colaboradores do apontamento estão no
   cadastro de efetivo). Categoria "indireto" (encarregado, mestre)
   não entra no cálculo.
   ============================================================ */

/* Jornada por dia da semana, em horas: [dom, seg, ter, qua, qui, sex, sáb].
   Padrão da obra: 9 h de segunda a quinta, 8 h na sexta. Sábado e
   domingo só contam se houver apontamento (hora extra). Configurável
   na tela Efetivo (config "jornada_semana"). */
export const JORNADA_PADRAO = [0, 9, 9, 9, 9, 8, 8];

export function jornadaSemana(){
  const j = estado.jornadaSemana;
  return Array.isArray(j) && j.length === 7 ? j : JORNADA_PADRAO;
}

/* horas de uma pessoa naquela data */
export function jornadaDoDia(iso){
  const p = String(iso || "").split("-");
  const dia = p.length === 3 ? new Date(+p[0], +p[1] - 1, +p[2]).getDay() : 1;
  const h = Number(jornadaSemana()[dia]);
  return h > 0 ? h : Number(jornadaSemana()[5]) || 8;   /* domingo sem jornada: usa a de sexta */
}

/* "9 h seg–qui, 8 h sex" — para os textos de ajuda */
export function textoJornada(){
  const j = jornadaSemana();
  const n = function(v){ return String(v).replace(".", ","); };
  return (j[1] === j[2] && j[2] === j[3] && j[3] === j[4])
    ? n(j[1]) + " h seg–qui, " + n(j[5]) + " h sex"
    : ["seg","ter","qua","qui","sex"].map(function(d, i){ return n(j[i+1]) + " h " + d; }).join(", ");
}

/* mínimo de dias medidos para a RUP potencial ter sentido */
export const DIAS_MINIMOS_POTENCIAL = 3;

function chave(nome){ return String(nome || "").trim().toLowerCase(); }

export function categoriaDe(nome){
  const c = (estado.colaboradores || []).find(function(x){ return chave(x.nome) === chave(nome); });
  return c ? c.categoria : null;
}

/* pessoas que contam no Hh de um apontamento */
export function pessoasDoApontamento(a){
  const nomes = (a.colaboradores || []).filter(function(n){ return categoriaDe(n) !== "indireto"; });
  const efetivo = Number(a.efetivo) || 0;
  const total = efetivo > 0 ? efetivo : nomes.length;
  /* oficiais: só quando todos os nomes são conhecidos e batem com o efetivo */
  const conhecidos = nomes.every(function(n){ return categoriaDe(n); });
  const oficiais = nomes.length && conhecidos && (!efetivo || efetivo === nomes.length)
    ? nomes.filter(function(n){ return categoriaDe(n) === "oficial"; }).length
    : null;
  return { total:total, oficiais:oficiais };
}

/* RUP por dia do serviço: apontamentos do mesmo dia são somados */
export function diasRUP(s){
  const porDia = new Map();
  (s.apontamentos || []).forEach(function(a){
    const qs = Number(a.quantidade) || 0;
    const p = pessoasDoApontamento(a);
    if(!a.data || qs <= 0 || p.total <= 0) return;
    if(!porDia.has(a.data)) porDia.set(a.data, { data:a.data, qs:0, pessoas:0, hh:0, hhOf:0, oficialOk:true });
    const d = porDia.get(a.data);
    d.qs += qs;
    d.pessoas += p.total;
    d.hh += p.total * jornadaDoDia(a.data);
    if(p.oficiais === null) d.oficialOk = false; else d.hhOf += p.oficiais * jornadaDoDia(a.data);
  });
  return Array.from(porDia.values())
    .sort(function(a,b){ return a.data.localeCompare(b.data); })
    .map(function(d){
      d.rupd = d.hh / d.qs;
      d.rupOf = d.oficialOk && d.hhOf ? d.hhOf / d.qs : null;
      return d;
    });
}

export function rupCumulativa(dias){
  const hh = dias.reduce(function(n,d){ return n + d.hh; }, 0);
  const qs = dias.reduce(function(n,d){ return n + d.qs; }, 0);
  return qs > 0 ? hh / qs : null;
}

function mediana(v){
  if(!v.length) return null;
  const o = v.slice().sort(function(a,b){ return a - b; });
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m-1] + o[m]) / 2;
}

/* null enquanto houver menos de DIAS_MINIMOS_POTENCIAL dias medidos */
export function rupPotencial(dias){
  if(dias.length < DIAS_MINIMOS_POTENCIAL) return null;
  const cum = rupCumulativa(dias);
  return mediana(dias.filter(function(d){ return d.rupd <= cum; }).map(function(d){ return d.rupd; }));
}

/* Compara o dia i com o dia medido anterior do mesmo serviço.
   Variação abaixo de 3% conta como "igual" (ruído de medição). */
export function comparar(dias, i){
  if(i <= 0 || !dias[i] || !dias[i-1]) return null;
  const var_ = (dias[i].rupd - dias[i-1].rupd) / dias[i-1].rupd;
  return {
    anterior: dias[i-1],
    variacao: var_,
    situacao: Math.abs(var_) < 0.03 ? "igual" : (var_ < 0 ? "melhor" : "pior")
  };
}

/* equipe para projetar: média de pessoas dos últimos 3 dias medidos */
export function equipeAtual(dias){
  const ult = dias.slice(-3);
  if(!ult.length) return 0;
  return ult.reduce(function(n,d){ return n + d.pessoas; }, 0) / ult.length;
}

/* Projeção do término: a partir do próximo dia útil, soma dia a dia
   os Hh disponíveis (equipe x jornada daquele dia: 9 h seg–qui, 8 h
   sex) até cobrir os Hh necessários = saldo x RUP. */
function projetarCom(saldo, rup, equipe, s){
  if(!rup || !equipe || saldo <= 0) return null;
  const necessario = saldo * rup;
  let dia = somarDiasUteis(hojeISO(), 1);   /* próximo dia útil depois de hoje */
  let acumulado = 0, dias = 0, fim = dia;
  while(acumulado < necessario && dias < 1000){
    acumulado += equipe * jornadaDoDia(dia);
    dias++; fim = dia;
    dia = somarDiasUteis(dia, 1);
  }
  const hhMedio = equipe * mediaDiasUteis();
  let folga = null;
  if(s.fimPrev){
    /* positivo = termina depois do previsto (atraso), negativo = antes */
    folga = fim > s.fimPrev ? diasUteis(s.fimPrev, fim) - 1 : -(diasUteis(fim, s.fimPrev) - 1);
  }
  return { dias:dias, fim:fim, folga:folga, producaoDia: hhMedio / rup };
}

/* jornada média de segunda a sexta (para a produção diária média) */
function mediaDiasUteis(){
  const j = jornadaSemana();
  return (Number(j[1]) + Number(j[2]) + Number(j[3]) + Number(j[4]) + Number(j[5])) / 5;
}

export function analise(s){
  const dias = diasRUP(s);
  const cum = rupCumulativa(dias);
  const pot = rupPotencial(dias);
  const saldo = Math.max(0, quantPrevista(s) - quantExecutada(s));
  const equipe = equipeAtual(dias);
  return {
    dias: dias,
    cumulativa: cum,
    potencial: pot,
    perda: cum !== null && pot !== null ? cum - pot : null,
    saldo: saldo,
    equipe: equipe,
    projAtual: projetarCom(saldo, cum, equipe, s),
    projPotencial: projetarCom(saldo, pot, equipe, s)
  };
}

/* meta sugerida para n pessoas num dia: QS = n x jornada do dia / RUP
   potencial (sem potencial ainda, usa a cumulativa). Na sexta, com 8 h,
   a meta sai menor que de segunda a quinta, com 9 h. */
export function metaSugerida(s, nPessoas, data){
  const a = analise(s);
  const rup = a.potencial || a.cumulativa;
  if(!rup || !nPessoas) return null;
  return nPessoas * jornadaDoDia(data || hojeISO()) / rup;
}

/* "0,45 Hh/m²" */
export function fmtRUP(v, unidade){
  if(v === null || v === undefined || !isFinite(v)) return "—";
  return v.toLocaleString("pt-BR", { minimumFractionDigits:2, maximumFractionDigits:2 }) + " Hh/" + (unidade || "un");
}
