import { $, esc } from "../ui.js";
import { lerApontamentos } from "./nuvem.js";
import { dataCurta, est, hojeISO, m2Executado, meuNome, nf, ni, percentual, ROTULO, status, temArea, visiveis } from "./modelo.js";

/* ------------------------------------------------------------
   PAINÉIS — indicadores, filtros, prazos, equipes e material
   ------------------------------------------------------------ */

const COR = { ok:"var(--alv-ok)", andamento:"var(--alv-andamento)", atraso:"var(--alv-atraso)",
              zero:"var(--alv-zero)", semquant:"var(--alv-semquant)" };

/* ---------- barra de pavimentos ---------- */
export function desenharPavimentos(){
  $("#alvPavs").innerHTML = est.pavimentos.map(function(p){
    const lista = est.porPavimento[p.c] || [];
    const prev = lista.reduce(function(s,w){ return s + (temArea(w) ? w.area : 0); }, 0);
    const feito = lista.reduce(function(s,w){ return s + m2Executado(w); }, 0);
    const pc = prev > 0 ? Math.round(feito/prev*100) : null;
    return '<button type="button" class="alv-pav" data-pav="' + p.c + '" aria-pressed="' + (p.c === est.pav) + '">' +
      "<b>" + esc(p.n) + "</b><i>" + lista.length + " par · " + (pc === null ? "s/ m²" : pc + "%") + "</i></button>";
  }).join("");
}

/* ---------- indicadores ---------- */
export function desenharIndicadores(){
  const lista = est.porPavimento[est.pav] || [];
  const prev = lista.reduce(function(s,w){ return s + (temArea(w) ? w.area : 0); }, 0);
  const feito = lista.reduce(function(s,w){ return s + m2Executado(w); }, 0);
  const pc = prev > 0 ? feito/prev*100 : 0;
  const prontas = lista.filter(function(w){ return status(w) === "ok"; }).length;
  const atrasadas = lista.filter(function(w){ return status(w) === "atraso"; }).length;
  const semApont = lista.filter(function(w){ return percentual(w) === 0; }).length;
  const semResp = lista.filter(function(w){ const p = est.plano[w.id]; return !p || !p.responsavel; }).length;

  $("#alvIndicadores").innerHTML =
    ind(prev > 0 ? nf(pc,1) + "%" : "—", "Executado", nf(feito) + " de " + nf(prev) + " m²") +
    ind(prontas + " / " + lista.length, "Paredes concluídas", semApont + " sem apontamento") +
    ind(atrasadas, "Fora do prazo", atrasadas ? "ver aba Prazos" : "nenhuma atrasada", atrasadas ? "ind--atrasado" : "") +
    ind(semResp, "Sem responsável", "de " + lista.length + " paredes");
}
function ind(numero, rotulo, detalhe, classe){
  return '<div class="ind ' + (classe || "") + '"><span class="ind__n">' + esc(String(numero)) + "</span>" +
    '<span class="ind__r">' + esc(rotulo) + "</span>" +
    (detalhe ? '<span class="ind__d">' + esc(detalhe) + "</span>" : "") + "</div>";
}

/* ---------- filtros ---------- */
export function desenharFiltros(){
  const lista = est.porPavimento[est.pav] || [];
  const conta = {};
  lista.forEach(function(w){ const s = status(w); conta[s] = (conta[s] || 0) + 1; });
  const comAviso = lista.filter(function(w){ return !!w.avisos; }).length;
  const minhas = lista.filter(function(w){
    const p = est.plano[w.id];
    return !!(p && p.responsavel && meuNome() && p.responsavel.toLowerCase() === meuNome().toLowerCase());
  }).length;

  const defs = [
    ["todas", "Todas", null, lista.length],
    ["zero", "Não iniciadas", "zero", conta.zero || 0],
    ["andamento", "Em execução", "andamento", conta.andamento || 0],
    ["ok", "Concluídas", "ok", conta.ok || 0],
    ["atraso", "Fora do prazo", "atraso", conta.atraso || 0],
    ["semquant", "Sem m²", "semquant", conta.semquant || 0],
    ["avisos", "Com aviso", null, comAviso]
  ];
  if(meuNome()) defs.push(["minhas", "Minhas", null, minhas]);

  $("#alvFiltros").innerHTML = defs.map(function(d){
    const cor = d[2] ? '<i class="alv-cor" style="background:' + COR[d[2]] + '"></i>' : "";
    return '<button type="button" class="chip-filtro" data-filtro="' + d[0] + '" aria-pressed="' + (est.filtro === d[0]) + '">' +
      cor + esc(d[1]) + ' <span class="chip-filtro__n">' + d[3] + "</span></button>";
  }).join("");
}

/* ---------- prazos ---------- */
export function desenharPrazos(){
  const hoje = hojeISO();
  const d7 = new Date(); d7.setDate(d7.getDate() + 7);
  const limite = d7.getFullYear() + "-" + String(d7.getMonth()+1).padStart(2,"0") + "-" + String(d7.getDate()).padStart(2,"0");

  const comPlano = est.paredes.filter(function(w){
    const p = est.plano[w.id];
    return p && (p.fim || p.inicio || p.responsavel);
  });
  const atrasadas = [], semana = [], programadas = [], semPrazo = [], concluidas = [];
  comPlano.forEach(function(w){
    const p = est.plano[w.id];
    if(percentual(w) >= 100){ concluidas.push(w); return; }
    if(!p.fim){ semPrazo.push(w); return; }
    if(p.fim < hoje) atrasadas.push(w);
    else if(p.fim <= limite) semana.push(w);
    else programadas.push(w);
  });

  function ordenar(arr){
    return arr.sort(function(a,b){
      const fa = (est.plano[a.id].fim || "9999") + a.id;
      const fb = (est.plano[b.id].fim || "9999") + b.id;
      return fa.localeCompare(fb);
    });
  }
  function linha(w){
    const p = est.plano[w.id], s = status(w);
    return '<div class="alv-linha">' +
      '<span class="alv-linha__cod">' + esc(w.codigo) + "</span>" +
      '<span class="alv-linha__pav">' + esc(est.pavPorCodigo[w.pav].n) + "</span>" +
      '<span class="alv-linha__meio">' + esc(p.responsavel || "sem responsável") +
        (p.inicio ? " · início " + dataCurta(p.inicio) : "") + "</span>" +
      '<span class="alv-linha__fim">' + (p.fim ? dataCurta(p.fim) : "—") + "</span>" +
      '<span class="alv-selo ' + s + '">' + percentual(w) + "%</span>" +
      '<button type="button" class="btn btn--p" data-peca="' + w.id + '">abrir</button>' +
    "</div>";
  }
  function grupo(titulo, arr){
    if(!arr.length) return "";
    return '<h2 class="alv-titulo">' + titulo + ' <span style="color:var(--tinta-3)">' + arr.length + "</span></h2>" +
      '<div class="alv-linhas">' + ordenar(arr).map(linha).join("") + "</div>";
  }

  const html = grupo("Fora do prazo", atrasadas) + grupo("Vencem em 7 dias", semana) +
               grupo("Programadas", programadas) + grupo("Sem prazo definido", semPrazo) +
               grupo("Concluídas", concluidas);
  $("#alvPrazos").innerHTML = html ||
    '<div class="vazio">Nenhuma parede tem responsável ou prazo lançado ainda. ' +
    'Abra uma parede no Mapa e preencha o planejamento.</div>';
}

/* ---------- equipes ---------- */
export async function desenharEquipes(){
  const alvo = $("#alvEquipesTela");
  alvo.innerHTML = '<div class="alv-msg">Carregando lançamentos…</div>';
  let aps = [];
  try{ aps = await lerApontamentos(); }
  catch(e){
    alvo.innerHTML = '<div class="vazio">Não foi possível ler os lançamentos. ' +
      'Se a migração 004 ainda não foi rodada, esta aba fica vazia.</div>';
    return;
  }

  const porEquipe = {};
  aps.forEach(function(a){
    const k = (a.equipe || "").trim();
    if(!k) return;
    const g = porEquipe[k] || (porEquipe[k] = { m2:0, dias:{}, pecas:{} });
    if(a.area_m2 !== null && a.area_m2 !== undefined) g.m2 += Number(a.area_m2);
    if(a.data) g.dias[a.data] = true;
    g.pecas[a.pavimento + "__" + a.parede] = true;
  });

  const porResp = {};
  est.paredes.forEach(function(w){
    const p = est.plano[w.id];
    if(!p || !p.responsavel) return;
    const k = p.responsavel.trim();
    const r = porResp[k] || (porResp[k] = { n:0, m2:0, prev:0, atraso:0, ok:0 });
    r.n++; r.m2 += m2Executado(w); r.prev += temArea(w) ? w.area : 0;
    const s = status(w);
    if(s === "atraso") r.atraso++;
    if(s === "ok") r.ok++;
  });

  const equipes = Object.keys(porEquipe).sort(function(a,b){ return porEquipe[b].m2 - porEquipe[a].m2; });
  const resps = Object.keys(porResp).sort(function(a,b){ return porResp[b].n - porResp[a].n; });

  let html = '<h2 class="alv-titulo">Produção por equipe</h2>';
  html += equipes.length
    ? '<div class="alv-linhas">' + equipes.map(function(k){
        const g = porEquipe[k], dias = Object.keys(g.dias).length;
        return '<div class="alv-linha">' +
          '<span class="alv-linha__meio" style="color:var(--tinta);font-weight:600">' + esc(k) + "</span>" +
          '<span class="alv-linha__fim">' + nf(g.m2) + " m²</span>" +
          '<span class="alv-linha__fim" style="width:92px">' + (dias ? nf(g.m2/dias,1) + " m²/dia" : "—") + "</span>" +
          '<span class="alv-linha__fim" style="width:66px;color:var(--tinta-3)">' + Object.keys(g.pecas).length + " par</span>" +
        "</div>";
      }).join("") + "</div>" +
      '<div class="alv-msg">m²/dia = m² lançados ÷ dias distintos com lançamento. ' +
      'Serve como RUP aproximada, não como medição de folha.</div>'
    : '<div class="vazio">Nenhum lançamento com equipe ainda.</div>';

  html += '<h2 class="alv-titulo">Carteira por responsável</h2>';
  html += resps.length
    ? '<div class="alv-linhas">' + resps.map(function(k){
        const r = porResp[k];
        return '<div class="alv-linha">' +
          '<span class="alv-linha__meio" style="color:var(--tinta);font-weight:600">' + esc(k) + "</span>" +
          '<span class="alv-linha__fim" style="width:72px">' + r.n + " par</span>" +
          '<span class="alv-linha__fim" style="width:100px">' + nf(r.m2,0) + "/" + nf(r.prev,0) + " m²</span>" +
          (r.atraso ? '<span class="alv-selo atraso">' + r.atraso + " atras.</span>"
                    : '<span class="alv-selo ok">' + r.ok + " ok</span>") +
        "</div>";
      }).join("") + "</div>"
    : '<div class="vazio">Nenhuma parede atribuída ainda.</div>';

  alvo.innerHTML = html;
}

/* ---------- material ---------- */
export function desenharMaterial(){
  const lista = (est.porPavimento[est.pav] || []).filter(function(w){ return w.sku; });
  const alvo = $("#alvMaterial");
  if(!lista.length){
    alvo.innerHTML = '<div class="vazio">Este pavimento não tem quantitativo publicado: ' +
      'sem elevação no ConstruCode, não há tabela de material.</div>';
    return;
  }
  const previsto = {}, assentado = {};
  lista.forEach(function(w){
    const f = percentual(w)/100;
    for(const k in w.sku){
      previsto[k] = (previsto[k] || 0) + w.sku[k];
      assentado[k] = (assentado[k] || 0) + w.sku[k]*f;
    }
  });
  const ordem = Object.keys(previsto).map(Number).sort(function(a,b){ return a-b; });
  const ehBloco = function(i){ return String(est.skus[i]).indexOf("TELA") !== 0; };
  const soma = function(arr, obj){ return arr.reduce(function(s,i){ return s + (obj[i] || 0); }, 0); };
  const blocos = ordem.filter(ehBloco), telas = ordem.filter(function(i){ return !ehBloco(i); });

  alvo.innerHTML =
    '<h2 class="alv-titulo">Material · ' + esc(est.pavPorCodigo[est.pav].n) + "</h2>" +
    '<div class="alv-tabela-rolante"><table class="alv-tabela">' +
      "<thead><tr><th>SKU</th><th>Previsto (un)</th><th>Estimado assentado</th><th>Saldo</th></tr></thead><tbody>" +
      ordem.map(function(i){
        const p = previsto[i], a = Math.round(assentado[i]);
        return "<tr><td>" + esc(est.skus[i]) + "</td><td>" + ni(p) + "</td><td>" + ni(a) + "</td><td>" + ni(p-a) + "</td></tr>";
      }).join("") +
      "</tbody><tfoot>" +
      linhaTotal("Blocos", soma(blocos, previsto), Math.round(soma(blocos, assentado))) +
      linhaTotal("Telas", soma(telas, previsto), Math.round(soma(telas, assentado))) +
      "</tfoot></table></div>" +
    '<div class="alv-msg">O assentado é estimado: quantidade de projeto × % apontado da parede. ' +
      "Nenhuma contagem de bloco é feita no apontamento. XVAR é bloco cortado, sem dimensão em projeto. " +
      "O bloco calha (CER-CAL) entra como alvenaria; isole-o para separar verga.</div>";
}
function linhaTotal(rotulo, previsto, assentado){
  return "<tr><td>" + rotulo + "</td><td>" + ni(previsto) + "</td><td>" + ni(assentado) +
         "</td><td>" + ni(previsto - assentado) + "</td></tr>";
}
