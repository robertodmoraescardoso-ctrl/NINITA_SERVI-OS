import { fmtLongo, hojeISO, somarDiasUteis } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { servicosFiltrados } from "./filtros.js";
import { textoOnde } from "./inferencia.js";
import { pintarTudo } from "./navegacao.js";
import { tarefasPlanejadas } from "./planejamento.js";
import { STATUS } from "./servicos.js";
import { salvar } from "./supabase.js";
import { $, $$, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   EDIÇÃO EM LOTE
   Parte da lista que está filtrada na tela (painel ou planejamento).
   Muda responsável, status ou adia/antecipa as datas previstas em
   dias úteis. Campo em branco = não altera.
   ------------------------------------------------------------ */
let alvo = [];

export function abrirEdicaoLote(origem){
  alvo = origem === "planejamento" ? tarefasPlanejadas() : servicosFiltrados();
  if(!alvo.length){ aviso("Nenhum serviço na lista filtrada."); return; }
  const responsaveis = Array.from(new Set(estado.servicos.map(function(s){ return s.responsavel; }).filter(Boolean))).sort();

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Editar em lote">' +
      '<div class="modal__cab"><h2>Editar em lote</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo" id="edCorpo">' +
        '<p class="dica" style="margin-top:0">Serviços da lista filtrada na tela. Desmarque os que não devem mudar. Campo em branco não altera nada.</p>' +
        '<div class="form-grade">' +
          '<div class="campo"><label for="edResp">Novo responsável</label><input type="text" id="edResp" list="edResps" placeholder="manter">' +
            '<datalist id="edResps">' + responsaveis.map(function(r){ return '<option value="' + esc(r) + '">'; }).join("") + '</datalist></div>' +
          '<div class="campo"><label for="edStatus">Novo status</label><select id="edStatus"><option value="">manter</option>' +
            Object.keys(STATUS).map(function(k){ return '<option value="' + k + '">' + STATUS[k].rot + '</option>'; }).join("") + '</select></div>' +
          '<div class="campo"><label for="edDias">Adiar datas em (dias úteis)</label><input type="number" id="edDias" step="1" placeholder="ex.: 3 ou -2">' +
            '<span class="dica">Planejado: mexe no início e no término. Em andamento ou paralisado: só no término previsto. Concluído: não mexe.</span></div>' +
        '</div>' +
        '<p><button class="btn btn--p" data-ed="todos">Marcar todos</button> <button class="btn btn--p" data-ed="nenhum">Desmarcar todos</button></p>' +
        '<div class="painel-tabela"><table class="tabela"><thead><tr><th></th><th>Serviço</th><th>Local</th><th>Status</th><th>Responsável</th><th>Início</th><th>Término</th></tr></thead><tbody id="edLinhas"></tbody></table></div>' +
      '</div>' +
      '<div class="modal__pe"><button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn--marca" id="btnAplicarLote">Aplicar</button></div>' +
    '</div>' +
  '</div>';

  $("#edLinhas").innerHTML = alvo.map(function(s){
    return '<tr data-ed-linha="' + s.id + '">' +
      '<td><input type="checkbox" class="ed-marca" value="' + s.id + '" checked aria-label="Incluir ' + esc(s.codigo) + '"></td>' +
      '<td><span class="cod">' + esc(s.codigo) + '</span><div class="tit">' + esc(s.titulo) + '</div></td>' +
      '<td class="sub">' + esc(textoOnde(s) || "—") + '</td>' +
      '<td class="ed-status">' + (STATUS[s.status] || {}).rot + '</td>' +
      '<td class="ed-resp">' + esc(s.responsavel || "—") + '</td>' +
      '<td class="num ed-ini">' + fmtLongo(s.inicio) + '</td>' +
      '<td class="num ed-fim">' + fmtLongo(s.fimPrev) + '</td></tr>';
  }).join("");
  const corpo = $("#edCorpo");
  corpo.addEventListener("input", previa);
  corpo.addEventListener("change", previa);
  previa();
}

/* aplica as mudanças numa cópia do serviço (não grava) */
function mudancas(s){
  const resp = $("#edResp").value.trim();
  const st = $("#edStatus").value;
  const dias = Number($("#edDias").value) || 0;
  const n = JSON.parse(JSON.stringify(s));
  if(resp) n.responsavel = resp;
  if(dias && n.status !== "concluido"){
    if(n.status === "planejado" && n.inicio) n.inicio = somarDiasUteis(n.inicio, dias);
    if(n.fimPrev) n.fimPrev = somarDiasUteis(n.fimPrev, dias);
  }
  if(st && st !== n.status){
    /* mesma regra do status rápido do Acompanhamento */
    if(st === "concluido"){ if(!n.fimReal) n.fimReal = hojeISO(); n.avanco = 100; }
    else if(n.fimReal) n.fimReal = "";
    n.status = st;
  }
  return n;
}

function marcados(){ return $$(".ed-marca").filter(function(c){ return c.checked; }).map(function(c){ return c.value; }); }

function previa(){
  const ids = marcados();
  let mudam = 0;
  alvo.forEach(function(s){
    const tr = document.querySelector('[data-ed-linha="' + s.id + '"]');
    const n = ids.indexOf(s.id) !== -1 ? mudancas(s) : s;
    const dif = function(a, b){ return a !== b; };
    const cel = function(cls, antes, depois){
      tr.querySelector(cls).innerHTML = dif(antes, depois) ? '<s>' + esc(antes) + '</s> <strong>' + esc(depois) + '</strong>' : esc(antes);
    };
    cel(".ed-status", (STATUS[s.status] || {}).rot, (STATUS[n.status] || {}).rot);
    cel(".ed-resp", s.responsavel || "—", n.responsavel || "—");
    cel(".ed-ini", fmtLongo(s.inicio), fmtLongo(n.inicio));
    cel(".ed-fim", fmtLongo(s.fimPrev), fmtLongo(n.fimPrev));
    if(JSON.stringify(n) !== JSON.stringify(s)) mudam++;
  });
  const btn = $("#btnAplicarLote");
  btn.disabled = !mudam;
  btn.textContent = mudam ? "Aplicar em " + mudam + " serviço(s)" : "Aplicar";
}

export function acaoEdicaoLote(acao){
  if(acao === "todos" || acao === "nenhum") $$(".ed-marca").forEach(function(c){ c.checked = acao === "todos"; });
  previa();
}

export async function aplicarEdicaoLote(){
  const ids = marcados();
  const lista = alvo.filter(function(s){ return ids.indexOf(s.id) !== -1; })
    .map(function(s){ return { s:s, n:mudancas(s) }; })
    .filter(function(p){ return JSON.stringify(p.n) !== JSON.stringify(p.s); });
  if(!lista.length) return;
  if(!confirm("Alterar " + lista.length + " serviço(s)?")) return;
  const btn = $("#btnAplicarLote");
  btn.disabled = true;
  let n = 0;
  try{
    for(const p of lista){
      btn.textContent = "Gravando " + (n + 1) + " de " + lista.length + "...";
      await salvar("servicos", p.n);
      Object.assign(p.s, p.n);       /* só muda na tela depois de gravar */
      n++;
    }
  } catch(e){
    console.error(e);
    pintarTudo();
    aviso("Parou no " + (n + 1) + "º: " + explicarErro(e) + " Os " + n + " anteriores foram alterados.", "erro");
    btn.disabled = false; btn.textContent = "Tentar de novo";
    return;
  }
  fecharModal();
  pintarTudo();
  aviso(n + " serviço(s) alterado(s)");
}
