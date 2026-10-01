import { filhos, frentes, textoLocalizacao } from "./localizacoes.js";

/* ------------------------------------------------------------
   INFERÊNCIA DE LOCALIZAÇÃO
   Lê o título e o campo "Local" dos serviços antigos e sugere
   frente e pavimento(s). Nada é gravado sem confirmação: o
   resultado vai para a tela de triagem.

   Reconhece, por exemplo:
     "Torre A · 3º pavimento"       -> Torre A, 3º pavimento
     "Alvenaria 1º ao 4º pav"       -> 1º, 2º, 3º e 4º pavimento
     "pavimentos 1 a 8"             -> 1º ao 8º pavimento
     "Térreo", "Subsolo", "Coberta" -> pavimentos com esse nome
     "Guarita Pedestre"             -> Guarita
   ------------------------------------------------------------ */

/* minúsculas, sem acento, º/°/ª viram "o" */
export function normalizar(t){
  return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[º°ª]/g, "o");
}

/* apelidos de frentes além do próprio nome cadastrado */
const APELIDOS = {
  "torre bc": [/\btorres?\s*b\s*(?:e|\/|-|&)?\s*c\b/],
  "anexos":   [/\banexo\b/],
};

function regexDoNome(nome){
  const n = normalizar(nome).trim().split(/\s+/).map(function(p){
    return p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("\\s*");
  return new RegExp("\\b" + n + "\\b");
}

/* chave para comparar pavimentos: "3", "terreo", "subsolo"... */
export function chavePavimento(nome){
  const t = normalizar(nome);
  const m = /^(\d+)/.exec(t);
  if(m) return String(Number(m[1]));
  return t.replace(/\s*pavimento\s*/, "").trim();
}

const PALAVRAS = [
  { re:/\bterreo\b/,    nome:"Térreo" },
  { re:/\bsubsolo\b/,   nome:"Subsolo" },
  { re:/\bcobertura\b/, nome:"Cobertura" },
  { re:/\bcoberta\b/,   nome:"Coberta" },
  { re:/\bmezanino\b/,  nome:"Mezanino" },
  { re:/\bpilotis\b/,   nome:"Pilotis" },
];
/* "pav", "pav.", "pavimento(s)", "andar(es)" — mas não "pavimentação" */
const PAV = "(?:pav(?:imentos?)?\\b\\.?|andar(?:es)?\\b)";

/* devolve nomes canônicos dos pavimentos citados no texto */
export function pavimentosNoTexto(texto){
  const t = normalizar(texto);
  const nums = new Set();
  let m;
  /* "1o ao 4o pavimento", "1 a 4 pav", "1o/2o pav", "1o e 2o pav" */
  const faixa = new RegExp("(\\d+)\\s*o?\\s*" + PAV + "?\\s*(ao|a|ate|-|\\/|e)\\s*(\\d+)\\s*o?\\s*" + PAV, "g");
  while((m = faixa.exec(t))){
    const a = Number(m[1]), b = Number(m[3]);
    if(m[2] === "e" || m[2] === "/"){ nums.add(a); nums.add(b); }
    else if(b >= a && b - a < 60){ for(let n = a; n <= b; n++) nums.add(n); }
  }
  /* "pavimentos 1 a 8", "pavimento 3" */
  const depois = new RegExp(PAV + "\\s*(\\d+)\\s*o?(?:\\s*(ao|a|ate|-)\\s*(\\d+))?", "g");
  while((m = depois.exec(t))){
    const a = Number(m[1]);
    if(m[3]){ const b = Number(m[3]); if(b >= a && b - a < 60) for(let n = a; n <= b; n++) nums.add(n); }
    else nums.add(a);
  }
  /* "3o pavimento", "3 pav" */
  const antes = new RegExp("(\\d+)\\s*o?\\s*" + PAV, "g");
  while((m = antes.exec(t))) nums.add(Number(m[1]));

  const nomes = Array.from(nums).filter(function(n){ return n > 0 && n < 100; })
    .sort(function(a,b){ return a - b; })
    .map(function(n){ return n + "º pavimento"; });
  PALAVRAS.forEach(function(p){ if(p.re.test(t)) nomes.push(p.nome); });
  return nomes;
}

/* O campo "Local" (texto livre antigo) acrescenta algo além de
   frente e pavimento? "Torre A · 3º pavimento" não acrescenta;
   "Torre A · 3º pavimento · trecho 02" acrescenta "trecho 02".
   Devolve o texto original quando acrescenta, ou "" quando não. */
export function localExtra(servico){
  const original = String(servico.local || "").trim();
  if(!original) return "";
  let t = normalizar(original);
  frentes().forEach(function(f){
    t = t.replace(new RegExp(regexDoNome(f.nome).source, "g"), " ");
    (APELIDOS[normalizar(f.nome)] || []).forEach(function(re){ t = t.replace(new RegExp(re.source, "g"), " "); });
  });
  t = t.replace(new RegExp("(\\d+)\\s*o?\\s*" + PAV + "?\\s*(ao|a|ate|-|\\/|e)\\s*(\\d+)\\s*o?\\s*" + PAV, "g"), " ")
       .replace(new RegExp(PAV + "\\s*\\d+\\s*o?(?:\\s*(?:ao|a|ate|-)\\s*\\d+)?", "g"), " ")
       .replace(new RegExp("\\d+\\s*o?\\s*" + PAV, "g"), " ");
  PALAVRAS.forEach(function(p){ t = t.replace(new RegExp(p.re.source, "g"), " "); });
  t = t.replace(/[·\-–—|,;:\/().]+/g, " ").trim();
  return /[a-z0-9]{2,}/.test(t) ? original : "";
}

/* Texto "onde" para cartões e listas: a localização cadastrada e,
   se acrescentar algo, o detalhe livre. Sem localização, o texto livre. */
export function textoOnde(servico){
  const loc = textoLocalizacao(servico.id);
  const extra = loc ? localExtra(servico) : String(servico.local || "").trim();
  return [loc, extra].filter(Boolean).join(" — ");
}

/* Sugestão para um serviço:
   { tipo:"ok"|"ambiguo"|"nada", frente, pavimentos:[{id|null, nome}], motivo } */
export function sugerir(servico){
  const texto = [servico.titulo, servico.local].join(" | ");
  const t = normalizar(texto);

  const achadas = frentes().filter(function(f){
    if(regexDoNome(f.nome).test(t)) return true;
    return (APELIDOS[normalizar(f.nome)] || []).some(function(re){ return re.test(t); });
  });
  const pavs = pavimentosNoTexto(texto);

  if(achadas.length > 1){
    return { tipo:"ambiguo", frente:null, pavimentos:[],
             motivo:"cita mais de uma frente (" + achadas.map(function(f){ return f.nome; }).join(", ") + ")" };
  }
  if(!achadas.length){
    return pavs.length
      ? { tipo:"ambiguo", frente:null, pavimentos:[], motivo:"cita " + pavs.join(", ") + ", mas não diz a frente" }
      : { tipo:"nada", frente:null, pavimentos:[], motivo:"não cita frente nem pavimento" };
  }

  const frente = achadas[0];
  const existentes = filhos(frente.id);
  const pavimentos = pavs.map(function(nome){
    const ja = existentes.find(function(p){ return chavePavimento(p.nome) === chavePavimento(nome); });
    return ja ? { id:ja.id, nome:ja.nome } : { id:null, nome:nome };
  });
  return { tipo:"ok", frente:frente, pavimentos:pavimentos,
           motivo: pavimentos.some(function(p){ return !p.id; }) ? "cria pavimento novo" : "" };
}
