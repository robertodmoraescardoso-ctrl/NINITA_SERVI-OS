import { diasUteis, feriadosNoPeriodo, fmtLongo, hojeISO } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { guardarFoto, srcFoto } from "./fotos.js";
import { pintarTudo } from "./navegacao.js";
import { avancoFisico, dataReferencia, diasAtraso, duracao, estaAtrasado, num, pessoasDo, quantExecutada, quantPrevista, STATUS, textoQuant } from "./servicos.js";
import { apagar, salvar } from "./supabase.js";
import { $, $$, aviso, esc, id } from "./ui.js";

/* ------------------------------------------------------------
   ACOMPANHAMENTO — lista lateral
   ------------------------------------------------------------ */
export function listaAcompanhamento(){
  const modo = estado.filtros.lista;
  let lista = estado.servicos.slice();
  if(modo === "abertos")   lista = lista.filter(function(s){ return s.status !== "concluido"; });
  if(modo === "andamento") lista = lista.filter(function(s){ return s.status === "andamento"; });
  lista.sort(function(a,b){
    const at = estaAtrasado(b) - estaAtrasado(a);
    if(at) return at;
    return (a.inicio||"9999").localeCompare(b.inicio||"9999");
  });
  return lista;
}

export function pintarListaServicos(){
  const lista = listaAcompanhamento();
  const alvo = $("#listaServicos");

  if(!lista.length){
    alvo.innerHTML = '<div class="vazio" style="padding:26px 14px">' +
      '<p style="font-size:13px">Nenhum serviço neste filtro.</p></div>';
    return;
  }

  alvo.innerHTML = lista.map(function(s){
    const st = STATUS[s.status] || STATUS.planejado;
    const dur = duracao(s);
    const atraso = diasAtraso(s);
    return '<button class="item" data-sel="' + s.id + '" aria-current="' + (estado.selecionado === s.id) + '">' +
      '<span class="item__cod">' + esc(s.codigo) + '</span>' +
      '<div class="item__tit">' + esc(s.titulo) + '</div>' +
      '<div class="item__meta">' +
        '<span class="ponto ponto--' + s.status + '"></span>' + st.rot +
        (dur !== null ? ' · <span class="mono">' + dur + 'd</span>' : '') +
        (atraso > 0 ? ' · <strong style="color:var(--tijolo)">+' + atraso + 'd</strong>' : '') +
      '</div>' +
    '</button>';
  }).join("");
}

/* ------------------------------------------------------------
   ACOMPANHAMENTO — ficha do serviço
   ------------------------------------------------------------ */
export function pintarDetalhe(){
  const alvo = $("#detalhe");
  const s = estado.servicos.find(function(x){ return x.id === estado.selecionado; });

  if(!s){
    alvo.innerHTML = '<div class="folha"><div class="vazio">' +
      '<h3>Selecione um serviço</h3>' +
      '<p>Escolha um serviço na lista ao lado para lançar colaboradores, fotos e observações.</p>' +
      '</div></div>';
    return;
  }

  const st = STATUS[s.status] || STATUS.planejado;
  const dur = duracao(s);
  const uteis = s.inicio ? diasUteis(s.inicio, dataReferencia(s)) : null;
  const atraso = diasAtraso(s);

  alvo.innerHTML =
  '<div class="folha">' +
    '<div class="folha__cab">' +
      '<span class="cod">' + esc(s.codigo) + (s.disciplina ? " · " + esc(s.disciplina) : "") + '</span>' +
      '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
        '<div>' +
          '<h2>' + esc(s.titulo) + '</h2>' +
          (s.local ? '<div style="color:var(--tinta-2);font-size:13px">' + esc(s.local) + '</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
          '<select id="statusRapido" class="btn btn--p" style="padding:5px 8px">' +
            Object.keys(STATUS).map(function(k){
              return '<option value="' + k + '"' + (k === s.status ? " selected" : "") + '>' + STATUS[k].rot + '</option>';
            }).join("") +
          '</select>' +
          '<button class="btn btn--p" data-acao="editar" data-id="' + s.id + '">Editar cadastro</button>' +
        '</div>' +
      '</div>' +
    '</div>' +

    '<div class="folha__grade">' +
      celula("Início", fmtLongo(s.inicio)) +
      celula("Término previsto", fmtLongo(s.fimPrev)) +
      celula("Término real", s.fimReal ? fmtLongo(s.fimReal) : "em aberto") +
      celula("Dias corridos", dur === null ? "—" : dur) +
      celula("Dias úteis", uteis === null ? "—" : uteis) +
      celula("Feriados no período", s.inicio ? feriadosNoPeriodo(s.inicio, dataReferencia(s)).length : "—") +
      celula("Avanço", (s.avanco || 0) + "%") +
      (quantPrevista(s) ? celula("Quantitativo", textoQuant(s)) : "") +
      (quantPrevista(s) ? celula("Avanço físico", avancoFisico(s) + "%") : "") +
      celula("Situação", st.rot + (atraso > 0 ? "  (+" + atraso + "d)" : "")) +
    '</div>' +

    (s.descricao ? '<div class="bloco"><span class="rotulo">Escopo</span>' +
      '<p style="margin:6px 0 0;white-space:pre-wrap">' + esc(s.descricao) + '</p></div>' : '') +

    /* ---- formulário de apontamento ---- */
    '<div class="bloco">' +
      '<div class="bloco__tit"><span class="rotulo">Novo apontamento</span>' +
        '<span class="dica">Registro do que foi executado no dia</span></div>' +
      '<div class="form-grade">' +
        '<div class="campo">' +
          '<label for="apData">Data</label>' +
          '<input type="date" id="apData" value="' + hojeISO() + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="apAvanco">Avanço acumulado (%)</label>' +
          '<input type="number" id="apAvanco" min="0" max="100" step="5" value="' + (s.avanco || 0) + '">' +
        '</div>' +
        '<div class="campo">' +
          '<label for="apEfetivo">Efetivo no serviço</label>' +
          '<input type="number" id="apEfetivo" min="0" step="1" placeholder="nº de pessoas">' +
        '</div>' +

        (quantPrevista(s) ?
        '<div class="campo campo--largo">' +
          '<label for="apQuant">Quantidade executada neste lançamento (' + esc(s.unidade || "un") + ')</label>' +
          '<input type="number" id="apQuant" min="0" step="0.01" data-prev="' + quantPrevista(s) + '" data-exec="' + quantExecutada(s) + '" placeholder="0">' +
          '<span class="dica">Acumulado até aqui: ' + num(quantExecutada(s)) + ' de ' + num(quantPrevista(s)) + ' ' + esc(s.unidade || "") +
            '. O avanço acima é recalculado sozinho ao preencher este campo.</span>' +
        '</div>' : '') +

        '<div class="campo campo--largo">' +
          '<label>Colaboradores envolvidos</label>' +
          '<div class="chips" id="chipsColab"><input type="text" id="entradaColab" placeholder="Digite o nome e tecle Enter"></div>' +
          '<div class="sugestoes" id="sugestoesColab"></div>' +
        '</div>' +

        '<div class="campo campo--largo">' +
          '<label for="apObs">Observações</label>' +
          '<textarea id="apObs" placeholder="Frente executada, interferências, condição do tempo, decisões tomadas, pendências."></textarea>' +
        '</div>' +

        '<div class="campo campo--largo">' +
          '<label>Fotos</label>' +
          '<div class="dropzone" id="zonaFotos">' +
            '<strong>Adicionar fotos</strong>' +
            '<span class="dica">Clique, arraste os arquivos ou use a câmera do celular</span>' +
          '</div>' +
          '<input type="file" id="arquivoFotos" accept="image/*" capture="environment" multiple hidden>' +
          '<div class="miniaturas" id="miniaturas"></div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">' +
        '<button class="btn" id="btnLimparApont">Limpar</button>' +
        '<button class="btn btn--madeira" id="btnSalvarApont">Salvar apontamento</button>' +
      '</div>' +
    '</div>' +

    /* ---- histórico ---- */
    '<div class="bloco">' +
      '<div class="bloco__tit"><span class="rotulo">Histórico</span>' +
        '<span class="dica">' + (s.apontamentos || []).length + ' registro(s)</span></div>' +
      historico(s) +
    '</div>' +
  '</div>';

  montarChips();
  rascunho.fotos = [];
  pintarMiniaturas();
}

export function celula(rot, val){
  return '<div class="dados__c"><span class="dados__r">' + rot + '</span>' +
         '<span class="dados__v">' + esc(val) + '</span></div>';
}

export function historico(s){
  const aps = (s.apontamentos || []).slice().sort(function(a,b){
    return (b.data || "").localeCompare(a.data || "");
  });
  if(!aps.length){
    return '<p style="color:var(--tinta-2);font-size:13.5px;margin:0">' +
      'Nenhum apontamento registrado. O primeiro lançamento aparece aqui.</p>';
  }
  return '<ol class="historico">' + aps.map(function(a){
    const fotos = (a.fotos || []).map(function(f){
      return '<div class="mini"><img src="' + srcFoto(f) + '" alt="Registro fotográfico" data-foto="' + f + '" data-srv="' + s.id + '" style="cursor:zoom-in"></div>';
    }).join("");
    const colabs = (a.colaboradores || []).map(function(p){
      return '<span class="pessoa">' + esc(p) + '</span>';
    }).join("");
    return '<li class="apont">' +
      '<div class="apont__cab">' +
        '<span class="apont__data">' + fmtLongo(a.data) + '</span>' +
        (a.avanco != null ? '<span class="etiqueta etiqueta--avanco">' + a.avanco + '%</span>' : '') +
        (a.quantidade ? '<span class="etiqueta etiqueta--avanco">' + num(a.quantidade) + ' ' + esc(s.unidade || "") + '</span>' : '') +
        (a.efetivo ? '<span class="etiqueta">efetivo ' + a.efetivo + '</span>' : '') +
        '<button class="btn btn--p btn--fantasma" data-acao="apagar-apont" data-srv="' + s.id + '" data-ap="' + a.id + '" style="margin-left:auto">Excluir</button>' +
      '</div>' +
      (colabs ? '<div class="equipe" style="margin:3px 0">' + colabs + '</div>' : '') +
      (a.observacao ? '<div class="apont__obs">' + esc(a.observacao) + '</div>' : '') +
      (fotos ? '<div class="miniaturas">' + fotos + '</div>' : '') +
    '</li>';
  }).join("") + '</ol>';
}

/* ------------------------------------------------------------
   RASCUNHO DO APONTAMENTO (chips + fotos)
   ------------------------------------------------------------ */
export const rascunho = { colaboradores: [], fotos: [] };

export function montarChips(){
  rascunho.colaboradores = [];
  pintarChips();
  pintarSugestoes();
}

export function pintarChips(){
  const caixa = $("#chipsColab");
  if(!caixa) return;
  const entrada = $("#entradaColab");
  $$(".chip", caixa).forEach(function(c){ c.remove(); });
  rascunho.colaboradores.forEach(function(nome, i){
    const el = document.createElement("span");
    el.className = "chip";
    el.innerHTML = esc(nome) + '<button type="button" data-remove-chip="' + i + '" aria-label="Remover ' + esc(nome) + '">&times;</button>';
    caixa.insertBefore(el, entrada);
  });
}

export function pintarSugestoes(){
  const alvo = $("#sugestoesColab");
  if(!alvo) return;
  const todos = new Set();
  estado.servicos.forEach(function(s){
    pessoasDo(s).forEach(function(p){ todos.add(p); });
  });
  const nomes = Array.from(todos)
    .filter(function(n){ return rascunho.colaboradores.indexOf(n) === -1; })
    .sort(function(a,b){ return a.localeCompare(b,"pt-BR"); })
    .slice(0, 14);
  alvo.innerHTML = nomes.length
    ? '<span class="dica" style="align-self:center;margin-right:2px">já cadastrados:</span>' +
      nomes.map(function(n){ return '<button type="button" class="sugestao" data-sug="' + esc(n) + '">' + esc(n) + '</button>'; }).join("")
    : "";
}

export function addColaborador(nome){
  const n = String(nome || "").trim().replace(/\s+/g," ");
  if(!n) return;
  if(rascunho.colaboradores.indexOf(n) === -1) rascunho.colaboradores.push(n);
  pintarChips();
  pintarSugestoes();
}

export function pintarMiniaturas(){
  const alvo = $("#miniaturas");
  if(!alvo) return;
  alvo.innerHTML = rascunho.fotos.map(function(f, i){
    return '<div class="mini"><img src="' + srcFoto(f) + '" alt="Foto selecionada">' +
      '<button type="button" data-remove-foto="' + i + '" aria-label="Remover foto">&times;</button></div>';
  }).join("");
}

export async function receberArquivos(arquivos){
  const imagens = Array.prototype.slice.call(arquivos).filter(function(a){
    return a.type && a.type.indexOf("image/") === 0;
  });
  if(!imagens.length) return;
  aviso("Processando " + imagens.length + " foto(s)...");
  for(const arq of imagens){
    try { rascunho.fotos.push(await guardarFoto(arq)); }
    catch(e){ aviso("Não foi possível gravar uma das fotos."); }
  }
  pintarMiniaturas();
  aviso(imagens.length + " foto(s) prontas para o apontamento");
}

/* ------------------------------------------------------------
   SALVAR APONTAMENTO
   ------------------------------------------------------------ */
export async function salvarApontamento(){
  const s = estado.servicos.find(function(x){ return x.id === estado.selecionado; });
  if(!s) return;

  const data = $("#apData").value || hojeISO();
  const obs = $("#apObs").value.trim();
  const avancoBruto = $("#apAvanco").value;
  const efetivo = $("#apEfetivo").value;
  const quantExec = $("#apQuant") ? $("#apQuant").value : "";
  const pendente = $("#entradaColab").value.trim();
  if(pendente) addColaborador(pendente);

  if(!obs && !rascunho.fotos.length && !rascunho.colaboradores.length && quantExec === ""){
    aviso("Registre ao menos uma observação, foto ou colaborador.");
    return;
  }

  const ap = {
    id: id(),
    data: data,
    observacao: obs,
    colaboradores: rascunho.colaboradores.slice(),
    fotos: rascunho.fotos.slice(),
    avanco: avancoBruto === "" ? null : Math.max(0, Math.min(100, Number(avancoBruto))),
    efetivo: efetivo === "" ? null : Number(efetivo),
    quantidade: quantExec === "" ? null : Number(quantExec),
    criadoEm: new Date().toISOString()
  };

  const antes = { avanco:s.avanco, status:s.status, fimReal:s.fimReal };
  s.apontamentos = s.apontamentos || [];
  s.apontamentos.push(ap);

  if(ap.avanco != null){
    s.avanco = ap.avanco;
    /* o avanço governa o status: 100% fecha o serviço na data do apontamento */
    if(ap.avanco >= 100 && s.status !== "concluido"){
      s.status = "concluido";
      if(!s.fimReal) s.fimReal = data;
    } else if(ap.avanco > 0 && ap.avanco < 100 && s.status === "planejado"){
      s.status = "andamento";
    }
  }
  if(s.status === "planejado" && !s.fimReal) s.status = "andamento";

  const btn = $("#btnSalvarApont");
  if(btn){ btn.disabled = true; btn.textContent = "Salvando..."; }
  try{
    await salvar("servicos", s);
  } catch(e){
    /* devolve o apontamento para o rascunho: nada do que foi digitado se perde */
    s.apontamentos = s.apontamentos.filter(function(a){ return a.id !== ap.id; });
    s.avanco = antes.avanco; s.status = antes.status; s.fimReal = antes.fimReal;
    if(btn){ btn.disabled = false; btn.textContent = "Salvar apontamento"; }
    aviso(explicarErro(e));
    return;
  }
  rascunho.fotos = [];
  rascunho.colaboradores = [];
  pintarTudo();
  aviso("Apontamento salvo em " + fmtLongo(data));
}
