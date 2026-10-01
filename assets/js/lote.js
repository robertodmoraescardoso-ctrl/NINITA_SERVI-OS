import { diasUteis, fmtLongo, proximoDiaUtil, somarDiasUteis, terminoPorDiasUteis } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { definirLigacoes, filhos, frentes, local, textoDeIds } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { idsSelecionados, montarSeletor } from "./seletorLocal.js";
import { novoServico, proximosCodigos, UNIDADES } from "./servicos.js";
import { salvar } from "./supabase.js";
import { $, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   CADASTRO EM LOTE
   O mesmo serviço replicado para vários locais (um serviço por
   pavimento/teto marcado), com as datas deslocadas em dias úteis.
   Ex.: Alvenaria, 1º ao 8º pavimento, 5 dias úteis cada, um
   pavimento começando 5 dias úteis depois do anterior.
   ------------------------------------------------------------ */

/* posição de um local na árvore, para ordenar de baixo para cima */
function caminho(id){
  const out = [];
  let l = local(id);
  while(l){
    const irmaos = l.pai_id ? filhos(l.pai_id) : frentes();
    out.unshift(irmaos.indexOf(l));
    l = l.pai_id ? local(l.pai_id) : null;
  }
  return out;
}
function compararCaminho(a, b){
  const pa = caminho(a), pb = caminho(b);
  for(let i = 0; i < Math.max(pa.length, pb.length); i++){
    const d = (pa[i] === undefined ? -1 : pa[i]) - (pb[i] === undefined ? -1 : pb[i]);
    if(d) return d;
  }
  return 0;
}

/* locais já gravados nesta janela: um "Tentar de novo" depois de uma
   falha de rede não grava esses de novo */
let gravados = new Set();

export function abrirLote(){
  gravados = new Set();
  if(!estado.locAtivo){ aviso(estado.locErro || "Localização indisponível.", "erro"); return; }
  const titulos = Array.from(new Set(estado.servicos.map(function(x){ return x.titulo; }).filter(Boolean)))
    .sort(function(a,b){ return a.localeCompare(b,"pt-BR"); });

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Cadastro em lote">' +
      '<div class="modal__cab"><h2>Cadastro em lote</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo form-servico" id="loteCorpo">' +
        '<p class="dica" style="margin-top:0">Um serviço para cada local marcado, todos como tarefa planejada.</p>' +
        '<fieldset class="grupo"><legend>O serviço</legend><div class="form-grade">' +
          '<div class="campo campo--largo"><label for="lTitulo">Título *</label>' +
            '<input type="text" id="lTitulo" list="lTitulos" placeholder="Alvenaria" autocomplete="off">' +
            '<datalist id="lTitulos">' + titulos.map(function(o){ return '<option value="' + esc(o) + '">'; }).join("") + '</datalist></div>' +
          '<div class="campo"><label for="lDisciplina">Disciplina</label><input type="text" id="lDisciplina" list="listaDisciplinasLote">' +
            '<datalist id="listaDisciplinasLote"><option value="Estrutura"><option value="Alvenaria"><option value="Revestimento"><option value="Instalações hidrossanitárias"><option value="Instalações elétricas"><option value="Impermeabilização"><option value="Pintura"></datalist></div>' +
          '<div class="campo"><label for="lResp">Responsável</label><input type="text" id="lResp"></div>' +
          '<div class="campo"><label for="lQuant">Quantidade por local</label><input type="number" id="lQuant" min="0" step="0.01"></div>' +
          '<div class="campo"><label for="lUnidade">Unidade</label><input type="text" id="lUnidade" list="lUnidades">' +
            '<datalist id="lUnidades">' + UNIDADES.map(function(o){ return '<option value="' + o + '">'; }).join("") + '</datalist></div>' +
          '<div class="campo campo--largo"><label for="lDetalhe">Detalhe do local</label><input type="text" id="lDetalhe" placeholder="opcional, vale para todos"></div>' +
        '</div></fieldset>' +
        '<fieldset class="grupo"><legend>Locais (um serviço por local marcado)</legend>' +
          '<div class="seletor-loc" id="loteLocais"></div>' +
        '</fieldset>' +
        '<fieldset class="grupo"><legend>Datas</legend><div class="form-grade">' +
          '<div class="campo"><label for="lInicio">Início do primeiro *</label><input type="date" id="lInicio"></div>' +
          '<div class="campo"><label for="lDuracao">Duração de cada um (dias úteis) *</label><input type="number" id="lDuracao" min="1" step="1" value="5"></div>' +
          '<div class="campo"><label for="lDefasagem">Entre um e outro (dias úteis)</label><input type="number" id="lDefasagem" min="0" step="1" value="5">' +
            '<span class="dica">Quantos dias úteis depois do anterior cada local começa. 0 = todos juntos.</span></div>' +
          '<div class="campo"><label for="lOrdem">Ordem</label><select id="lOrdem">' +
            '<option value="sobe">De baixo para cima (térreo primeiro)</option><option value="desce">De cima para baixo</option></select></div>' +
        '</div></fieldset>' +
        '<div id="lotePrevia"></div>' +
      '</div>' +
      '<div class="modal__pe">' +
        '<button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn--marca" id="btnGravarLote" disabled>Gravar</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  montarSeletor($("#loteLocais"), estado.filtros.local && estado.filtros.local !== "__sem" ? [estado.filtros.local] : []);
  const corpo = $("#loteCorpo");
  corpo.addEventListener("input", pintarPrevia);
  corpo.addEventListener("change", pintarPrevia);
  corpo.addEventListener("click", function(){ setTimeout(pintarPrevia, 0); });   /* chips do seletor */
  pintarPrevia();
  setTimeout(function(){ $("#lTitulo").focus(); }, 40);
}

/* monta a lista que será gravada (sem gravar) */
function montarLista(){
  const v = function(idc){ return $("#" + idc).value.trim(); };
  const problemas = [];
  const titulo = v("lTitulo");
  const inicio = v("lInicio");
  const dur = Number(v("lDuracao"));
  const def = Number(v("lDefasagem") || 0);
  let ids = idsSelecionados().slice().sort(compararCaminho);
  if(v("lOrdem") === "desce") ids.reverse();

  if(!titulo) problemas.push("Informe o título.");
  if(!ids.length) problemas.push("Marque ao menos um local.");
  if(!inicio) problemas.push("Informe o início do primeiro.");
  if(!(dur >= 1)) problemas.push("A duração deve ser de pelo menos 1 dia útil.");
  if(def < 0) problemas.push("A defasagem não pode ser negativa.");
  if(problemas.length) return { problemas:problemas, itens:[] };

  const codigos = proximosCodigos(ids.length);
  let ini = proximoDiaUtil(inicio);
  const itens = ids.map(function(idLocal, i){
    if(i > 0) ini = def ? somarDiasUteis(ini, def) : ini;
    const fim = terminoPorDiasUteis(ini, dur);
    return { codigo:codigos[i], idLocal:idLocal, inicio:ini, fimPrev:fim };
  });
  return { problemas:[], itens:itens, titulo:titulo };
}

function pintarPrevia(){
  const r = montarLista();
  const alvo = $("#lotePrevia"), btn = $("#btnGravarLote");
  if(!alvo) return;
  if(r.problemas.length){
    alvo.innerHTML = '<p class="dica">' + r.problemas.map(esc).join(" ") + '</p>';
    btn.disabled = true; btn.textContent = "Gravar";
    return;
  }
  alvo.innerHTML =
    '<div class="painel-tabela"><div class="painel-tabela__cab"><span class="rotulo">Prévia: ' + r.itens.length + ' serviço(s)</span>' +
      '<span class="dica">nada foi gravado ainda</span></div>' +
    '<table class="tabela"><thead><tr><th>Código</th><th>Serviço</th><th>Local</th><th>Início</th><th>Término</th><th class="num">Dias úteis</th></tr></thead><tbody>' +
    r.itens.map(function(it){
      return '<tr><td class="cod">' + esc(it.codigo) + '</td><td class="tit">' + esc(r.titulo) + '</td>' +
        '<td>' + esc(textoDeIds([it.idLocal])) + '</td><td class="num">' + fmtLongo(it.inicio) + '</td>' +
        '<td class="num">' + fmtLongo(it.fimPrev) + '</td><td class="num">' + diasUteis(it.inicio, it.fimPrev) + '</td></tr>';
    }).join("") + '</tbody></table></div>';
  btn.disabled = false;
  btn.textContent = "Gravar " + r.itens.length + " serviço(s)";
}

export async function gravarLote(){
  const r = montarLista();
  if(r.problemas.length || !r.itens.length) return;
  if(!confirm("Gravar " + r.itens.length + " serviço(s) planejado(s)?")) return;
  const v = function(idc){ return $("#" + idc).value.trim(); };
  const btn = $("#btnGravarLote");
  btn.disabled = true;
  let n = 0;
  try{
    for(const it of r.itens){
      if(gravados.has(it.idLocal)){ n++; continue; }   /* já gravado numa tentativa anterior */
      btn.textContent = "Gravando " + (n + 1) + " de " + r.itens.length + "...";
      const s = novoServico({
        codigo: it.codigo, titulo: r.titulo, disciplina: v("lDisciplina"), responsavel: v("lResp"),
        quantidade: Number(v("lQuant")) || 0, unidade: v("lUnidade"), local: v("lDetalhe"),
        inicio: it.inicio, fimPrev: it.fimPrev
      });
      await salvar("servicos", s);
      estado.servicos.push(s);
      gravados.add(it.idLocal);
      await definirLigacoes(s.id, [it.idLocal]);
      n++;
    }
  } catch(e){
    console.error(e);
    pintarTudo();
    aviso("Parou no " + (n + 1) + "º de " + r.itens.length + ": " + explicarErro(e) + " Os " + n + " anteriores foram gravados.", "erro");
    btn.disabled = false; btn.textContent = "Tentar de novo";
    return;
  }
  fecharModal();
  pintarTudo();
  aviso(n + " serviço(s) cadastrado(s)");
}
