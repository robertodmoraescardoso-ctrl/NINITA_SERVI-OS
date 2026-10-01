import { diasUteis, fmtLongo, hojeISO, lerData, terminoPorDiasUteis } from "./datas.js";
import { explicarErro } from "./erros.js";
import { estado } from "./estado.js";
import { acharFrente, chavePavimento, normalizar, pavimentosNoTexto } from "./inferencia.js";
import { definirLigacoes, filhos, textoDeIds } from "./localizacoes.js";
import { pintarTudo } from "./navegacao.js";
import { codigoEmUso, novoServico, proximosCodigos } from "./servicos.js";
import { salvar } from "./supabase.js";
import { $, aviso, esc, fecharModal } from "./ui.js";
import { baixar, csv } from "./dados.js";

/* ------------------------------------------------------------
   IMPORTAÇÃO DE PLANILHA (CSV ou Excel .xlsx)
   1. Baixe o modelo, preencha no Excel.
   2. Envie o arquivo: cada linha é conferida e a tela mostra o que
      entra e o que tem erro.
   3. Só grava depois da confirmação, e só as linhas válidas.
   ------------------------------------------------------------ */

/* Leitor de Excel (SheetJS), carregado só quando alguém envia .xlsx.
   É a biblioteca de referência para ler .xlsx no navegador; vem da
   CDN oficial do fabricante, versão fixa. */
const SHEETJS = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";

const COLUNAS = ["Título","Frente","Pavimento","Detalhe do local","Disciplina","Início","Término previsto",
                 "Duração (dias úteis)","Quantidade","Unidade","Responsável","Código","Escopo"];

/* nomes de coluna aceitos (sem acento, minúsculas) */
const APELIDOS = {
  titulo:["titulo","servico","nome","tarefa","nome da tarefa"],
  frente:["frente","torre","bloco"],
  pavimento:["pavimento","pavimentos","andar","pav","nivel"],
  detalhe:["detalhe do local","detalhe","local","trecho"],
  disciplina:["disciplina","etapa"],
  inicio:["inicio","data de inicio","data inicio","comeco"],
  fim:["termino previsto","termino","fim","data de termino","conclusao prevista"],
  duracao:["duracao (dias uteis)","duracao","dias uteis","prazo"],
  quantidade:["quantidade","qtd","quant","quantidade prevista"],
  unidade:["unidade","un","und"],
  responsavel:["responsavel","encarregado","recurso"],
  codigo:["codigo","cod"],
  escopo:["escopo","descricao","observacao","observacoes"]
};

export function baixarModelo(){
  const linhas = [COLUNAS,
    ["Alvenaria","Torre A","1º pavimento","","Alvenaria","06/10/2026","","5","150","m²","","",""],
    ["Forma","Torre BC","2º teto","eixo 1 a 4","Estrutura","13/10/2026","20/10/2026","","320","m²","","",""],
    ["Contrapiso","Torre A","1º ao 4º pavimento","","Revestimento","03/11/2026","","10","","","","",""]];
  baixar("modelo-importacao-servicos.csv", csv(linhas));
}

let linhasLidas = [];   // resultado da validação do último arquivo

export function abrirImportacao(){
  linhasLidas = [];
  $("#modais").innerHTML =
  '<div class="cortina" id="cortina">' +
    '<div class="modal modal--largo" role="dialog" aria-modal="true" aria-label="Importar planilha">' +
      '<div class="modal__cab"><h2>Importar planilha</h2><button class="fechar" data-fechar aria-label="Fechar">&times;</button></div>' +
      '<div class="modal__corpo">' +
        '<ol class="passos">' +
          '<li><button class="btn btn--p" data-acao="modelo-planilha">Baixar o modelo (.csv)</button> e preencha no Excel. ' +
            'Pode salvar como .xlsx ou .csv.</li>' +
          '<li>Colunas obrigatórias: <strong>Título</strong> e <strong>Início</strong>. Término pode vir pronto ou pela Duração (dias úteis). ' +
            'Pavimento aceita "1º pavimento", "Térreo", "2º teto" ou "1º ao 4º pavimento". Os locais precisam existir na tela Locais.</li>' +
          '<li><label class="btn btn--marca" for="arquivoPlanilha">Escolher arquivo</label>' +
            '<input type="file" id="arquivoPlanilha" accept=".csv,.xlsx,.xls,text/csv" hidden> ' +
            '<span class="dica" id="nomeArquivo">nenhum arquivo</span></li>' +
        '</ol>' +
        '<div id="previaImportacao"></div>' +
      '</div>' +
      '<div class="modal__pe">' +
        '<button class="btn" data-fechar>Cancelar</button>' +
        '<button class="btn btn--marca" id="btnGravarImportacao" disabled>Gravar</button>' +
      '</div>' +
    '</div>' +
  '</div>';
}

/* ---------- leitura do arquivo ---------- */
function carregarScript(url){
  return new Promise(function(ok, falha){
    if(window.XLSX) return ok();
    const s = document.createElement("script");
    s.src = url; s.onload = ok;
    s.onerror = function(){ falha(new Error("Não foi possível carregar o leitor de Excel. Confira a internet ou salve a planilha como .csv.")); };
    document.head.appendChild(s);
  });
}

/* CSV com ; ou , e aspas, como o Excel salva */
export function lerCSV(texto){
  texto = texto.replace(/^﻿/, "");
  const primeira = texto.split(/\r?\n/)[0] || "";
  const sep = (primeira.match(/;/g) || []).length >= (primeira.match(/,/g) || []).length ? ";" : ",";
  const linhas = []; let linha = [], campo = "", aspas = false;
  for(let i = 0; i < texto.length; i++){
    const c = texto[i];
    if(aspas){
      if(c === '"' && texto[i+1] === '"'){ campo += '"'; i++; }
      else if(c === '"') aspas = false;
      else campo += c;
    } else if(c === '"') aspas = true;
    else if(c === sep){ linha.push(campo); campo = ""; }
    else if(c === "\n" || c === "\r"){
      if(c === "\r" && texto[i+1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if(campo || linha.length){ linha.push(campo); linhas.push(linha); }
  return linhas;
}

export async function receberPlanilha(arquivo){
  $("#nomeArquivo").textContent = arquivo.name;
  $("#previaImportacao").innerHTML = '<p class="dica">Lendo o arquivo...</p>';
  try{
    let matriz;
    if(/\.xlsx?$/i.test(arquivo.name)){
      await carregarScript(SHEETJS);
      const livro = window.XLSX.read(await arquivo.arrayBuffer(), { type:"array" });
      const folha = livro.Sheets[livro.SheetNames[0]];
      matriz = window.XLSX.utils.sheet_to_json(folha, { header:1, raw:true, defval:"" });
    } else {
      matriz = lerCSV(await arquivo.text());
    }
    linhasLidas = validar(matriz);
    pintarPrevia();
  } catch(e){
    console.error(e);
    $("#previaImportacao").innerHTML = '<p class="aviso">' + esc(explicarErro(e)) + '</p>';
  }
}

/* ---------- validação linha a linha ---------- */
function mapaColunas(cab){
  const mapa = {};
  cab.forEach(function(nome, i){
    const n = normalizar(nome).trim();
    Object.keys(APELIDOS).forEach(function(k){
      if(mapa[k] === undefined && APELIDOS[k].indexOf(n) !== -1) mapa[k] = i;
    });
  });
  return mapa;
}

export function validar(matriz){
  if(!matriz.length) return [{ linha:0, erros:["Arquivo vazio."], ok:false }];
  const mapa = mapaColunas(matriz[0]);
  if(mapa.titulo === undefined || mapa.inicio === undefined){
    return [{ linha:1, ok:false, erros:['Não achei as colunas "Título" e "Início" na primeira linha. Use o modelo.'] }];
  }
  const codigosArquivo = new Set();
  const livres = proximosCodigos(matriz.length);
  let iLivre = 0;
  const out = [];

  matriz.slice(1).forEach(function(cel, k){
    const val = function(c){ return mapa[c] === undefined ? "" : cel[mapa[c]]; };
    const txt = function(c){ return String(val(c) === null || val(c) === undefined ? "" : val(c)).trim(); };
    if(!cel.some(function(x){ return String(x).trim(); })) return;   /* linha em branco */
    const r = { linha:k + 2, erros:[], ok:false };

    r.titulo = txt("titulo");
    if(!r.titulo) r.erros.push("sem título");

    r.inicio = lerData(val("inicio"));
    if(!txt("inicio")) r.erros.push("sem data de início");
    else if(!r.inicio) r.erros.push('início "' + txt("inicio") + '" não é uma data');

    if(txt("fim")){
      r.fimPrev = lerData(val("fim"));
      if(!r.fimPrev) r.erros.push('término "' + txt("fim") + '" não é uma data');
    } else if(txt("duracao")){
      const n = Number(String(txt("duracao")).replace(",", "."));
      if(!(n >= 1)) r.erros.push("duração inválida");
      else if(r.inicio) r.fimPrev = terminoPorDiasUteis(r.inicio, Math.round(n));
    } else r.fimPrev = "";
    if(r.inicio && r.fimPrev && r.fimPrev < r.inicio) r.erros.push("término antes do início");

    /* número do Excel vem pronto; texto aceita "1.250,5" (Brasil) e "1250.5" */
    const bruto = val("quantidade");
    const q = typeof bruto === "number" ? String(bruto)
            : (/,/.test(txt("quantidade")) ? txt("quantidade").replace(/\./g, "").replace(",", ".") : txt("quantidade"));
    r.quantidade = q ? Number(q) : 0;
    if(q && (isNaN(r.quantidade) || r.quantidade < 0)) r.erros.push("quantidade inválida");

    /* localização */
    r.locais = [];
    const fr = txt("frente"), pav = txt("pavimento");
    if((fr || pav) && !estado.locAtivo){
      r.erros.push("localização ainda não ligada no Supabase");
    } else if(fr || pav){
      const frente = fr ? acharFrente(fr) : null;
      if(!frente) r.erros.push(fr ? 'frente "' + fr + '" não cadastrada' : "pavimento sem frente");
      else if(!pav) r.locais = [frente.id];
      else {
        const nomes = pavimentosNoTexto(pav);
        if(!nomes.length) r.erros.push('pavimento "' + pav + '" não reconhecido');
        nomes.forEach(function(nome){
          const achado = filhos(frente.id).find(function(p){ return chavePavimento(p.nome) === chavePavimento(nome); });
          if(achado) r.locais.push(achado.id);
          else r.erros.push(nome + " não cadastrado em " + frente.nome + " (cadastre em Locais)");
        });
      }
    }

    r.codigo = txt("codigo");
    if(r.codigo){
      const uso = codigoEmUso(r.codigo, null);
      if(uso) r.erros.push("código " + r.codigo + " já existe");
      else if(codigosArquivo.has(r.codigo)) r.erros.push("código " + r.codigo + " repetido na planilha");
      codigosArquivo.add(r.codigo);
    }

    r.disciplina = txt("disciplina"); r.unidade = txt("unidade"); r.responsavel = txt("responsavel");
    r.detalhe = txt("detalhe"); r.escopo = txt("escopo");
    r.ok = !r.erros.length;
    out.push(r);
  });

  /* códigos automáticos para as linhas válidas sem código */
  out.forEach(function(r){
    if(r.ok && !r.codigo){
      while(codigosArquivo.has(livres[iLivre])) iLivre++;
      r.codigo = livres[iLivre++];
    }
  });
  return out;
}

function pintarPrevia(){
  const ok = linhasLidas.filter(function(r){ return r.ok; });
  const ruins = linhasLidas.length - ok.length;
  const btn = $("#btnGravarImportacao");
  $("#previaImportacao").innerHTML =
    '<p><strong>' + ok.length + '</strong> linha(s) prontas para entrar' +
      (ruins ? ' · <strong style="color:var(--tijolo)">' + ruins + '</strong> com erro (não entram)' : '') + '. Nada foi gravado ainda.</p>' +
    '<div class="painel-tabela"><table class="tabela"><thead><tr>' +
      '<th>Linha</th><th>Situação</th><th>Serviço</th><th>Local</th><th>Início</th><th>Término</th><th class="num">Dias úteis</th><th class="num">Qtd.</th>' +
    '</tr></thead><tbody>' +
    linhasLidas.map(function(r){
      return '<tr' + (r.ok ? '' : ' class="linha-vencida"') + '>' +
        '<td class="num">' + r.linha + '</td>' +
        '<td>' + (r.ok ? '<span class="marca marca--concluido">OK</span>' : '<span class="aviso-linha">' + esc(r.erros.join("; ")) + '</span>') + '</td>' +
        '<td><span class="cod">' + esc(r.codigo || "") + '</span><div class="tit">' + esc(r.titulo || "") + '</div></td>' +
        '<td>' + esc([textoDeIds(r.locais || []), r.detalhe].filter(Boolean).join(" — ")) + '</td>' +
        '<td class="num">' + (r.inicio ? fmtLongo(r.inicio) : "—") + '</td>' +
        '<td class="num">' + (r.fimPrev ? fmtLongo(r.fimPrev) : "—") + '</td>' +
        '<td class="num">' + (r.inicio && r.fimPrev && r.fimPrev >= r.inicio ? diasUteis(r.inicio, r.fimPrev) : "—") + '</td>' +
        '<td class="num">' + (r.quantidade ? esc(String(r.quantidade).replace(".", ",")) + " " + esc(r.unidade || "") : "—") + '</td>' +
      '</tr>';
    }).join("") + '</tbody></table></div>';
  btn.disabled = !ok.length;
  btn.textContent = ok.length ? "Gravar " + ok.length + " serviço(s)" : "Gravar";
}

export async function gravarImportacao(){
  const ok = linhasLidas.filter(function(r){ return r.ok && !r.gravado; });
  if(!ok.length) return;
  if(!confirm("Gravar " + ok.length + " serviço(s) planejado(s) da planilha?")) return;
  const btn = $("#btnGravarImportacao");
  btn.disabled = true;
  let n = 0;
  try{
    for(const r of ok){
      btn.textContent = "Gravando " + (n + 1) + " de " + ok.length + "...";
      const s = novoServico({
        codigo:r.codigo, titulo:r.titulo, disciplina:r.disciplina, local:r.detalhe,
        inicio:r.inicio, fimPrev:r.fimPrev, quantidade:r.quantidade, unidade:r.unidade,
        responsavel:r.responsavel, descricao:r.escopo
      });
      await salvar("servicos", s);
      estado.servicos.push(s);
      r.gravado = true;
      if(r.locais.length) await definirLigacoes(s.id, r.locais);
      n++;
    }
  } catch(e){
    console.error(e);
    pintarTudo();
    aviso("Parou na linha " + ok[n].linha + ": " + explicarErro(e) + " As " + n + " anteriores foram gravadas; tente de novo para o resto.", "erro");
    btn.disabled = false; btn.textContent = "Tentar de novo";
    return;
  }
  fecharModal();
  pintarTudo();
  aviso(n + " serviço(s) importado(s) em " + fmtLongo(hojeISO()));
}
