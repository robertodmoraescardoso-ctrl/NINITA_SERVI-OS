import { fmt } from "./datas.js";
import { estado } from "./estado.js";
import { servicosFiltrados } from "./filtros.js";
import { srcFoto } from "./fotos.js";
import { pintarLinhaTempo } from "./gantt.js";
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
  pintarFaixaObra();
}

/* a faixa mostra o retrato do dia: período coberto e o que está aberto */
export function pintarFaixaObra(){
  const alvo = $("#faixaDados");
  if(!alvo) return;
  const t = estado.servicos;
  const abertos = t.filter(function(s){ return s.status !== "concluido"; }).length;
  const atrasados = t.filter(function(s){ return s.status !== "concluido" && estaAtrasado(s); }).length;

  const inicios = t.map(function(s){ return s.inicio; }).filter(Boolean).sort();
  const fins = t.map(function(s){ return s.fimReal || s.fimPrev; }).filter(Boolean).sort();
  const periodo = inicios.length
    ? fmt(inicios[0]) + " a " + (fins.length ? fmt(fins[fins.length - 1]) : "em aberto")
    : "sem serviços";

  const avanco = t.length
    ? Math.round(t.reduce(function(n,s){ return n + (s.avanco || 0); }, 0) / t.length)
    : 0;

  alvo.innerHTML =
    dado(periodo, "Período dos serviços") +
    dado(abertos + " de " + t.length, "Serviços em aberto") +
    dado(avanco + "%", "Avanço médio") +
    (atrasados ? dado(String(atrasados), "Em atraso") : "");
}
export function dado(valor, rotulo){
  return '<div class="faixa-obra__dado"><b>' + esc(valor) + '</b><span>' + rotulo + '</span></div>';
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
export function cartao(s){
  const fotos = fotosDo(s);
  const dur = duracao(s);
  const atraso = diasAtraso(s);
  const st = STATUS[s.status] || STATUS.planejado;
  const equipe = pessoasDo(s);

  let tira;
  if(fotos.length){
    const mostrar = fotos.slice(-3);
    tira = mostrar.map(function(f){
      return '<img src="' + srcFoto(f) + '" alt="Foto do serviço" data-foto="' + f + '" data-srv="' + s.id + '">';
    }).join("");
    if(fotos.length > 3) tira += '<div class="tira__mais">+' + (fotos.length - 3) + '</div>';
  } else {
    tira = '<div class="tira__vazia">sem fotos</div>';
  }

  let classeContador = "";
  if(s.status === "concluido") classeContador = " contador--fechado";
  else if(atraso > 0) classeContador = " contador--atrasado";

  const equipeHTML = equipe.length
    ? equipe.slice(0,3).map(function(p){ return '<span class="pessoa">' + esc(p) + '</span>'; }).join("") +
      (equipe.length > 3 ? '<span class="pessoa">+' + (equipe.length - 3) + '</span>' : "")
    : '<span class="pessoa pessoa--vazio">sem pessoas registradas</span>';

  const fimMostrado = s.status === "concluido" && s.fimReal ? s.fimReal : s.fimPrev;
  const fimPendente = !(s.status === "concluido" && s.fimReal) ;

  return '' +
  '<article class="cartao" data-id="' + s.id + '">' +
    '<div class="cartao__topo">' +
      '<span class="cartao__faixa" style="background:' + st.cor + '"></span>' +
      '<div class="cartao__tit">' +
        '<span class="cartao__cod">' + esc(s.codigo) + (s.disciplina ? " · " + esc(s.disciplina) : "") + '</span>' +
        '<h3>' + esc(s.titulo) + '</h3>' +
        (s.local ? '<div class="cartao__local">' + esc(s.local) + '</div>' : '') +
      '</div>' +
      '<span class="marca marca--' + s.status + '">' + st.rot + '</span>' +
    '</div>' +

    '<div class="tira">' + tira + '</div>' +
    '<div class="prog"><div class="prog__b" style="width:' + (s.avanco || 0) + '%"></div></div>' +

    '<div class="dados">' +
      '<div class="dados__c">' +
        '<span class="dados__r">Início</span>' +
        '<span class="dados__v">' + fmt(s.inicio) + '</span>' +
      '</div>' +
      '<div class="dados__c">' +
        '<span class="dados__r">' + (s.status === "concluido" ? "Término" : "Previsto") + '</span>' +
        '<span class="dados__v' + (fimPendente ? " pendente" : "") + '">' + fmt(fimMostrado) + '</span>' +
      '</div>' +
      '<div class="contador' + classeContador + '">' +
        '<span class="contador__n">' + (dur === null ? "—" : dur) + '</span>' +
        '<span class="contador__u">' + (s.status === "concluido" ? "dias" : "dias") + '</span>' +
      '</div>' +
    '</div>' +

    (quantPrevista(s)
      ? '<div class="quant-cartao">' +
          '<span>' + num(quantExecutada(s)) + ' / ' + num(quantPrevista(s)) + ' ' + esc(s.unidade || "") + '</span>' +
          '<span class="pct">' + (avancoFisico(s) === null ? "" : avancoFisico(s) + "% físico") + '</span>' +
        '</div>'
      : '') +

    (atraso > 0
      ? '<div class="alerta-atraso">' +
          (s.status === "concluido" ? "Concluído " + atraso + " dia(s) após o previsto" : "Atrasado em " + atraso + " dia(s)") +
        '</div>'
      : '') +

    '<div class="cartao__pe">' +
      '<div class="equipe">' + equipeHTML + '</div>' +
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
