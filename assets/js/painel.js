import { diasCorridos, fmtLongo } from "./datas.js";
import { estado } from "./estado.js";
import { servicosFiltrados } from "./filtros.js";
import { pintarLinhaTempo } from "./gantt.js";
import { comDescendentes, filhos, frenteDe, frentes, nomeCurto, semLocalizacao, servicoEm } from "./localizacoes.js";
import { textoOnde } from "./inferencia.js";
import { avancoFisico, diasAtraso, duracao, estaAtrasado, fotosDo, num, pessoasDo, quantExecutada, quantPrevista, STATUS } from "./servicos.js";
import { $, esc } from "./ui.js";

/* ------------------------------------------------------------
   PAINEL — indicadores
   ------------------------------------------------------------ */
export function pintarIndicadores(){
  const t = estado.servicos;
  $("#kpiTotal").textContent     = t.length;
  $("#kpiAndamento").textContent = t.filter(function(s){ return s.status === "andamento"; }).length;
  $("#kpiPlanejado").textContent = t.filter(function(s){ return s.status === "planejado"; }).length;
  $("#kpiConcluido").textContent = t.filter(function(s){ return s.status === "concluido"; }).length;
  /* "em atraso" conta apenas o que ainda est\u00e1 aberto e j\u00e1 passou do previsto */
  $("#kpiAtrasado").textContent  = t.filter(function(s){
    return s.status !== "concluido" && estaAtrasado(s);
  }).length;
  $("#kpiFotos").textContent     = t.reduce(function(n,s){ return n + fotosDo(s).length; }, 0);
  $("#contaPainel").textContent  = t.length;
  $("#contaAcomp").textContent   = t.filter(function(s){ return s.status !== "concluido"; }).length;
  $("#contaPlano").textContent   = t.filter(function(s){ return s.status === "planejado"; }).length;
}

/* ------------------------------------------------------------
   FILTRO POR LOCALIZAÇÃO
   1º clique: a frente. 2º clique: o pavimento. O número em cada
   botão é a quantidade de serviços EM ABERTO (não concluídos).
   ------------------------------------------------------------ */
function chipFiltro(id, rotulo, n, ativo){
  return '<button type="button" class="chip-filtro" data-filtro-local="' + id + '" aria-pressed="' + ativo + '">' +
    esc(rotulo) + (n === null ? '' : ' <span class="chip-filtro__n">' + n + '</span>') + '</button>';
}

export function pintarFiltroLocal(){
  const alvo = $("#filtroLocal");
  if(!alvo) return;
  if(!estado.locAtivo){
    alvo.innerHTML = estado.locErro ? '<div class="aviso">' + esc(estado.locErro) + '</div>' : '';
    return;
  }
  const abertos = estado.servicos.filter(function(s){ return s.status !== "concluido"; });
  const conta = function(id){ return abertos.filter(function(s){ return servicoEm(s.id, id); }).length; };
  const sem = estado.servicos.filter(function(s){ return semLocalizacao(s.id); }).length;
  /* filtro que deixou de existir (tudo classificado, local desativado) volta para "Todas" */
  if((estado.filtros.local === "__sem" && !sem) ||
     (estado.filtros.local && estado.filtros.local !== "__sem" && !frenteDe(estado.filtros.local))){
    estado.filtros.local = "";
  }
  const f = estado.filtros.local;
  const frenteSel = f && f !== "__sem" ? frenteDe(f) : null;

  let h = '<div class="filtro-local__linha"><span class="filtro-local__rot">Frente</span>' +
    chipFiltro("", "Todas", null, !f) +
    frentes().map(function(fr){ return chipFiltro(fr.id, fr.nome, conta(fr.id), !!frenteSel && frenteSel.id === fr.id); }).join("") +
    (sem ? chipFiltro("__sem", "Sem localização", sem, f === "__sem") : "") +
  '</div>';

  if(frenteSel){
    const pavs = filhos(frenteSel.id);
    if(pavs.length){
      h += '<div class="filtro-local__linha"><span class="filtro-local__rot">Pavimento</span>' +
        chipFiltro(frenteSel.id, "Todos", null, f === frenteSel.id) +
        pavs.map(function(p){ return chipFiltro(p.id, nomeCurto(p.nome), conta(p.id), comDescendentes(p.id).has(f)); }).join("") +
      '</div>';
    }
  }
  if(f === "__sem"){
    h += '<div class="filtro-local__linha"><span class="dica">Serviços antigos sem frente/pavimento.</span>' +
      '<button type="button" class="btn btn--p btn--marca" data-acao="triagem">Classificar agora</button></div>';
  }
  alvo.innerHTML = h;
}

/* ------------------------------------------------------------
   RESUMO QUANTITATIVO
   Agrupa por disciplina e unidade. Nunca soma unidades
   diferentes: m² e m³ ficam em linhas de total separadas.
   ------------------------------------------------------------ */
export function pintarResumoQuant(){
  const alvo = $("#resumoQuant");
  const lista = servicosFiltrados().filter(function(s){ return quantPrevista(s) > 0; });

  if(!lista.length){
    alvo.innerHTML = "";
    return;
  }

  const grupos = new Map();
  lista.forEach(function(s){
    const disc = s.disciplina || "Sem disciplina";
    const un = s.unidade || "un";
    const chave = disc + "|" + un;
    if(!grupos.has(chave)) grupos.set(chave, {disc:disc, un:un, prev:0, exec:0, n:0});
    const g = grupos.get(chave);
    g.prev += quantPrevista(s);
    g.exec += quantExecutada(s);
    g.n += 1;
  });

  const linhas = Array.from(grupos.values()).sort(function(a,b){
    return a.disc.localeCompare(b.disc,"pt-BR") || a.un.localeCompare(b.un,"pt-BR");
  });

  const totais = new Map();
  linhas.forEach(function(g){
    if(!totais.has(g.un)) totais.set(g.un, {prev:0, exec:0});
    const t = totais.get(g.un);
    t.prev += g.prev; t.exec += g.exec;
  });

  function linhaPct(prev, exec){
    const pct = prev ? Math.min(100, Math.round((exec/prev)*100)) : 0;
    const classe = pct >= 100 ? "" : " parcial";
    return '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">' +
             '<span class="barra-mini' + classe + '"><i style="width:' + pct + '%"></i></span>' +
             '<span style="font-family:var(--mono);min-width:38px;text-align:right">' + pct + '%</span>' +
           '</div>';
  }

  alvo.innerHTML =
  '<div class="painel-tabela">' +
    '<div class="painel-tabela__cab">' +
      '<span class="rotulo">Resumo quantitativo</span>' +
      '<span class="dica">previsto em cadastro, executado somado dos apontamentos</span>' +
    '</div>' +
    '<table class="tabela">' +
      '<thead><tr>' +
        '<th>Disciplina</th><th class="esconde-mob">Serviços</th><th>Unid.</th>' +
        '<th style="text-align:right">Previsto</th>' +
        '<th style="text-align:right">Executado</th>' +
        '<th style="text-align:right" class="esconde-mob">Saldo</th>' +
        '<th style="text-align:right">Avanço físico</th>' +
      '</tr></thead>' +
      '<tbody>' +
        linhas.map(function(g){
          return '<tr>' +
            '<td class="tit">' + esc(g.disc) + '</td>' +
            '<td class="num esconde-mob">' + g.n + '</td>' +
            '<td class="cod">' + esc(g.un) + '</td>' +
            '<td class="num">' + num(g.prev) + '</td>' +
            '<td class="num">' + num(g.exec) + '</td>' +
            '<td class="num esconde-mob">' + num(g.prev - g.exec) + '</td>' +
            '<td>' + linhaPct(g.prev, g.exec) + '</td>' +
          '</tr>';
        }).join("") +
      '</tbody>' +
      '<tfoot>' +
        Array.from(totais.entries()).map(function(par){
          const un = par[0], t = par[1];
          return '<tr>' +
            '<td colspan="2">Total em ' + esc(un) + '</td>' +
            '<td></td>' +
            '<td class="num">' + num(t.prev) + '</td>' +
            '<td class="num">' + num(t.exec) + '</td>' +
            '<td class="num esconde-mob">' + num(t.prev - t.exec) + '</td>' +
            '<td>' + linhaPct(t.prev, t.exec) + '</td>' +
          '</tr>';
        }).join("") +
      '</tfoot>' +
    '</table>' +
  '</div>';
}

/* ------------------------------------------------------------
   PAINEL — cartões
   ------------------------------------------------------------ */
/* Cartão simples: o que é, onde é, quando, quanto falta e se atrasou */
export function cartao(s){
  const dur = duracao(s);
  const atraso = diasAtraso(s);
  const st = STATUS[s.status] || STATUS.planejado;
  const concluido = s.status === "concluido";
  const fim = concluido && s.fimReal ? s.fimReal : s.fimPrev;
  const onde = textoOnde(s);
  const nFotos = fotosDo(s).length;
  const equipe = pessoasDo(s);
  const fisico = avancoFisico(s);

  const info = [
    nFotos ? nFotos + (nFotos === 1 ? " foto" : " fotos") : "",
    equipe.slice(0, 2).join(", ") + (equipe.length > 2 ? " +" + (equipe.length - 2) : "")
  ].filter(Boolean).join(" · ");

  return '' +
  '<article class="cartao cartao--' + s.status + (atraso > 0 && !concluido ? " cartao--atrasado" : "") + '" data-id="' + s.id + '">' +
    '<div class="cartao__cab">' +
      '<span class="cartao__cod">' + esc(s.codigo) + (s.disciplina ? " · " + esc(s.disciplina) : "") + '</span>' +
      '<span class="marca marca--' + s.status + '">' + st.rot + '</span>' +
    '</div>' +
    '<h3 class="cartao__titulo">' + esc(s.titulo) + '</h3>' +
    (onde ? '<div class="cartao__local">' + esc(onde) + '</div>'
          : (semLocalizacao(s.id) ? '<div class="cartao__local cartao__local--sem">Sem localização</div>' : '')) +

    '<div class="cartao__datas">' +
      'Início <b>' + fmtLongo(s.inicio) + '</b> · ' + (concluido ? "Término" : "Previsto") + ' <b>' + fmtLongo(fim) + '</b>' +
      (s.status === "planejado"
        /* ainda não começou: mostra o prazo previsto, não dias decorridos */
        ? (s.inicio && s.fimPrev ? ' · prazo de ' + diasCorridos(s.inicio, s.fimPrev) + ' dias' : '')
        : (dur === null ? '' : ' · ' + dur + (dur === 1 ? ' dia' : ' dias'))) +
    '</div>' +

    '<div class="cartao__avanco">' +
      '<div class="prog"><div class="prog__b" style="width:' + (s.avanco || 0) + '%"></div></div>' +
      '<span>' + (s.avanco || 0) + '%</span>' +
    '</div>' +
    (quantPrevista(s)
      ? '<div class="cartao__quant">' + num(quantExecutada(s)) + ' de ' + num(quantPrevista(s)) + ' ' + esc(s.unidade || "") +
          ' executados' + (fisico === null ? '' : ' (' + fisico + '% físico)') + '</div>'
      : '') +

    (atraso > 0
      ? '<div class="alerta-atraso">' +
          (concluido ? "Concluído " + atraso + " dia(s) após o previsto" : "Atrasado em " + atraso + " dia(s)") +
        '</div>'
      : '') +

    '<div class="cartao__pe">' +
      '<span class="cartao__info">' + esc(info) + '</span>' +
      '<div class="acoes">' +
        '<button class="btn btn--p" data-acao="acompanhar" data-id="' + s.id + '">Atualizar</button>' +
        '<button class="btn btn--p btn--fantasma" data-acao="editar" data-id="' + s.id + '">Editar</button>' +
      '</div>' +
    '</div>' +
  '</article>';
}

export function pintarQuadro(){
  const lista = servicosFiltrados();
  const alvo = $("#quadro");

  if(!estado.servicos.length){
    alvo.innerHTML =
      '<div class="vazio" style="grid-column:1/-1">' +
        '<h3>Nenhum serviço cadastrado</h3>' +
        '<p>Comece pela aba Planejamento, cadastrando o que ainda vai ser executado. ' +
        'Ao liberar a frente no canteiro, use o botão Iniciar e o serviço aparece aqui.</p>' +
        '<button class="btn btn--marca" data-acao="nova-tarefa">+ Nova tarefa planejada</button> ' +
        '<button class="btn" data-acao="exemplo">Carregar exemplo</button>' +
      '</div>';
    return;
  }
  if(!lista.length){
    alvo.innerHTML =
      '<div class="vazio" style="grid-column:1/-1">' +
        '<h3>Nada encontrado com esses filtros</h3>' +
        '<p>Ajuste a busca ou limpe os filtros para ver os serviços.</p>' +
        '<button class="btn" data-acao="limpar">Limpar filtros</button>' +
      '</div>';
    return;
  }
  alvo.innerHTML = lista.map(cartao).join("");
}

export function pintarPainel(){
  pintarIndicadores();
  pintarFiltroLocal();
  $("#filtroStatus").value = estado.filtros.status;
  atualizarFiltroResp();
  atualizarFiltroTitulo();
  pintarResumoQuant();
  if(estado.visao === "quadro"){
    $("#quadro").classList.remove("oculto");
    $("#linhaTempo").classList.add("oculto");
    pintarQuadro();
  } else {
    $("#quadro").classList.add("oculto");
    $("#linhaTempo").classList.remove("oculto");
    pintarLinhaTempo();
  }
}

export function atualizarFiltroResp(){
  const sel = $("#filtroResp");
  const atual = sel.value;
  const nomes = Array.from(new Set(
    estado.servicos.map(function(s){ return s.responsavel; }).filter(Boolean)
  )).sort(function(a,b){ return a.localeCompare(b,"pt-BR"); });
  sel.innerHTML = '<option value="">Todos os responsáveis</option>' +
    nomes.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join("");
  sel.value = nomes.indexOf(atual) !== -1 ? atual : "";
}

/* lista de serviços (títulos), para filtrar o mesmo tipo em pavimentos
   ou trechos diferentes — ex.: todo "Forma" ou toda "Armação" de uma vez */
export function atualizarFiltroTitulo(){
  const sel = $("#filtroTitulo");
  if(!sel) return;
  const atual = sel.value;
  const nomes = Array.from(new Set(
    estado.servicos.map(function(s){ return s.titulo; }).filter(Boolean)
  )).sort(function(a,b){ return a.localeCompare(b,"pt-BR"); });
  sel.innerHTML = '<option value="">Todos os serviços</option>' +
    nomes.map(function(n){ return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join("");
  sel.value = nomes.indexOf(atual) !== -1 ? atual : "";
}
