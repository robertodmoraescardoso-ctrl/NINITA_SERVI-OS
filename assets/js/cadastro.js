import { difDias, hojeISO } from "./datas.js";
import { explicarErro, mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { definirLigacoes, ligacoesDe } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { idsSelecionados, montarSeletor } from "./seletorLocal.js";
import { abrirTriagem } from "./triagem.js";
import { fotosDo, proximoCodigo, STATUS, UNIDADES } from "./servicos.js";
import { apagar, salvar } from "./supabase.js";
import { $, aviso, esc, fecharModal, id } from "./ui.js";

/* ------------------------------------------------------------
   CADASTRO / EDIÇÃO DE SERVIÇO
   ------------------------------------------------------------ */
let voltarParaTriagem = false;

export function abrirFormServico(idServico, comoTarefa, opcoes){
  voltarParaTriagem = !!(opcoes && opcoes.deTriagem);
  const s = idServico ? estado.servicos.find(function(x){ return x.id === idServico; }) : null;
  const novo = !s;
  const d = s || {
    codigo: proximoCodigo(), titulo:"", local:"", disciplina:"", status:"planejado",
    inicio: comoTarefa ? "" : hojeISO(), fimPrev:"", fimReal:"", responsavel:"", equipe:[],
    avanco:0, descricao:"", quantidade:"", unidade:""
  };

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal" role="dialog" aria-modal="true" aria-label="' + (novo ? "Cadastrar serviço" : "Editar serviço") + '">' +
      '<div class="modal__cab">' +
        
        '<h2>' + (novo ? (comoTarefa ? "Nova tarefa planejada" : "Cadastrar serviço") : "Editar serviço") + '</h2>' +
        '<button class="fechar" data-fechar aria-label="Fechar">&times;</button>' +
      '</div>' +
      '<div class="modal__corpo">' +
        '<div class="form-grade">' +
          '<div class="campo"><label for="fCodigo">Código</label>' +
            '<input type="text" id="fCodigo" value="' + esc(d.codigo) + '"></div>' +
          '<div class="campo"><label for="fDisciplina">Disciplina / etapa</label>' +
            '<input type="text" id="fDisciplina" list="listaDisciplinas" value="' + esc(d.disciplina) + '" placeholder="Estrutura, alvenaria, instalações...">' +
            '<datalist id="listaDisciplinas">' +
              ['Serviços preliminares','Fundação','Estrutura','Alvenaria','Instalações hidrossanitárias',
               'Instalações elétricas','Impermeabilização','Revestimento','Fachada','Esquadrias',
               'Cobertura','Pintura','Paisagismo','Piscina','Acabamento','Limpeza','Entrega']
               .map(function(o){ return '<option value="' + o + '">'; }).join("") +
            '</datalist></div>' +

          (novo && comoTarefa ? '<p class="dica campo--largo" style="margin:0">' +
            'Tarefa futura: preencha a data prevista de início. Quando a frente for liberada no canteiro, ' +
            'use o botão Iniciar na tabela de planejamento.</p>' : '') +
          '<div class="campo campo--largo"><label for="fTitulo">Título do serviço *</label>' +
            '<input type="text" id="fTitulo" list="listaTitulos" value="' + esc(d.titulo) + '" placeholder="Forma, Armação, Concretagem...">' +
            '<datalist id="listaTitulos">' +
              Array.from(new Set(estado.servicos.map(function(x){ return x.titulo; }).filter(Boolean)))
                .sort(function(a,b){ return a.localeCompare(b,"pt-BR"); })
                .map(function(o){ return '<option value="' + esc(o) + '">'; }).join("") +
            '</datalist>' +
            '<span class="dica">Use sempre o mesmo nome para o mesmo tipo de serviço (ex.: sempre "Forma", nunca variar para "FORMA" ou "Fôrma") — é o que permite filtrar todos de uma vez.</span>' +
          '</div>' +

          '<div class="campo campo--largo"><label>Localização</label>' +
            '<div class="seletor-loc" id="seletorLocal"></div></div>' +

          '<div class="campo campo--largo"><label for="fLocal">Detalhe do local</label>' +
            '<input type="text" id="fLocal" value="' + esc(d.local) + '" placeholder="Trecho, eixo, fachada... (opcional)">' +
            '<span class="dica">Complemento livre. Frente e pavimento ficam na Localização acima, que é o que o filtro usa.</span></div>' +

          '<div class="campo"><label for="fInicio">Data de início *</label>' +
            '<input type="date" id="fInicio" value="' + esc(d.inicio) + '"></div>' +
          '<div class="campo"><label for="fFimPrev">Término previsto</label>' +
            '<input type="date" id="fFimPrev" value="' + esc(d.fimPrev) + '"></div>' +
          '<div class="campo"><label for="fFimReal">Término real</label>' +
            '<input type="date" id="fFimReal" value="' + esc(d.fimReal) + '"></div>' +

          '<div class="campo"><label for="fStatus">Status</label>' +
            '<select id="fStatus">' + Object.keys(STATUS).map(function(k){
              return '<option value="' + k + '"' + (k === d.status ? " selected" : "") + '>' + STATUS[k].rot + '</option>';
            }).join("") + '</select></div>' +
          '<div class="campo"><label for="fQuant">Quantitativo previsto</label>' +
            '<input type="number" id="fQuant" min="0" step="0.01" value="' + (d.quantidade || "") + '" placeholder="ex.: 320"></div>' +
          '<div class="campo"><label for="fUnidade">Unidade</label>' +
            '<input type="text" id="fUnidade" list="listaUnidades" value="' + esc(d.unidade || "") + '" placeholder="m²">' +
            '<datalist id="listaUnidades">' +
              UNIDADES.map(function(o){ return '<option value="' + o + '">'; }).join("") +
            '</datalist></div>' +
          '<div class="campo"><label for="fAvanco">Avanço (%)</label>' +
            '<input type="number" id="fAvanco" min="0" max="100" step="5" value="' + (d.avanco || 0) + '"></div>' +
          '<div class="campo"><label for="fResp">Responsável</label>' +
            '<input type="text" id="fResp" value="' + esc(d.responsavel) + '" placeholder="Encarregado ou engenheiro"></div>' +

          '<div class="campo campo--largo"><label for="fEquipe">Equipe prevista</label>' +
            '<input type="text" id="fEquipe" value="' + esc((d.equipe || []).join(", ")) + '" placeholder="Nomes separados por vírgula">' +
            '<span class="dica">Outros colaboradores podem ser lançados a cada apontamento.</span></div>' +

          '<div class="campo campo--largo"><label for="fDescricao">Escopo / observações do cadastro</label>' +
            '<textarea id="fDescricao" placeholder="O que está incluso no serviço, quantitativos, critério de medição.">' + esc(d.descricao) + '</textarea></div>' +
        '</div>' +
      '</div>' +
      '<div class="modal__pe">' +
        (novo ? '' : '<button class="btn btn--perigo" data-acao="excluir-servico" data-id="' + s.id + '" style="margin-right:auto">Excluir serviço</button>') +
        '<button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn--marca" id="btnGravarServico" data-id="' + (s ? s.id : "") + '">' +
          (novo ? (comoTarefa ? "Cadastrar tarefa" : "Cadastrar serviço") : "Salvar alterações") + '</button>' +
      '</div>' +
    '</div>' +
  '</div>';

  /* localização: a do serviço, ou — num cadastro novo — a que estiver
     filtrada no painel, para agilizar o lançamento por pavimento */
  const filtroLocal = estado.filtros.local && estado.filtros.local !== "__sem" ? [estado.filtros.local] : [];
  montarSeletor($("#seletorLocal"), s ? ligacoesDe(s.id) : filtroLocal);

  setTimeout(function(){ const t = $("#fTitulo"); if(t) t.focus(); }, 40);
}

export async function gravarServico(idServico){
  const titulo = $("#fTitulo").value.trim();
  const inicio = $("#fInicio").value;
  if(!titulo){ aviso("Informe o título do serviço."); $("#fTitulo").focus(); return; }
  if(!inicio){ aviso("Informe a data de início."); $("#fInicio").focus(); return; }

  const fimPrev = $("#fFimPrev").value;
  const fimReal = $("#fFimReal").value;
  if(fimPrev && difDias(inicio, fimPrev) < 0){ aviso("O término previsto é anterior ao início."); return; }
  if(fimReal && difDias(inicio, fimReal) < 0){ aviso("O término real é anterior ao início."); return; }

  const existente = idServico ? estado.servicos.find(function(x){ return x.id === idServico; }) : null;
  const s = existente || { id:id(), apontamentos:[], fotos:[], criadoEm:new Date().toISOString() };

  const codigoDigitado = $("#fCodigo").value.trim();
  const codigoFinal = codigoDigitado || proximoCodigo();
  const emUsoPor = estado.servicos.find(function(x){
    return x.codigo === codigoFinal && x.id !== (existente ? existente.id : null);
  });
  if(emUsoPor){
    aviso('O código "' + codigoFinal + '" já está em uso em "' + emUsoPor.titulo + '". Sugestão: ' + proximoCodigo());
    $("#fCodigo").focus();
    return;
  }
  s.codigo = codigoFinal;
  s.titulo = titulo;
  s.local = $("#fLocal").value.trim();
  s.disciplina = $("#fDisciplina").value.trim();
  s.inicio = inicio;
  s.fimPrev = fimPrev;
  s.fimReal = fimReal;
  s.status = $("#fStatus").value;
  s.avanco = Math.max(0, Math.min(100, Number($("#fAvanco").value) || 0));
  s.quantidade = Number($("#fQuant").value) || 0;
  s.unidade = $("#fUnidade").value.trim();
  s.responsavel = $("#fResp").value.trim();
  s.equipe = $("#fEquipe").value.split(",").map(function(p){ return p.trim(); }).filter(Boolean);
  s.descricao = $("#fDescricao").value.trim();

  if(s.status === "concluido" && !s.fimReal) s.fimReal = s.fimPrev || hojeISO();
  if(s.status !== "concluido") s.fimReal = fimReal;

  const locais = idsSelecionados();

  try{
    await salvar("servicos", s);
  } catch(e){ aviso(explicarErro(e)); return; }
  if(!existente) estado.servicos.push(s);

  /* a localização vai numa tabela à parte, depois do serviço existir */
  let falhaLocal = null;
  if(estado.locAtivo){
    try { await definirLigacoes(s.id, locais); }
    catch(e){ falhaLocal = e; console.error(e); }
  }
  fecharModal();
  pintarTudo();
  if(falhaLocal){
    aviso("O serviço foi gravado, mas a localização não: " + explicarErro(falhaLocal) + " Abra o serviço e tente de novo.", "erro");
    return;
  }
  aviso(existente ? "Serviço atualizado" : "Serviço " + s.codigo + " cadastrado");
  if(voltarParaTriagem){ voltarParaTriagem = false; abrirTriagem(); }
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
