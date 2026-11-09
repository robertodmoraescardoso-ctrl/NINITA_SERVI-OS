import { dataLocal, ehFeriado, fmtLongo, hojeISO, paraISO } from "./datas.js";
import { colaborador, ativos } from "./efetivo.js";
import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { textoOnde } from "./inferencia.js";
import { pintarTudo } from "./navegacao.js";
import { analise, comparar, diasRUP, fmtRUP, metaSugerida } from "./rup.js";
import { num, quantPrevista, STATUS } from "./servicos.js";
import { sb } from "./supabase.js";
import { $, $$, aviso, esc, fecharModal } from "./ui.js";

/* ------------------------------------------------------------
   PROGRAMAÇÃO SEMANAL
   Grade segunda a sexta: em cada dia, para cada serviço, quem
   trabalha e a meta de quantidade. Quando há apontamento no dia,
   a célula mostra o realizado contra a meta e a RUP do dia.
   Tabela programacao (migracoes/003).
   ------------------------------------------------------------ */
const NOMES_DIA = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

export function segundaDe(iso){
  const d = dataLocal(iso);
  const dw = d.getDay();
  d.setDate(d.getDate() - (dw === 0 ? 6 : dw - 1));
  return paraISO(d);
}
function somarDias(iso, n){ const d = dataLocal(iso); d.setDate(d.getDate() + n); return paraISO(d); }
export function diasDaSemana(seg){ return [0,1,2,3,4].map(function(i){ return somarDias(seg, i); }); }

export function progDe(servicoId, data){
  return estado.programacao.find(function(p){ return p.servico_id === servicoId && p.data === data; }) || null;
}
export function nomesDe(p){
  return (p ? p.colaboradores : []).map(function(id){ const c = colaborador(id); return c ? c.nome : null; }).filter(Boolean);
}
function primeiroNome(n){ return String(n).trim().split(/\s+/)[0]; }

/* realizado do serviço no dia, a partir dos apontamentos */
function realizado(s, data){
  const dias = diasRUP(s);
  const i = dias.findIndex(function(d){ return d.data === data; });
  if(i < 0){
    const qs = (s.apontamentos || []).filter(function(a){ return a.data === data; })
      .reduce(function(n,a){ return n + (Number(a.quantidade) || 0); }, 0);
    return qs ? { qs:qs, rupd:null, cmp:null } : null;
  }
  return { qs:dias[i].qs, rupd:dias[i].rupd, cmp:comparar(dias, i) };
}

function semanaAtual(){
  if(!estado.semanaInicio) estado.semanaInicio = segundaDe(hojeISO());
  return estado.semanaInicio;
}

export function contaSemana(){
  if(!estado.progAtivo) return 0;
  const dias = diasDaSemana(semanaAtual());
  return new Set(estado.programacao.filter(function(p){ return dias.indexOf(p.data) !== -1; })
    .map(function(p){ return p.servico_id; })).size;
}

function seta(cmp){
  if(!cmp) return "";
  const pct = Math.round(Math.abs(cmp.variacao) * 100);
  if(cmp.situacao === "melhor") return '<span class="rup-melhor" title="RUP menor que no dia anterior">&#9660; melhor ' + pct + '%</span>';
  if(cmp.situacao === "pior") return '<span class="rup-pior" title="RUP maior que no dia anterior">&#9650; pior ' + pct + '%</span>';
  return '<span class="dica">= igual</span>';
}

export function pintarSemana(){
  const alvo = $("#semanaConteudo");
  if(!alvo) return;
  if(!estado.progAtivo){
    alvo.innerHTML = '<div class="aviso">' + esc(estado.progErro || "Programação indisponível.") + '</div>';
    return;
  }
  const seg = semanaAtual();
  const dias = diasDaSemana(seg);
  const hoje = hojeISO();
  const progSemana = estado.programacao.filter(function(p){ return dias.indexOf(p.data) !== -1; });
  const ids = Array.from(new Set(progSemana.map(function(p){ return p.servico_id; })));
  const servicos = ids.map(function(id){ return estado.servicos.find(function(s){ return s.id === id; }); }).filter(Boolean)
    .sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||"", "pt-BR", {numeric:true}); });

  /* efetivo por dia e pessoas em dois serviços no mesmo dia */
  const rodape = dias.map(function(d){
    const doDia = progSemana.filter(function(p){ return p.data === d; });
    const cont = new Map();
    doDia.forEach(function(p){ p.colaboradores.forEach(function(c){ cont.set(c, (cont.get(c) || 0) + 1); }); });
    const conflitos = Array.from(cont.entries()).filter(function(e){ return e[1] > 1; })
      .map(function(e){ const c = colaborador(e[0]); return c ? c.nome : "?"; });
    return { pessoas:cont.size, conflitos:conflitos };
  });

  const emAndamentoSemProg = estado.servicos.filter(function(s){
    return s.status === "andamento" && ids.indexOf(s.id) === -1;
  });

  alvo.innerHTML =
    '<div class="barra semana-barra">' +
      '<div class="semana-nav"><button class="btn btn--p" data-sem="anterior" aria-label="Semana anterior">&larr;</button>' +
      '<strong class="semana-titulo">' + fmtLongo(dias[0]).slice(0,5) + ' a ' + fmtLongo(dias[4]) + '</strong>' +
      '<button class="btn btn--p" data-sem="proxima" aria-label="Próxima semana">&rarr;</button></div>' +
      (seg !== segundaDe(hoje) ? '<button class="btn btn--p" data-sem="hoje">Esta semana</button>' : '') +
      '<span style="flex:1"></span>' +
      '<button class="btn btn--marca" data-sem="programar">+ Programar serviço</button>' +
      '<button class="btn" data-sem="copiar">Copiar semana anterior</button>' +
    '</div>' +
    (!ativos().length ? '<div class="aviso">Cadastre o efetivo (botão Efetivo, no topo) para escolher as pessoas de cada dia.</div>' : '') +
    (servicos.length ?
    '<div class="painel-tabela semana-grade"><table class="tabela">' +
      '<thead><tr><th class="semana-col-servico">Serviço</th>' +
        dias.map(function(d){
          const dt = dataLocal(d);
          return '<th class="' + (d === hoje ? "semana-hoje" : "") + '">' + NOMES_DIA[dt.getDay()] + ' ' +
            String(dt.getDate()).padStart(2,"0") + '/' + String(dt.getMonth()+1).padStart(2,"0") + (ehFeriado(d) ? ' <span class="dica">feriado</span>' : '') + '</th>';
        }).join("") +
      '</tr></thead><tbody>' +
      servicos.map(function(s){
        const a = analise(s);
        const proj = a.projPotencial || a.projAtual;
        return '<tr><td class="semana-col-servico">' +
            '<span class="cod">' + esc(s.codigo) + '</span><div class="tit">' + esc(s.titulo) + '</div>' +
            '<div class="sub">' + esc(textoOnde(s) || "") + '</div>' +
            (quantPrevista(s) ? '<div class="sub">Faltam ' + num(a.saldo) + ' ' + esc(s.unidade || "") + ' de ' + num(quantPrevista(s)) + '</div>' : '') +
            (a.potencial ? '<div class="sub">RUP potencial ' + fmtRUP(a.potencial, s.unidade) + '</div>' : '') +
            (proj ? '<div class="sub">Término projetado ' + fmtLongo(proj.fim) +
              (proj.folga !== null ? (proj.folga > 0 ? ' <span class="rup-pior">(' + proj.folga + ' d.u. depois do previsto)</span>'
                : proj.folga < 0 ? ' <span class="rup-melhor">(' + (-proj.folga) + ' d.u. antes)</span>' : ' (no previsto)') : '') + '</div>' : '') +
          '</td>' +
          dias.map(function(d){
            const p = progDe(s.id, d);
            const r = realizado(s, d);
            if(!p && ehFeriado(d)) return '<td class="semana-cel semana-cel--feriado">Feriado</td>';
            if(!p) return '<td class="semana-cel"><button class="semana-mais" data-sem="celula" data-srv="' + s.id + '" data-dia="' + d + '" aria-label="Programar ' + esc(s.codigo) + ' em ' + fmtLongo(d) + '">+</button>' +
              (r ? '<div class="sub">real ' + num(r.qs) + ' ' + esc(s.unidade || "") + '</div>' : '') + '</td>';
            const nomes = nomesDe(p);
            const meta = Number(p.meta_quantidade) || 0;
            const pct = meta && r ? Math.round(r.qs / meta * 100) : null;
            return '<td class="semana-cel semana-cel--prog' + (d === hoje ? " semana-hoje" : "") + '">' +
              '<button class="semana-celbtn" data-sem="celula" data-srv="' + s.id + '" data-dia="' + d + '">' +
                '<strong>' + nomes.length + ' pessoa(s)</strong>' +
                '<span class="sub">' + esc(nomes.slice(0,3).map(primeiroNome).join(", ") + (nomes.length > 3 ? " +" + (nomes.length - 3) : "")) + '</span>' +
                (meta ? '<span>meta ' + num(meta) + ' ' + esc(s.unidade || "") + '</span>' : '') +
                (r ? '<span class="' + (pct === null ? "" : pct >= 100 ? "rup-melhor" : "rup-pior") + '">real ' + num(r.qs) +
                  (pct === null ? '' : ' (' + pct + '%)') + '</span>' : (d < hoje ? '<span class="dica">sem apontamento</span>' : '')) +
                (r && r.rupd ? '<span class="sub">' + fmtRUP(r.rupd, s.unidade) + '</span>' + seta(r.cmp) : '') +
              '</button></td>';
          }).join("") + '</tr>';
      }).join("") +
      '</tbody><tfoot><tr><td>Efetivo programado</td>' +
        rodape.map(function(r){
          return '<td>' + r.pessoas + ' pessoa(s)' +
            (r.conflitos.length ? '<div class="rup-pior">Em 2 serviços: ' + esc(r.conflitos.join(", ")) + '</div>' : '') + '</td>';
        }).join("") +
      '</tr></tfoot></table></div>'
    : '<div class="painel-tabela"><div class="vazio"><h3>Nada programado nesta semana</h3>' +
        '<p>Use "+ Programar serviço" ou "Copiar semana anterior".</p></div></div>') +
    (emAndamentoSemProg.length ? '<p class="dica">Em andamento e sem programação nesta semana: ' +
      emAndamentoSemProg.map(function(s){ return '<button class="chip-loc" data-sem="programar" data-srv="' + s.id + '">' + esc(s.codigo + " " + s.titulo) + '</button>'; }).join(" ") + '</p>' : '');
}

/* ---------- editor: um serviço, um ou vários dias ---------- */
let editor = null;

export function abrirProgramacao(servicoId, data){
  const seg = semanaAtual();
  const dias = diasDaSemana(seg).filter(function(d){ return !ehFeriado(d); });
  const s = servicoId ? estado.servicos.find(function(x){ return x.id === servicoId; }) : null;
  const p = s && data ? progDe(s.id, data) : null;
  editor = { servicoId: s ? s.id : "", data: data || "", sel: new Set(p ? p.colaboradores : []), busca:"" };
  const candidatos = estado.servicos.filter(function(x){ return x.status !== "concluido"; })
    .sort(function(a,b){ return (a.codigo||"").localeCompare(b.codigo||"", "pt-BR", {numeric:true}); });

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Programar serviço">' +
      '<div class="modal__cab"><h2>' + (p ? "Programação de " + fmtLongo(data) : "Programar serviço") + '</h2>' +
        '<button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo" id="progCorpo">' +
        '<div class="form-grade">' +
          '<div class="campo campo--largo"><label for="progServico">Serviço</label><select id="progServico"' + (s ? " disabled" : "") + '>' +
            '<option value="">Escolha o serviço</option>' +
            candidatos.map(function(x){ return '<option value="' + x.id + '"' + (s && x.id === s.id ? " selected" : "") + '>' +
              esc(x.codigo + " · " + x.titulo + (textoOnde(x) ? " — " + textoOnde(x) : "") + " (" + STATUS[x.status].rot + ")") + '</option>'; }).join("") +
          '</select></div>' +
          '<div class="campo campo--largo"><label>Dias</label><div class="chips-loc">' +
            dias.map(function(d){
              const marcado = data ? d === data : true;
              return '<label class="chip-loc"><input type="checkbox" class="prog-dia" value="' + d + '"' + (marcado ? " checked" : "") + '> ' +
                NOMES_DIA[dataLocal(d).getDay()] + ' ' + fmtLongo(d).slice(0,5) + '</label>';
            }).join("") + '</div>' +
            (data ? '<span class="dica">Marque outros dias para repetir a mesma equipe e meta.</span>' : '') + '</div>' +
          '<div class="campo"><label for="progMeta">Meta de quantidade por dia</label><input type="number" id="progMeta" min="0" step="0.01" value="' + (p && p.meta_quantidade !== null ? p.meta_quantidade : "") + '"></div>' +
          '<div class="campo"><label>&nbsp;</label><button class="btn" data-sem="sugerir" type="button">Sugerir meta pela RUP potencial</button><span class="dica" id="progSugestao"></span></div>' +
          '<div class="campo campo--largo"><label for="progObs">Observação</label><input type="text" id="progObs" value="' + esc(p ? p.observacao : "") + '" placeholder="Frente, material a liberar, condição..."></div>' +
        '</div>' +
        '<fieldset class="grupo"><legend>Equipe (<span id="progQtd">0</span>)</legend>' +
          '<input type="text" id="progBusca" placeholder="Buscar nome ou função" style="width:100%;margin-bottom:8px">' +
          '<div id="progPessoas"></div>' +
        '</fieldset>' +
      '</div>' +
      '<div class="modal__pe">' +
        (p ? '<button class="btn btn--perigo" data-sem="remover" style="margin-right:auto">Tirar deste dia</button>' : '<span style="margin-right:auto"></span>') +
        '<button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn--marca" id="btnSalvarProg">Salvar programação</button>' +
      '</div>' +
    '</div>' +
  '</div>';
  pintarPessoas();
}

/* lista de pessoas agrupada por função, com quem já está ocupado no dia */
function pintarPessoas(){
  const termo = editor.busca.toLowerCase();
  const outroServico = new Map();   /* id -> código do serviço onde já está no dia */
  if(editor.data){
    estado.programacao.filter(function(p){ return p.data === editor.data && p.servico_id !== editor.servicoId; })
      .forEach(function(p){
        const s = estado.servicos.find(function(x){ return x.id === p.servico_id; });
        p.colaboradores.forEach(function(c){ outroServico.set(c, s ? s.codigo : "?"); });
      });
  }
  const grupos = new Map();
  ativos().filter(function(c){ return !termo || (c.nome + " " + c.funcao).toLowerCase().indexOf(termo) !== -1; })
    .forEach(function(c){
      const g = c.funcao || "Sem função";
      if(!grupos.has(g)) grupos.set(g, []);
      grupos.get(g).push(c);
    });
  $("#progPessoas").innerHTML = grupos.size ? Array.from(grupos.keys()).sort().map(function(g){
    return '<div class="seletor-loc__grupo"><span class="dica">' + esc(g) + '</span><div class="chips-loc">' +
      grupos.get(g).map(function(c){
        const ocup = outroServico.get(c.id);
        return '<button type="button" class="chip-loc" data-pessoa="' + c.id + '" aria-pressed="' + editor.sel.has(c.id) + '"' +
          (ocup ? ' title="Já programado em ' + esc(ocup) + ' neste dia"' : '') + '>' + esc(c.nome) +
          (c.categoria === "indireto" ? ' <span class="dica">(indireto)</span>' : '') +
          (ocup ? ' <span class="rup-pior">· ' + esc(ocup) + '</span>' : '') + '</button>';
      }).join("") + '</div></div>';
  }).join("") : '<p class="dica">Nenhum colaborador ativo' + (termo ? ' com esse nome' : '') + '. Cadastre no botão Efetivo.</p>';
  $("#progQtd").textContent = editor.sel.size;
}

export function alternarPessoa(id){
  editor.sel.has(id) ? editor.sel.delete(id) : editor.sel.add(id);
  pintarPessoas();
}
export function buscarPessoa(t){ editor.busca = t; pintarPessoas(); }

function servicoDoEditor(){
  const id = editor.servicoId || ($("#progServico") ? $("#progServico").value : "");
  return estado.servicos.find(function(x){ return x.id === id; }) || null;
}

export function sugerirMeta(){
  const s = servicoDoEditor();
  if(!s){ aviso("Escolha o serviço."); return; }
  const diretos = Array.from(editor.sel).filter(function(id){ const c = colaborador(id); return c && c.categoria !== "indireto"; }).length;
  if(!diretos){ aviso("Escolha a equipe primeiro."); return; }
  const m = metaSugerida(s, diretos);
  if(!m){ $("#progSugestao").textContent = "Ainda não há produção medida neste serviço (lance quantidade e efetivo nos apontamentos)."; return; }
  const a = analise(s);
  $("#progMeta").value = Math.round(m * 10) / 10;
  $("#progSugestao").textContent = diretos + " pessoa(s) x jornada / " + (a.potencial ? "RUP potencial " + fmtRUP(a.potencial, s.unidade) : "RUP cumulativa " + fmtRUP(a.cumulativa, s.unidade) + " (potencial a partir de 3 dias medidos)");
}

function falha(r){ if(r.error) throw r.error; return r.data; }

export async function salvarProgramacao(){
  const s = servicoDoEditor();
  if(!s){ aviso("Escolha o serviço."); return; }
  const dias = $$(".prog-dia").filter(function(c){ return c.checked; }).map(function(c){ return c.value; });
  if(!dias.length){ aviso("Marque ao menos um dia."); return; }
  const metaTxt = $("#progMeta").value.trim();
  const campos = {
    colaboradores: Array.from(editor.sel),
    meta_quantidade: metaTxt === "" ? null : Number(metaTxt),
    observacao: $("#progObs").value.trim(),
    atualizado_em: new Date().toISOString()
  };
  if(campos.meta_quantidade !== null && !(campos.meta_quantidade >= 0)){ aviso("Meta inválida."); return; }
  try{
    for(const d of dias){
      const ja = progDe(s.id, d);
      if(ja){
        falha(await sb.from("programacao").update(campos).eq("id", ja.id));
        Object.assign(ja, campos);
      } else {
        const r = falha(await sb.from("programacao").insert(Object.assign({ servico_id:s.id, data:d }, campos)).select());
        estado.programacao.push(r[0]);
      }
    }
  } catch(e){ mostrarErro(e); return; }
  fecharModal();
  pintarTudo();
  aviso(s.codigo + " programado em " + dias.length + " dia(s)");
}

export async function removerProgramacao(){
  const p = progDe(editor.servicoId, editor.data);
  if(!p || !confirm("Tirar este serviço da programação de " + fmtLongo(editor.data) + "?")) return;
  try{
    falha(await sb.from("programacao").update({ excluido_em:new Date().toISOString() }).eq("id", p.id));
    estado.programacao = estado.programacao.filter(function(x){ return x.id !== p.id; });
  } catch(e){ mostrarErro(e); return; }
  fecharModal();
  pintarTudo();
}

/* copia a semana anterior para a atual, dia da semana por dia da semana */
async function copiarAnterior(){
  const seg = semanaAtual();
  const anterior = diasDaSemana(somarDias(seg, -7));
  const atual = diasDaSemana(seg);
  const novos = [];
  estado.programacao.filter(function(p){ return anterior.indexOf(p.data) !== -1; }).forEach(function(p){
    const d = atual[anterior.indexOf(p.data)];
    const s = estado.servicos.find(function(x){ return x.id === p.servico_id; });
    if(!s || s.status === "concluido" || ehFeriado(d) || progDe(p.servico_id, d)) return;
    novos.push({ servico_id:p.servico_id, data:d, colaboradores:p.colaboradores, meta_quantidade:p.meta_quantidade, observacao:p.observacao });
  });
  if(!novos.length){ aviso("Nada para copiar: a semana anterior está vazia ou já foi copiada."); return; }
  if(!confirm("Copiar " + novos.length + " programação(ões) da semana anterior para esta?")) return;
  try{
    const r = falha(await sb.from("programacao").insert(novos).select());
    estado.programacao = estado.programacao.concat(r || []);
  } catch(e){ mostrarErro(e); return; }
  pintarTudo();
  aviso(novos.length + " programação(ões) copiada(s)");
}

export function acaoSemana(acao, el){
  const seg = semanaAtual();
  if(acao === "anterior"){ estado.semanaInicio = somarDias(seg, -7); pintarSemana(); }
  if(acao === "proxima"){ estado.semanaInicio = somarDias(seg, 7); pintarSemana(); }
  if(acao === "hoje"){ estado.semanaInicio = segundaDe(hojeISO()); pintarSemana(); }
  if(acao === "programar") abrirProgramacao(el.getAttribute("data-srv") || null, null);
  if(acao === "celula") abrirProgramacao(el.getAttribute("data-srv"), el.getAttribute("data-dia"));
  if(acao === "sugerir") sugerirMeta();
  if(acao === "remover") removerProgramacao();
  if(acao === "copiar") copiarAnterior();
}

