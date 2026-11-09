import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { pintarTudo } from "./navegacao.js";
import { ler, salvar, sb } from "./supabase.js";
import { $, aviso, esc } from "./ui.js";

/* ------------------------------------------------------------
   EFETIVO — cadastro dos colaboradores da obra, por nome
   Tabela colaboradores (migracoes/003). A categoria decide como a
   pessoa entra na RUP: oficial e ajudante contam; indireto
   (encarregado, mestre, apontador) não conta.
   ------------------------------------------------------------ */
const FUNCOES = ["Pedreiro","Servente","Carpinteiro","Armador","Ajudante","Eletricista","Encanador",
  "Pintor","Gesseiro","Azulejista","Impermeabilizador","Soldador","Operador","Montador","Encarregado","Mestre de obras"];

/* categoria provável pela função; pode ser trocada na tela */
export function categoriaPelaFuncao(funcao){
  const f = String(funcao || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if(/encarregad|mestre|apontador|almoxarif|tecnic|engenheir|estagi|vigia|porteiro/.test(f)) return "indireto";
  if(/servente|ajudante|auxiliar|meio.?oficial/.test(f)) return "ajudante";
  return "oficial";
}
const ROTULO = { oficial:"Oficial", ajudante:"Ajudante", indireto:"Indireto (não entra na RUP)" };

function falha(r){ if(r.error) throw r.error; return r.data; }

/* Lê efetivo, programação e jornada. Sem a migração 003, desliga
   a aba Semana e o cadastro, e o resto segue normal. */
export async function carregarEfetivo(){
  estado.progAtivo = false; estado.progErro = "";
  estado.colaboradores = []; estado.programacao = [];
  try{
    estado.colaboradores = falha(await sb.from("colaboradores").select("*").is("excluido_em", null).order("nome", {ascending:true})) || [];
    estado.programacao = falha(await sb.from("programacao").select("*").is("excluido_em", null).order("data", {ascending:true})) || [];
    estado.progAtivo = true;
  } catch(e){
    const t = String((e && e.message) || e);
    estado.progErro = /does not exist|schema cache|relation/i.test(t)
      ? "A programação semanal e o efetivo ainda não estão ligados: falta rodar o arquivo migracoes/003_efetivo_programacao.sql no Supabase."
      : "Não foi possível carregar o efetivo: " + t;
  }
  const cfg = await ler("config", "jornada_horas");
  if(cfg && Number(String(cfg.valor).replace(",", ".")) > 0) estado.jornada = Number(String(cfg.valor).replace(",", "."));
}

export function ativos(){ return estado.colaboradores.filter(function(c){ return c.ativo; }); }
export function colaborador(id){ return estado.colaboradores.find(function(c){ return c.id === id; }) || null; }

/* nomes já usados nos apontamentos que ainda não estão no cadastro */
function nomesSemCadastro(){
  const ja = new Set(estado.colaboradores.map(function(c){ return c.nome.trim().toLowerCase(); }));
  const out = new Map();
  estado.servicos.forEach(function(s){
    (s.apontamentos || []).forEach(function(a){
      (a.colaboradores || []).forEach(function(n){
        const k = String(n).trim().toLowerCase();
        if(k && !ja.has(k) && !out.has(k)) out.set(k, String(n).trim());
      });
    });
  });
  return Array.from(out.values()).sort(function(a,b){ return a.localeCompare(b, "pt-BR"); });
}

let busca = "";

export function abrirEfetivo(){
  if(!estado.progAtivo){ aviso(estado.progErro, "erro"); return; }
  const empresas = Array.from(new Set(estado.colaboradores.map(function(c){ return c.empresa; }).filter(Boolean))).sort();
  const sem = nomesSemCadastro();
  const lista = estado.colaboradores.filter(function(c){
    return !busca || (c.nome + " " + c.funcao + " " + c.empresa).toLowerCase().indexOf(busca.toLowerCase()) !== -1;
  });
  const qtd = function(cat){ return ativos().filter(function(c){ return c.categoria === cat; }).length; };

  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Efetivo da obra">' +
      '<div class="modal__cab"><h2>Efetivo da obra</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo">' +
        '<p class="dica" style="margin-top:0">Ativos: <strong>' + ativos().length + '</strong> — ' + qtd("oficial") + ' oficiais, ' +
          qtd("ajudante") + ' ajudantes, ' + qtd("indireto") + ' indiretos.</p>' +
        '<fieldset class="grupo"><legend>Jornada para a RUP</legend><div class="locais__novo">' +
          '<label for="efJornada">Horas trabalhadas por pessoa por dia</label>' +
          '<input type="number" id="efJornada" min="1" max="14" step="0.1" value="' + estado.jornada + '" style="width:90px">' +
          '<button class="btn btn--p" data-ef="jornada">Salvar</button>' +
          '<span class="dica">8,8 h = 44 h semanais em 5 dias. Hh do dia = pessoas x jornada.</span>' +
        '</div></fieldset>' +
        '<fieldset class="grupo"><legend>Adicionar colaborador</legend><div class="form-grade">' +
          '<div class="campo"><label for="efNome">Nome *</label><input type="text" id="efNome" autocomplete="off"></div>' +
          '<div class="campo"><label for="efFuncao">Função</label><input type="text" id="efFuncao" list="efFuncoes">' +
            '<datalist id="efFuncoes">' + FUNCOES.map(function(f){ return '<option value="' + f + '">'; }).join("") + '</datalist></div>' +
          '<div class="campo"><label for="efEmpresa">Empresa</label><input type="text" id="efEmpresa" list="efEmpresas">' +
            '<datalist id="efEmpresas">' + empresas.map(function(e){ return '<option value="' + esc(e) + '">'; }).join("") + '</datalist></div>' +
          '<div class="campo"><label for="efCategoria">Categoria na RUP</label><select id="efCategoria">' +
            Object.keys(ROTULO).map(function(k){ return '<option value="' + k + '">' + ROTULO[k] + '</option>'; }).join("") + '</select></div>' +
        '</div><p style="margin:8px 0 0"><button class="btn btn--marca" data-ef="adicionar">Adicionar</button></p>' +
        (sem.length ? '<p class="dica" style="margin:10px 0 4px">Nomes usados nos apontamentos e ainda fora do cadastro (clique para preencher):</p><div class="chips-loc">' +
          sem.map(function(n){ return '<button type="button" class="chip-loc" data-ef="usar-nome" data-nome="' + esc(n) + '">' + esc(n) + '</button>'; }).join("") + '</div>' : '') +
        '<details style="margin-top:10px"><summary>Adicionar vários de uma vez</summary>' +
          '<p class="dica">Uma pessoa por linha: <code>Nome; Função; Empresa</code></p>' +
          '<textarea id="efVarios" rows="5" style="width:100%" placeholder="José da Silva; Pedreiro; Construtora X&#10;Maria Souza; Servente; Construtora X"></textarea>' +
          '<p style="margin:6px 0 0"><button class="btn btn--p" data-ef="varios">Adicionar todos</button></p>' +
        '</details>' +
        '</fieldset>' +
        '<div class="locais__novo"><input type="text" id="efBusca" placeholder="Buscar no efetivo" value="' + esc(busca) + '" style="flex:1"></div>' +
        '<div class="painel-tabela"><table class="tabela"><thead><tr><th>Nome</th><th>Função</th><th class="esconde-mob">Empresa</th><th>Categoria</th><th>Ativo</th><th></th></tr></thead><tbody>' +
        (lista.length ? lista.map(function(c){
          return '<tr' + (c.ativo ? '' : ' style="opacity:.55"') + '>' +
            '<td class="tit">' + esc(c.nome) + '</td><td>' + esc(c.funcao || "—") + '</td><td class="esconde-mob sub">' + esc(c.empresa || "—") + '</td>' +
            '<td><select data-ef-cat="' + c.id + '" aria-label="Categoria de ' + esc(c.nome) + '">' +
              Object.keys(ROTULO).map(function(k){ return '<option value="' + k + '"' + (k === c.categoria ? " selected" : "") + '>' + ROTULO[k].replace(" (não entra na RUP)", "") + '</option>'; }).join("") +
            '</select></td>' +
            '<td><input type="checkbox" data-ef-ativo="' + c.id + '"' + (c.ativo ? " checked" : "") + ' aria-label="Ativo"></td>' +
            '<td><button class="btn btn--p btn--fantasma btn--perigo" data-ef="remover" data-id="' + c.id + '">Remover</button></td></tr>';
        }).join("") : '<tr><td colspan="6" class="sub">Nenhum colaborador cadastrado.</td></tr>') +
        '</tbody></table></div>' +
      '</div>' +
    '</div>' +
  '</div>';
  setTimeout(function(){ const n = $("#efNome"); if(n && !busca) n.focus(); }, 40);
}

async function inserir(linhas){
  const ja = new Set(estado.colaboradores.map(function(c){ return c.nome.trim().toLowerCase(); }));
  const novas = linhas.filter(function(l){ return l.nome && !ja.has(l.nome.trim().toLowerCase()); });
  if(!novas.length) return 0;
  const r = falha(await sb.from("colaboradores").insert(novas.map(function(l){
    return { nome:l.nome.trim(), funcao:(l.funcao || "").trim(), empresa:(l.empresa || "").trim(),
             categoria: l.categoria || categoriaPelaFuncao(l.funcao) };
  })).select());
  estado.colaboradores = estado.colaboradores.concat(r || [])
    .sort(function(a,b){ return a.nome.localeCompare(b.nome, "pt-BR"); });
  return (r || []).length;
}

export async function acaoEfetivo(acao, el){
  try{
    if(acao === "jornada"){
      const h = Number(String($("#efJornada").value).replace(",", "."));
      if(!(h >= 1 && h <= 14)){ aviso("Informe a jornada entre 1 e 14 horas."); return; }
      await salvar("config", { chave:"jornada_horas", valor:String(h) });
      estado.jornada = h;
      aviso("Jornada de " + String(h).replace(".", ",") + " h salva");
    }
    if(acao === "usar-nome"){ $("#efNome").value = el.getAttribute("data-nome"); $("#efFuncao").focus(); return; }
    if(acao === "adicionar"){
      const nome = $("#efNome").value.trim();
      if(!nome){ aviso("Informe o nome."); $("#efNome").focus(); return; }
      const n = await inserir([{ nome:nome, funcao:$("#efFuncao").value, empresa:$("#efEmpresa").value, categoria:$("#efCategoria").value }]);
      aviso(n ? nome + " adicionado ao efetivo" : nome + " já está no cadastro");
    }
    if(acao === "varios"){
      const linhas = $("#efVarios").value.split(/\r?\n/).map(function(l){
        const p = l.split(/[;\t]/).map(function(x){ return x.trim(); });
        return { nome:p[0], funcao:p[1] || "", empresa:p[2] || "" };
      }).filter(function(l){ return l.nome; });
      const n = await inserir(linhas);
      aviso(n + " colaborador(es) adicionado(s)" + (linhas.length > n ? " (" + (linhas.length - n) + " já estavam no cadastro)" : ""));
    }
    if(acao === "remover"){
      const id = el.getAttribute("data-id");
      const c = estado.colaboradores.find(function(x){ return x.id === id; });
      if(!confirm('Remover "' + c.nome + '" do efetivo? Os apontamentos antigos continuam com o nome dele.')) return;
      falha(await sb.from("colaboradores").update({ excluido_em:new Date().toISOString() }).eq("id", id));
      estado.colaboradores = estado.colaboradores.filter(function(x){ return x.id !== id; });
    }
  } catch(e){ mostrarErro(e); }
  abrirEfetivo();
  pintarTudo();
}

/* troca de categoria e de ativo direto na tabela */
export async function mudarEfetivo(el){
  const id = el.getAttribute("data-ef-cat") || el.getAttribute("data-ef-ativo");
  const c = estado.colaboradores.find(function(x){ return x.id === id; });
  const campos = el.hasAttribute("data-ef-cat") ? { categoria:el.value } : { ativo:el.checked };
  try{
    falha(await sb.from("colaboradores").update(campos).eq("id", id));
    Object.assign(c, campos);
  } catch(e){ mostrarErro(e); }
  abrirEfetivo();
  pintarTudo();
}

export function buscarEfetivo(texto){
  busca = texto;
  abrirEfetivo();
  const b = $("#efBusca"); if(b){ b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
}


