import { $, esc } from "../ui.js";
import { AVISOS, dataCurta, definirMeuNome, est, hojeISO, m2Executado, meuNome, nf, ni, percentual, temArea } from "./modelo.js";
import { gravarApontamento, gravarPlano, lerHistorico } from "./nuvem.js";

/* ------------------------------------------------------------
   FICHA — o que o apontador vê ao tocar numa parede

   Em cima o que o projeto promete (área, blocos, avisos); no
   meio o apontamento; embaixo o planejamento e o histórico.
   No celular entra como folha deslizante, arrastável para baixo.
   ------------------------------------------------------------ */

let repintar = function(){};
export function definirRepintar(fn){ repintar = fn || function(){}; }

let historico = [];

export async function abrirFicha(id){
  const w = est.porId[id];
  if(!w) return;
  est.aberta = id;
  historico = [];
  montar(w, est.conectado);
  mostrar();
  if(est.conectado){
    try{
      historico = await lerHistorico(w.pav, w.codigo);
      if(est.aberta === id) montar(w, false);
    }catch(e){ /* a ficha funciona sem o histórico */ }
  }
}

export function fecharFicha(){
  est.aberta = null;
  const f = $("#alvFicha"), c = $("#alvCortina");
  if(f) f.classList.remove("ver");
  if(c) c.classList.remove("ver");
  setTimeout(function(){ if(!est.aberta && f) f.hidden = true; }, 240);
}

function mostrar(){
  const f = $("#alvFicha"), c = $("#alvCortina");
  f.hidden = false;
  c.classList.add("ver");
  requestAnimationFrame(function(){ f.classList.add("ver"); });
  f.scrollTop = 0;
}

/* quantas espessuras diferentes há na parede: se houver mais de
   uma, a espessura "predominante" engana e não serve */
function espessurasDistintas(w){
  if(!w.sku) return 0;
  const vistos = {};
  for(const k in w.sku){
    const m = /-(\d+)X19X/.exec(est.skus[k] || "");
    if(m) vistos[m[1]] = true;
  }
  return Object.keys(vistos).length;
}

function montar(w, carregando){
  const pl = est.plano[w.id] || {};
  const p = percentual(w);
  const pav = est.pavPorCodigo[w.pav];
  const somenteLeitura = !est.podeGravar;
  const skus = w.sku ? Object.keys(w.sku).map(Number).sort(function(a,b){ return a-b; }) : [];
  const responsaveis = [];
  for(const k in est.plano){
    const r = est.plano[k] && est.plano[k].responsavel;
    if(r && responsaveis.indexOf(r) === -1) responsaveis.push(r);
  }
  responsaveis.sort();

  $("#alvFicha").innerHTML =
  '<div class="alv-ficha__cab alv-ficha__pad" id="alvFichaCab">' +
    '<div class="alv-ficha__puxador" aria-hidden="true"></div>' +
    '<div style="display:flex;align-items:flex-start;gap:10px">' +
      '<div style="flex:1 1 auto;min-width:0">' +
        '<h2>' + esc(w.pav + " · " + w.codigo) + "</h2>" +
        '<div class="alv-ficha__sub">' + (w.tipo === "s" ? "Shaft" : "Parede") + " · " + esc(pav.n) +
          (w.prancha ? " · " + esc(w.prancha) : " · sem elevação publicada") + "</div>" +
      "</div>" +
      '<button type="button" class="alv-ficha__x" id="alvFechar" aria-label="Fechar">×</button>' +
    "</div>" +
  "</div>" +

  '<div class="alv-bloco-sec alv-ficha__pad"><h4>Previsto em projeto</h4>' +
    '<div class="alv-fatos">' +
      fato("Área líquida", temArea(w) ? nf(w.area) + " m²" : "—") +
      fato("Blocos", w.blocos === null ? "—" : ni(w.blocos)) +
      fato("Espessura", w.espessura === null ? "—" : w.espessura + " cm") +
      fato("Apontado", temArea(w) ? nf(m2Executado(w)) + " m²" : p + "%") +
    "</div>" +
    [].concat(w.avisos.split("")).map(function(f){
      return AVISOS[f] ? '<div class="alv-alerta"><i>' + AVISOS[f][1] + "</i><span>" + esc(AVISOS[f][0]) + "</span></div>" : "";
    }).join("") +
    (espessurasDistintas(w) > 1
      ? '<div class="alv-alerta"><i>i</i><span>Parede mista: tem bloco de mais de uma espessura. ' +
        'A espessura acima é a predominante — para pedir material, use a lista abaixo.</span></div>' : "") +
    (skus.length
      ? '<details style="margin-top:9px"><summary style="font-size:12.5px;color:var(--tinta-2);cursor:pointer;padding:6px 0">Material da parede</summary>' +
        '<div class="alv-tabela-rolante" style="margin-top:7px"><table class="alv-tabela"><tbody>' +
        skus.map(function(i){
          return "<tr><td>" + esc(est.skus[i]) + "</td><td>" + ni(w.sku[i]) + " un</td></tr>";
        }).join("") + "</tbody></table></div></details>" : "") +
  "</div>" +

  (somenteLeitura
    ? '<div class="alv-bloco-sec alv-ficha__pad"><div class="alv-msg">' +
        "Sem permissão para gravar nesta obra. Fale com o Roberto para liberar seu usuário no Supabase." +
      "</div></div>"
    : blocoApontamento(w, p) + blocoPlanejamento(w, pl, responsaveis)) +

  '<div class="alv-bloco-sec alv-ficha__pad"><h4>Histórico</h4>' +
    (!est.conectado ? '<div class="alv-msg">Entre na obra para ver os lançamentos desta parede.</div>'
     : carregando ? '<div class="alv-msg">Carregando lançamentos…</div>'
     : historico.length
       ? '<div class="alv-hist">' + historico.map(function(l){
           return '<div class="alv-hist__l"><span class="alv-hist__d">' + dataCurta(l.data) + "</span>" +
             '<span class="alv-hist__p">' + Math.round(Number(l.percentual)) + "%</span>" +
             '<span class="alv-hist__q">' + esc(l.equipe || "sem equipe") +
             (l.area_m2 !== null && l.area_m2 !== undefined && Number(l.area_m2) > 0 ? " · " + nf(l.area_m2) + " m²" : "") +
             (l.autor ? " · " + esc(l.autor) : "") + "</span></div>";
         }).join("") + "</div>"
       : '<div class="alv-msg">Nenhum lançamento nesta parede ainda.</div>') +
  "</div>";

  ligarArrasteParaFechar();
}

function fato(rotulo, valor){
  return '<div class="alv-fato"><div class="alv-fato__r">' + esc(rotulo) + '</div>' +
         '<div class="alv-fato__v">' + esc(valor) + "</div></div>";
}

function blocoApontamento(w, p){
  const sugestoes = est.equipeSugerida.map(function(x){ return '<option value="' + esc(x) + '"></option>'; }).join("");
  const ultima = historico.length ? (historico[0].equipe || "") : "";
  return '<div class="alv-bloco-sec alv-ficha__pad"><h4>Apontar execução</h4>' +
    (temArea(w)
      ? '<div class="alv-pcts">' + [0,25,50,75,100].map(function(v){
            return '<button type="button" data-pct="' + v + '" aria-pressed="' + (p === v) + '">' + v + "%</button>";
          }).join("") + "</div>" +
        '<input type="range" class="alv-faixa" id="alvPct" min="0" max="100" step="1" value="' + p + '" aria-label="Percentual executado">' +
        '<div class="alv-grade" style="margin-top:4px">' +
          campo("% executado", '<input id="alvPctN" type="number" inputmode="numeric" min="0" max="100" step="1" value="' + p + '">') +
          campo("m² executados", '<input id="alvM2" type="number" inputmode="decimal" min="0" max="' + w.area + '" step="0.01" value="' + m2Executado(w).toFixed(2) + '">') +
        "</div>"
      : '<div class="alv-pcts dupla">' + [0,100].map(function(v){
            return '<button type="button" data-pct="' + v + '" aria-pressed="' + (p === v) + '">' + (v ? "Concluída" : "Não iniciada") + "</button>";
          }).join("") + "</div>" +
        '<input type="hidden" id="alvPct" value="' + p + '">' +
        '<div class="alv-msg">' + (w.area === 0
          ? "A tabela de projeto não traz bloco de vedação nesta peça: não há m² para medir."
          : "Pavimento sem elevação publicada: sem quantitativo, só dá para marcar concluída ou não.") + "</div>") +
    '<div class="alv-grade" style="margin-top:10px">' +
      campo("Quem executou", '<input id="alvEquipe" list="alvEquipes" value="' + esc(ultima) + '" placeholder="equipe ou empreiteiro">') +
      campo("Data", '<input id="alvData" type="date" value="' + hojeISO() + '" max="' + hojeISO() + '">') +
    "</div>" +
    '<datalist id="alvEquipes">' + sugestoes + "</datalist>" +
    '<button type="button" class="alv-salvar" id="alvRegistrar">Registrar apontamento</button>' +
    '<div class="alv-msg" id="alvMsg"></div>' +
  "</div>";
}

function blocoPlanejamento(w, pl, responsaveis){
  return '<div class="alv-bloco-sec alv-ficha__pad"><h4>Planejamento</h4>' +
    '<div class="alv-grade">' +
      '<label class="alv-campo largo"><span>Responsável</span>' +
        '<input id="alvResp" list="alvResps" value="' + esc(pl.responsavel || "") + '" placeholder="quem responde pela parede"></label>' +
      campo("Início previsto", '<input id="alvIni" type="date" value="' + esc(pl.inicio || "") + '">') +
      campo("Fim previsto", '<input id="alvFim" type="date" value="' + esc(pl.fim || "") + '">') +
    "</div>" +
    '<datalist id="alvResps">' +
      responsaveis.map(function(x){ return '<option value="' + esc(x) + '"></option>'; }).join("") +
      est.equipeSugerida.map(function(x){ return '<option value="' + esc(x) + '"></option>'; }).join("") +
    "</datalist>" +
    '<button type="button" class="alv-salvar secundario" id="alvSalvarPlano">Salvar planejamento</button>' +
    '<div class="alv-msg" id="alvMsg2"></div>' +
  "</div>";
}

function campo(rotulo, html){
  return '<label class="alv-campo"><span>' + esc(rotulo) + "</span>" + html + "</label>";
}

function diz(sel, texto, erro){
  const el = $(sel);
  if(!el) return;
  el.className = "alv-msg" + (erro ? " erro" : "");
  el.textContent = texto;
}

/* ------------------------------------------------------------
   Gravação
   ------------------------------------------------------------ */

export async function registrarApontamento(botao){
  const w = est.porId[est.aberta];
  if(!w) return;
  const campoPct = $("#alvPct");
  const pct = Math.max(0, Math.min(100, Math.round(Number(campoPct && campoPct.value) || 0)));
  const equipe = (($("#alvEquipe") && $("#alvEquipe").value) || "").trim();
  const data = (($("#alvData") && $("#alvData").value) || hojeISO());
  const area = temArea(w) ? Math.round(w.area * pct) / 100 : null;

  botao.disabled = true;
  diz("#alvMsg", "Gravando…");
  try{
    await gravarApontamento({ pavimento:w.pav, parede:w.codigo, data:data,
                              percentual:pct, area_m2:area, equipe:equipe });
    est.situacao[w.id] = { pavimento:w.pav, parede:w.codigo, data:data,
                           percentual:pct, area_m2:area, equipe:equipe };
    if(equipe && est.equipeSugerida.indexOf(equipe) === -1) est.equipeSugerida.push(equipe);
    historico = await lerHistorico(w.pav, w.codigo).catch(function(){ return historico; });
    repintar();
    montar(w, false);
    diz("#alvMsg", "Registrado: " + pct + "%" + (area !== null ? " · " + nf(area) + " m²" : "") +
                   (equipe ? " · " + equipe : "") + " em " + dataCurta(data) + ".");
  }catch(e){
    diz("#alvMsg", mensagemErro(e), true);
  }finally{
    const b = $("#alvRegistrar");
    if(b) b.disabled = false;
  }
}

export async function salvarPlanejamento(botao){
  const w = est.porId[est.aberta];
  if(!w) return;
  const resp = (($("#alvResp") && $("#alvResp").value) || "").trim();
  const ini  = ($("#alvIni") && $("#alvIni").value) || "";
  const fim  = ($("#alvFim") && $("#alvFim").value) || "";
  if(ini && fim && fim < ini){ diz("#alvMsg2", "O fim previsto está antes do início.", true); return; }

  botao.disabled = true;
  diz("#alvMsg2", "Gravando…");
  try{
    const atual = est.plano[w.id] || {};
    const salvo = await gravarPlano({ id: atual.id, pavimento:w.pav, parede:w.codigo,
                                      responsavel:resp, inicio:ini, fim:fim });
    est.plano[w.id] = { id: salvo.id, responsavel: salvo.responsavel, inicio: salvo.inicio, fim: salvo.fim };
    if(resp && !meuNome()) definirMeuNome(resp);
    repintar();
    diz("#alvMsg2", "Planejamento salvo.");
  }catch(e){
    diz("#alvMsg2", mensagemErro(e), true);
  }finally{
    botao.disabled = false;
  }
}

function mensagemErro(e){
  const t = String((e && (e.message || e.hint || e.details)) || e || "");
  if(/relation .* does not exist|schema cache|alvenaria_/i.test(t))
    return "As tabelas da alvenaria ainda não existem no banco. Rode a migração 004_alvenaria.sql no Supabase.";
  if(/row-level security|permission denied|violates/i.test(t))
    return "Seu usuário não tem permissão para gravar. Fale com o Roberto.";
  if(/Failed to fetch|NetworkError/i.test(t))
    return "Sem conexão. O lançamento não foi gravado — tente de novo quando o sinal voltar.";
  return "Não gravou: " + t;
}

/* ------------------------------------------------------------
   Arrastar a folha para baixo e fechar (gesto de celular)
   ------------------------------------------------------------ */
function ligarArrasteParaFechar(){
  const cab = $("#alvFichaCab"), f = $("#alvFicha");
  if(!cab || !f) return;
  let y0 = null;
  cab.addEventListener("touchstart", function(ev){
    if(f.scrollTop > 0) return;
    y0 = ev.touches[0].clientY;
    f.style.transition = "none";
  }, { passive:true });
  cab.addEventListener("touchmove", function(ev){
    if(y0 === null) return;
    const d = ev.touches[0].clientY - y0;
    if(d > 0) f.style.transform = "translateY(" + d + "px)";
  }, { passive:true });
  cab.addEventListener("touchend", function(ev){
    if(y0 === null) return;
    const d = (ev.changedTouches[0].clientY - y0);
    f.style.transition = "";
    f.style.transform = "";
    y0 = null;
    if(d > 70) fecharFicha();
  });
}
