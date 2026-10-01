import { diasCorridos, diasUteis, difDias, hojeISO, lerData, somarDiasUteis, terminoPorDiasUteis } from "./datas.js";
import { explicarErro, mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { definirLigacoes, ligacoesDe } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { idsSelecionados, montarSeletor } from "./seletorLocal.js";
import { abrirTriagem } from "./triagem.js";
import { codigoEmUso, fotosDo, novoServico, proximoCodigo, STATUS, UNIDADES } from "./servicos.js";
import { apagar, salvar } from "./supabase.js";
import { $, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   CADASTRO / EDIÇÃO / DUPLICAÇÃO DE SERVIÇO
   Campos agrupados, validação enquanto digita e foco no título.
   "Salvar e cadastrar outro" mantém frente, pavimento, disciplina,
   responsável e datas, para lançar vários serviços em sequência.
   ------------------------------------------------------------ */
const DISCIPLINAS = ['Serviços preliminares','Fundação','Estrutura','Alvenaria','Instalações hidrossanitárias',
  'Instalações elétricas','Impermeabilização','Revestimento','Fachada','Esquadrias',
  'Cobertura','Pintura','Paisagismo','Piscina','Acabamento','Limpeza','Entrega'];

let ctx = { voltarParaTriagem:false, editandoId:null, comoTarefa:false };

/* opcoes: { deTriagem, duplicarDe: id, manter: {campos para "cadastrar outro"} } */
export function abrirFormServico(idServico, comoTarefa, opcoes){
  opcoes = opcoes || {};
  ctx = { voltarParaTriagem: !!opcoes.deTriagem, editandoId: idServico || null, comoTarefa: !!comoTarefa, tocados: new Set() };
  const s = idServico ? estado.servicos.find(function(x){ return x.id === idServico; }) : null;
  const novo = !s;
  const origem = opcoes.duplicarDe ? estado.servicos.find(function(x){ return x.id === opcoes.duplicarDe; }) : null;

  let d, locais;
  if(s){
    d = s; locais = ligacoesDe(s.id);
  } else if(origem){
    /* duplicar: mesmo serviço, próxima janela de datas, mesma duração em dias úteis */
    const nUteis = origem.inicio && origem.fimPrev ? diasUteis(origem.inicio, origem.fimPrev) : null;
    const ini = origem.fimPrev ? somarDiasUteis(origem.fimPrev, 1) : (origem.inicio || "");
    d = Object.assign({}, origem, {
      codigo: proximoCodigo(), status:"planejado", fimReal:"", avanco:0,
      inicio: ini, fimPrev: nUteis && ini ? terminoPorDiasUteis(ini, nUteis) : ""
    });
    locais = ligacoesDe(origem.id);
  } else {
    const m = opcoes.manter || {};
    d = {
      codigo: proximoCodigo(), titulo:"", local: m.local || "", disciplina: m.disciplina || "", status:"planejado",
      inicio: m.inicio || (comoTarefa ? "" : hojeISO()), fimPrev: m.fimPrev || "", fimReal:"",
      responsavel: m.responsavel || "", equipe: m.equipe || [], avanco:0, descricao:"", quantidade:"", unidade: m.unidade || ""
    };
    const filtroLocal = estado.filtros.local && estado.filtros.local !== "__sem" ? [estado.filtros.local] : [];
    locais = m.locais || filtroLocal;
  }

  const titulo = s ? "Editar serviço" : origem ? "Duplicar " + origem.codigo : (comoTarefa ? "Nova tarefa planejada" : "Cadastrar serviço");
  const titulos = Array.from(new Set(estado.servicos.map(function(x){ return x.titulo; }).filter(Boolean)))
    .sort(function(a,b){ return a.localeCompare(b,"pt-BR"); });

  const campo = function(idc, rotulo, html, classe, dica){
    return '<div class="campo' + (classe ? " " + classe : "") + '"><label for="' + idc + '">' + rotulo + '</label>' + html +
      (dica ? '<span class="dica">' + dica + '</span>' : '') +
      '<span class="erro-campo" id="erro_' + idc + '" role="alert"></span></div>';
  };

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
      '<div class="modal__cab"><h2>' + esc(titulo) + '</h2>' +
        '<button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo form-servico">' +
        (origem ? '<p class="aviso" style="margin-top:0">Cópia de <strong>' + esc(origem.codigo + " · " + origem.titulo) +
          '</strong>. Ajuste a localização e as datas. Apontamentos e fotos não são copiados.</p>' : '') +
        (novo && comoTarefa && !origem ? '<p class="dica" style="margin-top:0">Tarefa futura: quando a frente for liberada, use o botão Iniciar na aba Planejamento.</p>' : '') +

        '<fieldset class="grupo"><legend>O serviço</legend><div class="form-grade">' +
          campo("fTitulo", "Título *",
            '<input type="text" id="fTitulo" list="listaTitulos" value="' + esc(d.titulo) + '" placeholder="Forma, Armação, Alvenaria..." autocomplete="off">' +
            '<datalist id="listaTitulos">' + titulos.map(function(o){ return '<option value="' + esc(o) + '">'; }).join("") + '</datalist>',
            "campo--largo", 'Use sempre o mesmo nome para o mesmo tipo de serviço: é o que permite filtrar todos de uma vez.') +
          campo("fDisciplina", "Disciplina",
            '<input type="text" id="fDisciplina" list="listaDisciplinas" value="' + esc(d.disciplina) + '" placeholder="Estrutura, Alvenaria...">' +
            '<datalist id="listaDisciplinas">' + DISCIPLINAS.map(function(o){ return '<option value="' + o + '">'; }).join("") + '</datalist>') +
          campo("fCodigo", "Código", '<input type="text" id="fCodigo" value="' + esc(d.codigo) + '">', "", "Preenchido sozinho; pode trocar.") +
        '</div></fieldset>' +

        '<fieldset class="grupo"><legend>Onde</legend><div class="form-grade">' +
          '<div class="campo campo--largo"><label>Localização</label><div class="seletor-loc" id="seletorLocal"></div></div>' +
          campo("fLocal", "Detalhe do local", '<input type="text" id="fLocal" value="' + esc(d.local) + '" placeholder="Trecho, eixo, fachada... (opcional)">', "campo--largo") +
        '</div></fieldset>' +

        '<fieldset class="grupo"><legend>Quando</legend><div class="form-grade">' +
          campo("fInicio", "Início *", '<input type="date" id="fInicio" value="' + esc(d.inicio) + '">') +
          campo("fFimPrev", "Término previsto", '<input type="date" id="fFimPrev" value="' + esc(d.fimPrev) + '">') +
          campo("fDiasUteis", "Duração (dias úteis)", '<input type="number" id="fDiasUteis" min="1" step="1" placeholder="ex.: 5">', "",
            "Preencha para calcular o término.") +
          '<div class="campo campo--largo"><span class="dica" id="fDuracao"></span></div>' +
          (s ?
            campo("fStatus", "Status", '<select id="fStatus">' + Object.keys(STATUS).map(function(k){
              return '<option value="' + k + '"' + (k === d.status ? " selected" : "") + '>' + STATUS[k].rot + '</option>'; }).join("") + '</select>') +
            campo("fFimReal", "Término real", '<input type="date" id="fFimReal" value="' + esc(d.fimReal) + '">') +
            campo("fAvanco", "Avanço (%)", '<input type="number" id="fAvanco" min="0" max="100" step="5" value="' + (d.avanco || 0) + '">')
          : '') +
        '</div></fieldset>' +

        '<fieldset class="grupo"><legend>Quantidade e equipe</legend><div class="form-grade">' +
          campo("fQuant", "Quantitativo previsto", '<input type="number" id="fQuant" min="0" step="0.01" value="' + (d.quantidade || "") + '" placeholder="ex.: 320">') +
          campo("fUnidade", "Unidade", '<input type="text" id="fUnidade" list="listaUnidades" value="' + esc(d.unidade || "") + '" placeholder="m²">' +
            '<datalist id="listaUnidades">' + UNIDADES.map(function(o){ return '<option value="' + o + '">'; }).join("") + '</datalist>') +
          campo("fResp", "Responsável", '<input type="text" id="fResp" value="' + esc(d.responsavel) + '" placeholder="Encarregado ou engenheiro">') +
          campo("fEquipe", "Equipe prevista", '<input type="text" id="fEquipe" value="' + esc((d.equipe || []).join(", ")) + '" placeholder="Nomes separados por vírgula">', "campo--largo") +
        '</div></fieldset>' +

        '<fieldset class="grupo"><legend>Escopo</legend>' +
          '<div class="campo"><label for="fDescricao" class="visualmente-oculto">Escopo</label>' +
          '<textarea id="fDescricao" placeholder="O que está incluso, critério de medição, observações.">' + esc(d.descricao) + '</textarea></div>' +
        '</fieldset>' +
      '</div>' +
      '<div class="modal__pe">' +
        (s ? '<button class="btn btn--perigo" data-acao="excluir-servico" data-id="' + s.id + '">Excluir</button>' +
             '<button class="btn" data-acao="duplicar" data-id="' + s.id + '" style="margin-right:auto">Duplicar</button>'
           : '<span style="margin-right:auto"></span>') +
        '<button class="btn" data-fechar>Cancelar</button>' +
        (s ? '' : '<button class="btn" id="btnGravarOutro">Salvar e cadastrar outro</button>') +
        '<button class="btn btn--marca" id="btnGravarServico" data-id="' + (s ? s.id : "") + '">' +
          (s ? "Salvar alterações" : (comoTarefa || origem ? "Cadastrar tarefa" : "Cadastrar serviço")) + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  montarSeletor($("#seletorLocal"), locais);
  const modal = $("#modais .modal");
  modal.addEventListener("input", aoDigitar);
  modal.addEventListener("change", aoDigitar);
  atualizarDuracao();
  setTimeout(function(){ const t = $("#fTitulo"); if(t){ t.focus(); if(origem) t.select(); } }, 40);
}

/* ---------- validação ---------- */
function marcar(idc, msg){
  const el = $("#" + idc), er = $("#erro_" + idc);
  if(er) er.textContent = msg || "";
  if(el) el.setAttribute("aria-invalid", msg ? "true" : "false");
  return !msg;
}

/* Devolve a lista de campos com problema. Enquanto digita, só mostra
   a mensagem nos campos já tocados; ao salvar (todos=true), em todos. */
function validar(todos){
  const v = function(idc){ const e = $("#" + idc); return e ? e.value.trim() : ""; };
  const erros = [];
  const ok = function(idc, msg){
    if(msg) erros.push(idc);
    if(todos || ctx.tocados.has(idc)) marcar(idc, msg);
  };

  ok("fTitulo", v("fTitulo") ? "" : "Informe o título do serviço.");
  const ini = v("fInicio");
  ok("fInicio", !ini ? "Informe a data de início." : (lerData(ini) ? "" : "Data inválida."));
  const fim = v("fFimPrev");
  ok("fFimPrev", fim && ini && difDias(ini, fim) < 0 ? "O término previsto é anterior ao início." : "");
  if($("#fFimReal")){
    const real = v("fFimReal");
    ok("fFimReal", real && ini && difDias(ini, real) < 0 ? "O término real é anterior ao início." : "");
  }
  const cod = v("fCodigo");
  const uso = cod ? codigoEmUso(cod, ctx.editandoId) : null;
  ok("fCodigo", uso ? 'Já usado em "' + uso.titulo + '". Sugestão: ' + proximoCodigo() : "");
  const q = v("fQuant");
  ok("fQuant", q && (isNaN(Number(q)) || Number(q) < 0) ? "Quantidade inválida." : "");
  return erros;
}

function atualizarDuracao(){
  const ini = $("#fInicio").value, fim = $("#fFimPrev").value, alvo = $("#fDuracao");
  if(!alvo) return;
  if(ini && fim && difDias(ini, fim) >= 0){
    alvo.textContent = "Prazo: " + diasUteis(ini, fim) + " dia(s) úteis, " + diasCorridos(ini, fim) + " corridos.";
  } else alvo.textContent = "";
}

function aoDigitar(ev){
  const idc = ev.target.id;
  /* duração em dias úteis preenche o término */
  if(idc === "fDiasUteis" || (idc === "fInicio" && $("#fDiasUteis").value)){
    const n = Number($("#fDiasUteis").value);
    const ini = $("#fInicio").value;
    if(ini && n >= 1) $("#fFimPrev").value = terminoPorDiasUteis(ini, n);
  }
  if(idc === "fFimPrev") $("#fDiasUteis").value = "";
  if(idc === "fDiasUteis") ctx.tocados.add("fFimPrev");
  atualizarDuracao();
  /* o campo conta como "tocado" ao sair dele (change) ou se já mostrava erro */
  if(ev.type === "change" || ($("#erro_" + idc) && $("#erro_" + idc).textContent)) ctx.tocados.add(idc);
  validar(false);
}

/* ---------- gravação ---------- */
export async function gravarServico(idServico, continuar){
  const erros = validar(true);
  if(erros.length){
    aviso("Corrija os campos marcados em vermelho.", "erro");
    const el = $("#" + erros[0]); if(el) el.focus();
    return;
  }
  const v = function(idc){ const e = $("#" + idc); return e ? e.value.trim() : ""; };
  const existente = idServico ? estado.servicos.find(function(x){ return x.id === idServico; }) : null;

  const campos = {
    codigo: v("fCodigo") || proximoCodigo(),
    titulo: v("fTitulo"),
    local: v("fLocal"),
    disciplina: v("fDisciplina"),
    inicio: v("fInicio"),
    fimPrev: v("fFimPrev"),
    quantidade: Number(v("fQuant")) || 0,
    unidade: v("fUnidade"),
    responsavel: v("fResp"),
    equipe: v("fEquipe").split(",").map(function(p){ return p.trim(); }).filter(Boolean),
    descricao: v("fDescricao")
  };

  let s;
  if(existente){
    s = existente;
    Object.assign(s, campos);
    s.status = $("#fStatus").value;
    s.avanco = Math.max(0, Math.min(100, Number(v("fAvanco")) || 0));
    const fimReal = v("fFimReal");
    s.fimReal = fimReal;
    if(s.status === "concluido" && !s.fimReal) s.fimReal = s.fimPrev || hojeISO();
  } else {
    s = novoServico(campos);
  }

  const locais = idsSelecionados();
  const antes = existente ? JSON.parse(JSON.stringify(existente)) : null;

  try{
    await salvar("servicos", s);
  } catch(e){
    if(antes) Object.assign(existente, antes);
    aviso(explicarErro(e), "erro");
    return;
  }
  if(!existente) estado.servicos.push(s);

  /* a localização vai numa tabela à parte, depois do serviço existir */
  let falhaLocal = null;
  if(estado.locAtivo){
    try { await definirLigacoes(s.id, locais); }
    catch(e){ falhaLocal = e; console.error(e); }
  }
  pintarTudo();
  if(falhaLocal){
    fecharModal();
    aviso("O serviço foi gravado, mas a localização não: " + explicarErro(falhaLocal) + " Abra o serviço e tente de novo.", "erro");
    return;
  }
  aviso(existente ? "Serviço atualizado" : "Serviço " + s.codigo + " cadastrado");

  if(continuar){
    abrirFormServico(null, ctx.comoTarefa, { manter: {
      locais: locais, local: s.local, disciplina: s.disciplina, responsavel: s.responsavel,
      equipe: s.equipe, unidade: s.unidade, inicio: s.inicio, fimPrev: s.fimPrev
    }});
    return;
  }
  fecharModal();
  if(ctx.voltarParaTriagem){ ctx.voltarParaTriagem = false; abrirTriagem(); }
}

export async function excluirServico(idServico){
  const s = estado.servicos.find(function(x){ return x.id === idServico; });
  if(!s) return;
  if(!confirm('Excluir "' + s.titulo + '" e todos os seus apontamentos e fotos? Esta ação não pode ser desfeita.')) return;
  try{
    for(const f of fotosDo(s)){
      await apagar("fotos", f);
      if(estado.urls.has(f)){ URL.revokeObjectURL(estado.urls.get(f)); estado.urls.delete(f); }
    }
    await apagar("servicos", idServico);
  } catch(e){ mostrarErro(e); return; }
  estado.servicos = estado.servicos.filter(function(x){ return x.id !== idServico; });
  if(estado.selecionado === idServico) estado.selecionado = null;
  fecharModal();
  pintarTudo();
  aviso("Serviço excluído");
}

