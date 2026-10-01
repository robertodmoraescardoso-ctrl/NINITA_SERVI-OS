import { diasCorridos, diasUteis, difDias, fmt, fmtLongo, hojeISO } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { pintarTudo } from "./navegacao.js";
import { num, quantPrevista } from "./servicos.js";
import { salvar } from "./supabase.js";
import { $, aviso, esc } from "./ui.js";

/* ------------------------------------------------------------
   ABA PLANEJAMENTO
   Só o que ainda não começou. É aqui que a tarefa futura nasce.
   ------------------------------------------------------------ */
export function tarefasPlanejadas(){
  const termo = ($("#buscaPlano") ? $("#buscaPlano").value : "").trim().toLowerCase();
  const disc = $("#filtroDiscPlano") ? $("#filtroDiscPlano").value : "";
  return estado.servicos
    .filter(function(s){ return s.status === "planejado"; })
    .filter(function(s){ return !disc || s.disciplina === disc; })
    .filter(function(s){
      if(!termo) return true;
      return [s.titulo,s.codigo,s.local,s.disciplina,s.responsavel,s.descricao]
        .join(" ").toLowerCase().indexOf(termo) !== -1;
    })
    .sort(function(a,b){ return (a.inicio||"9999").localeCompare(b.inicio||"9999"); });
}

/* tarefa planejada cuja data de início já passou */
export function deveriaTerComecado(s){
  return s.status === "planejado" && s.inicio && difDias(s.inicio, hojeISO()) > 0;
}
export function comecaEmAte(s, dias){
  if(!s.inicio) return false;
  const d = difDias(hojeISO(), s.inicio);
  return d !== null && d >= 0 && d <= dias;
}

export function pintarIndicadoresPlano(){
  const lista = estado.servicos.filter(function(s){ return s.status === "planejado"; });
  const atrasadas = lista.filter(deveriaTerComecado).length;
  const semana = lista.filter(function(s){ return comecaEmAte(s, 7); }).length;
  const semData = lista.filter(function(s){ return !s.fimPrev; }).length;

  $("#indPlano").innerHTML =
    '<div class="ind"><span class="ind__n">' + lista.length + '</span><span class="ind__r">Tarefas planejadas</span></div>' +
    '<div class="ind ind--andamento"><span class="ind__n">' + semana + '</span><span class="ind__r">Começam em 7 dias</span></div>' +
    '<div class="ind ind--atrasado"><span class="ind__n">' + atrasadas + '</span><span class="ind__r">Deveriam ter começado</span></div>' +
    '<div class="ind"><span class="ind__n">' + semData + '</span><span class="ind__r">Sem término previsto</span></div>';
}

export function atualizarFiltroDisc(){
  const sel = $("#filtroDiscPlano");
  if(!sel) return;
  const atual = sel.value;
  const nomes = Array.from(new Set(estado.servicos
    .filter(function(s){ return s.status === "planejado"; })
    .map(function(s){ return s.disciplina; }).filter(Boolean)))
    .sort(function(a,b){ return a.localeCompare(b,"pt-BR"); });
  sel.innerHTML = '<option value="">Todas as disciplinas</option>' +
    nomes.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join("");
  sel.value = nomes.indexOf(atual) !== -1 ? atual : "";
}

export function pintarPlanejamento(){
  pintarIndicadoresPlano();
  atualizarFiltroDisc();
  const lista = tarefasPlanejadas();
  const alvo = $("#tabelaPlano");

  if(!lista.length){
    alvo.innerHTML = '<div class="painel-tabela"><div class="vazio">' +
      '<h3>Nenhuma tarefa planejada</h3>' +
      '<p>Cadastre aqui o que ainda vai começar. Quando a frente for liberada no canteiro, ' +
      'clique em Iniciar e ela passa para o painel de acompanhamento.</p>' +
      '<button class="btn btn--marca" data-acao="nova-tarefa">+ Nova tarefa planejada</button>' +
      '</div></div>';
    return;
  }

  alvo.innerHTML =
  '<div class="painel-tabela">' +
    '<div class="painel-tabela__cab">' +
      '<span class="rotulo">Tarefas futuras</span>' +
      '<span class="dica">' + lista.length + ' tarefa(s), em ordem de início</span>' +
    '</div>' +
    '<table class="tabela">' +
      '<thead><tr>' +
        '<th>Tarefa</th>' +
        '<th class="esconde-mob">Local</th>' +
        '<th>Início</th>' +
        '<th class="esconde-mob">Término</th>' +
        '<th style="text-align:right" class="esconde-mob">Prazo</th>' +
        '<th style="text-align:right">Quantitativo</th>' +
        '<th class="esconde-mob">Responsável</th>' +
        '<th></th>' +
      '</tr></thead>' +
      '<tbody>' + lista.map(function(s){
        const atrasada = deveriaTerComecado(s);
        const dias = (s.inicio && s.fimPrev) ? diasCorridos(s.inicio, s.fimPrev) : null;
        const uteis = (s.inicio && s.fimPrev) ? diasUteis(s.inicio, s.fimPrev) : null;
        const faltam = s.inicio ? difDias(hojeISO(), s.inicio) : null;

        return '<tr' + (atrasada ? ' class="linha-vencida"' : '') + '>' +
          '<td>' +
            '<span class="cod">' + esc(s.codigo) + (s.disciplina ? " · " + esc(s.disciplina) : "") + '</span>' +
            '<div class="tit">' + esc(s.titulo) + '</div>' +
            (atrasada ? '<span class="aviso-linha">deveria ter começado há ' + difDias(s.inicio, hojeISO()) + ' dia(s)</span>' : '') +
          '</td>' +
          '<td class="sub esconde-mob">' + esc(s.local || "—") + '</td>' +
          '<td class="num">' + fmt(s.inicio) +
            (faltam !== null && faltam >= 0 ? '<div class="sub" style="text-align:right">em ' + faltam + 'd</div>' : '') +
          '</td>' +
          '<td class="num esconde-mob">' + fmt(s.fimPrev) + '</td>' +
          '<td class="num esconde-mob">' + (dias === null ? "—" : dias + "d" +
            (uteis !== null ? '<div class="sub" style="text-align:right">' + uteis + ' úteis</div>' : "")) + '</td>' +
          '<td class="num">' + (quantPrevista(s) ? num(quantPrevista(s)) + " " + esc(s.unidade || "") : "—") + '</td>' +
          '<td class="sub esconde-mob">' + esc(s.responsavel || "—") + '</td>' +
          '<td><div class="acoes">' +
            '<button class="btn btn--p btn--marca" data-acao="iniciar" data-id="' + s.id + '">Iniciar</button>' +
            '<button class="btn btn--p btn--fantasma" data-acao="editar" data-id="' + s.id + '">Editar</button>' +
          '</div></td>' +
        '</tr>';
      }).join("") + '</tbody>' +
    '</table>' +
  '</div>';
}

export async function iniciarTarefa(idServico){
  const s = estado.servicos.find(function(x){ return x.id === idServico; });
  if(!s) return;
  const hoje = hojeISO();
  let inicio = s.inicio;
  if(inicio !== hoje && confirm('Iniciar "' + s.titulo + '" hoje?\n\nOK ajusta a data de início para ' + fmtLongo(hoje) +
     '.\nCancelar mantém ' + fmtLongo(s.inicio) + ' e apenas muda o status.')){
    inicio = hoje;
  }
  const antes = {status:s.status, inicio:s.inicio};
  s.status = "andamento";
  s.inicio = inicio;
  try{ await salvar("servicos", s); }
  catch(e){ s.status = antes.status; s.inicio = antes.inicio; aviso(explicarErro(e)); return; }
  pintarTudo();
  aviso(s.codigo + " passou para Em andamento");
}
