import { mostrarErro } from "./erros.js";
import { estado } from "./estado.js";
import { pintarTudo } from "./navegacao.js";
import { carregarScript, lerCSV, SHEETJS } from "./importacao.js";
import { normalizar } from "./inferencia.js";
import { jornadaSemana, textoJornada } from "./rup.js";
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

/* Categoria provável pela função; pode ser trocada na tela.
   Indireto: gestão, apoio administrativo e equipamentos de uso geral
   (grua, cremalheira, sinaleiro), que não produzem um serviço só.
   Ajudante: servente, auxiliar de ofício, operador de betoneira.
   Oficial: o resto (carpinteiro, armador, pedreiro, eletricista...). */
export function categoriaPelaFuncao(funcao){
  const f = String(funcao || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if(/encarregad|mestre|apontador|almoxarif|tecnic|engenh|estagi|aprendiz|vigia|porteiro|coordenador|gerente|supervisor|assistente|administrativ|seguranca|projetos|grua|cremalheira|elevador|sinaleiro|motorista/.test(f)) return "indireto";
  if(/servente|ajudante|auxiliar|meio.?oficial|betoneira/.test(f)) return "ajudante";
  return "oficial";
}

/* "JOSE DA SILVA" -> "José da Silva" não (sem acento inventado): "Jose da Silva" */
export function nomeProprio(t){
  const minusculas = ["da","de","do","das","dos","e"];
  return String(t || "").trim().toLowerCase().split(/\s+/).map(function(p, i){
    return i > 0 && minusculas.indexOf(p) !== -1 ? p : p.charAt(0).toUpperCase() + p.slice(1);
  }).join(" ");
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
  /* jornada por dia da semana, "dom;seg;ter;qua;qui;sex;sáb" (padrão 0;9;9;9;9;8;8) */
  const cfg = await ler("config", "jornada_semana");
  const v = cfg ? String(cfg.valor).split(";").map(function(x){ return Number(String(x).replace(",", ".")); }) : null;
  estado.jornadaSemana = v && v.length === 7 && v.every(function(x){ return x >= 0 && x <= 14; }) ? v : null;
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
        '<fieldset class="grupo"><legend>Importar planilha de efetivo</legend>' +
          '<p class="dica" style="margin-top:0">Planilha do RH (.xls, .xlsx ou .csv). Só entram as colunas <strong>Nome</strong> e <strong>Função</strong>; ' +
            'CPF, admissão e os demais dados são ignorados. Quem já está no cadastro não é duplicado.</p>' +
          '<label class="btn btn--marca" for="efArquivo">Escolher planilha</label>' +
          '<input type="file" id="efArquivo" accept=".xls,.xlsx,.csv,text/csv" hidden> ' +
          '<span class="dica" id="efArquivoNome">nenhum arquivo</span>' +
          '<div id="efPrevia"></div>' +
        '</fieldset>' +
        '<fieldset class="grupo"><legend>Jornada para a RUP (horas por pessoa)</legend><div class="locais__novo">' +
          ["Seg","Ter","Qua","Qui","Sex","Sáb"].map(function(d, i){
            return '<label class="dica" for="efJ' + (i+1) + '">' + d + '</label>' +
              '<input type="number" id="efJ' + (i+1) + '" min="0" max="14" step="0.5" value="' + jornadaSemana()[i+1] + '" style="width:64px">';
          }).join("") +
          '<button class="btn btn--p" data-ef="jornada">Salvar</button>' +
          '<span class="dica">Hh do dia = pessoas x jornada daquele dia. Sábado só conta se houver apontamento.</span>' +
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
  pintarPreviaEfetivo();
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
      const v = [0].concat([1,2,3,4,5,6].map(function(i){ return Number(String($("#efJ" + i).value).replace(",", ".")); }));
      if(!v.slice(1).every(function(h){ return h >= 0 && h <= 14; }) || !v.slice(1,6).every(function(h){ return h > 0; })){
        aviso("Informe de 1 a 14 horas de segunda a sexta (sábado pode ser 0).", "erro"); return;
      }
      await salvar("config", { chave:"jornada_semana", valor:v.join(";") });
      estado.jornadaSemana = v;
      aviso("Jornada salva: " + textoJornada());
    }
    if(acao === "importar-planilha"){ await gravarPlanilhaEfetivo(); return; }
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



/* ------------------------------------------------------------
   IMPORTAÇÃO DA PLANILHA DE EFETIVO (RH)
   Acha na planilha a linha de cabeçalho com "Nome" e "Função" e lê
   só essas duas colunas. CPF, admissão, empresa e demais colunas
   são ignorados e nunca saem do computador.
   ------------------------------------------------------------ */
let importEf = null;   // { arquivo, linhas:[{nome, funcao, categoria, situacao}], ausentes:[colaborador] }

function acharColunas(matriz){
  for(let i = 0; i < Math.min(20, matriz.length); i++){
    const cab = matriz[i].map(function(c){ return normalizar(c).trim(); });
    let nome = cab.findIndex(function(c){ return /^nome( do (funcionario|colaborador|empregado))?$/.test(c); });
    if(nome < 0) nome = cab.findIndex(function(c){ return /nome/.test(c) && !/empresa/.test(c); });
    const funcao = cab.findIndex(function(c){ return /^(funcao|cargo)/.test(c); });
    if(nome >= 0 && funcao >= 0) return { linha:i, nome:nome, funcao:funcao };
  }
  return null;
}

export async function receberPlanilhaEfetivo(arquivo){
  $("#efArquivoNome").textContent = arquivo.name;
  $("#efPrevia").innerHTML = '<p class="dica">Lendo a planilha...</p>';
  try{
    let matriz;
    if(/\.xlsx?$/i.test(arquivo.name)){
      await carregarScript(SHEETJS);
      const livro = window.XLSX.read(await arquivo.arrayBuffer(), { type:"array" });
      matriz = window.XLSX.utils.sheet_to_json(livro.Sheets[livro.SheetNames[0]], { header:1, raw:false, defval:"" });
    } else {
      matriz = lerCSV(await arquivo.text());
    }
    const col = acharColunas(matriz);
    if(!col){
      $("#efPrevia").innerHTML = '<p class="aviso">Não achei as colunas "Nome" e "Função" nas primeiras linhas da planilha.</p>';
      return;
    }
    const ja = new Map(estado.colaboradores.map(function(c){ return [c.nome.trim().toLowerCase(), c]; }));
    const pessoas = [];
    matriz.slice(col.linha + 1).forEach(function(cel){
      const bruto = String(cel[col.nome] || "").trim();
      if(!bruto || !/[a-zA-ZÀ-ú]{2,}/.test(bruto) || /^total/i.test(normalizar(bruto))) return;
      pessoas.push({ nome:nomeProprio(bruto), funcao:String(cel[col.funcao] || "").trim() });
    });
    /* homônimos (duas pessoas com o mesmo nome): cada um leva a função
       entre parênteses, para não virar uma pessoa só */
    const contagem = {};
    pessoas.forEach(function(p){ const k = p.nome.toLowerCase(); contagem[k] = (contagem[k] || 0) + 1; });
    pessoas.forEach(function(p){ if(contagem[p.nome.toLowerCase()] > 1 && p.funcao) p.nome += " (" + p.funcao + ")"; });

    const vistos = new Set();
    const linhas = [];
    pessoas.forEach(function(p){
      const nome = p.nome, funcao = p.funcao;
      const k = nome.toLowerCase();
      if(vistos.has(k)) return;
      vistos.add(k);
      const existente = ja.get(k);
      linhas.push({ nome:nome, funcao:funcao, categoria:categoriaPelaFuncao(funcao),
                    situacao: existente ? (existente.ativo ? "já cadastrado" : "cadastrado, inativo") : "novo",
                    existente: existente || null });
    });
    const ausentes = ativos().filter(function(c){ return !vistos.has(c.nome.trim().toLowerCase()); });
    importEf = { arquivo:arquivo.name, linhas:linhas, ausentes:ausentes };
    pintarPreviaEfetivo();
  } catch(e){
    console.error(e);
    $("#efPrevia").innerHTML = '<p class="aviso">Não foi possível ler a planilha: ' + esc(e.message || e) + '</p>';
  }
}

function pintarPreviaEfetivo(){
  const alvo = $("#efPrevia");
  if(!alvo || !importEf) return;
  $("#efArquivoNome").textContent = importEf.arquivo;
  const novos = importEf.linhas.filter(function(l){ return l.situacao === "novo"; });
  const reativar = importEf.linhas.filter(function(l){ return l.situacao === "cadastrado, inativo"; });
  const porCat = function(cat){ return novos.filter(function(l){ return l.categoria === cat; }).length; };
  alvo.innerHTML =
    '<p style="margin:10px 0 6px"><strong>' + importEf.linhas.length + '</strong> pessoa(s) na planilha: <strong>' + novos.length + ' nova(s)</strong>' +
      (novos.length ? ' (' + porCat("oficial") + ' oficiais, ' + porCat("ajudante") + ' ajudantes, ' + porCat("indireto") + ' indiretos)' : '') +
      (reativar.length ? ', ' + reativar.length + ' inativa(s) que voltam a ficar ativas' : '') +
      ', ' + (importEf.linhas.length - novos.length - reativar.length) + ' já cadastrada(s). Nada foi gravado ainda.</p>' +
    (importEf.ausentes.length ? '<label class="dica" style="display:block;margin-bottom:6px"><input type="checkbox" id="efDesativarAusentes"> ' +
      'Desativar ' + importEf.ausentes.length + ' pessoa(s) ativa(s) que não estão na planilha (' +
      esc(importEf.ausentes.slice(0, 6).map(function(c){ return c.nome; }).join(", ") + (importEf.ausentes.length > 6 ? "..." : "")) + ')</label>' : '') +
    '<div class="painel-tabela" style="max-height:320px;overflow:auto"><table class="tabela"><thead><tr><th>Nome</th><th>Função</th><th>Categoria</th><th>Situação</th></tr></thead><tbody>' +
    importEf.linhas.map(function(l){
      return '<tr' + (l.situacao === "novo" ? '' : ' style="opacity:.6"') + '><td class="tit">' + esc(l.nome) + '</td><td>' + esc(l.funcao || "—") + '</td>' +
        '<td>' + ROTULO[l.categoria].replace(" (não entra na RUP)", "") + '</td><td>' + esc(l.situacao) + '</td></tr>';
    }).join("") + '</tbody></table></div>' +
    '<p style="margin:8px 0 0"><button class="btn btn--marca" data-ef="importar-planilha"' + (novos.length || reativar.length || importEf.ausentes.length ? '' : ' disabled') + '>' +
      'Importar ' + novos.length + ' nova(s)' + (reativar.length ? ' e reativar ' + reativar.length : '') + '</button></p>';
}

async function gravarPlanilhaEfetivo(){
  if(!importEf) return;
  const novos = importEf.linhas.filter(function(l){ return l.situacao === "novo"; });
  const reativar = importEf.linhas.filter(function(l){ return l.situacao === "cadastrado, inativo"; });
  const desativar = $("#efDesativarAusentes") && $("#efDesativarAusentes").checked ? importEf.ausentes : [];
  if(!confirm("Importar " + novos.length + " pessoa(s)" + (reativar.length ? ", reativar " + reativar.length : "") +
    (desativar.length ? " e desativar " + desativar.length : "") + "?")) return;
  try{
    const n = await inserir(novos.map(function(l){ return { nome:l.nome, funcao:l.funcao, categoria:l.categoria }; }));
    if(reativar.length){
      const ids = reativar.map(function(l){ return l.existente.id; });
      falha(await sb.from("colaboradores").update({ ativo:true }).in("id", ids));
      reativar.forEach(function(l){ l.existente.ativo = true; });
    }
    if(desativar.length){
      const ids = desativar.map(function(c){ return c.id; });
      falha(await sb.from("colaboradores").update({ ativo:false }).in("id", ids));
      desativar.forEach(function(c){ c.ativo = false; });
    }
    importEf = null;
    aviso(n + " pessoa(s) importada(s)" + (reativar.length ? ", " + reativar.length + " reativada(s)" : "") +
      (desativar.length ? ", " + desativar.length + " desativada(s)" : ""));
  } catch(e){ mostrarErro(e); }
  abrirEfetivo();
  pintarTudo();
}
