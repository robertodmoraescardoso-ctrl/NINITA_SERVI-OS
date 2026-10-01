import { dataLocal, diasCorridos, difDias, hojeISO } from "./datas.js";
import { estado } from "./estado.js";

/* ------------------------------------------------------------
   REGRAS DO SERVIÇO
   ------------------------------------------------------------ */
export const STATUS = {
  planejado:  { rot:"Planejado",    cor:"var(--pedra)" },
  andamento:  { rot:"Em andamento", cor:"var(--marca)"  },
  concluido:  { rot:"Concluído",    cor:"var(--folha)"     },
  paralisado: { rot:"Paralisado",   cor:"var(--tijolo)" }
};

/* data em que a contagem de dias para: fim real, ou hoje */
export function dataReferencia(s){
  if(s.status === "concluido" && s.fimReal) return s.fimReal;
  if(s.status === "concluido" && s.fimPrev) return s.fimPrev;
  return hojeISO();
}

export function duracao(s){
  if(!s.inicio) return null;
  const ref = dataReferencia(s);
  if(dataLocal(ref) < dataLocal(s.inicio)) return 0;
  return diasCorridos(s.inicio, ref);
}

/* Atraso em dias corridos contra o término previsto.
   Serviço PLANEJADO não tem atraso enquanto não for iniciado: o
   aviso dele é "deveria ter começado", na aba Planejamento. */
export function diasAtraso(s){
  if(s.status === "planejado") return 0;
  if(s.status === "concluido"){
    if(s.fimPrev && s.fimReal){
      const d = difDias(s.fimPrev, s.fimReal);
      return d > 0 ? d : 0;
    }
    return 0;
  }
  if(!s.fimPrev) return 0;
  const d = difDias(s.fimPrev, hojeISO());
  return d > 0 ? d : 0;
}

export function estaAtrasado(s){ return diasAtraso(s) > 0; }

/* ---- quantitativo ----
   O previsto fica no cadastro do serviço; o executado é a soma
   do que foi lançado em cada apontamento. */
export const UNIDADES = ["m²","m³","m","un","pç","kg","t","L","vb"];

export function quantPrevista(s){ return Number(s.quantidade) || 0; }

export function quantExecutada(s){
  return (s.apontamentos || []).reduce(function(n,a){ return n + (Number(a.quantidade) || 0); }, 0);
}

export function avancoFisico(s){
  const p = quantPrevista(s);
  if(!p) return null;
  return Math.min(100, Math.round((quantExecutada(s) / p) * 100));
}

/* formata sem casas inúteis: 320 em vez de 320,00 */
export function num(v){
  const n = Number(v) || 0;
  return n.toLocaleString("pt-BR", {maximumFractionDigits:2});
}

export function textoQuant(s){
  if(!quantPrevista(s)) return "";
  return num(quantExecutada(s)) + " / " + num(quantPrevista(s)) + " " + (s.unidade || "");
}

/* todas as fotos do serviço, do cadastro e dos apontamentos */
export function fotosDo(s){
  let out = (s.fotos || []).slice();
  (s.apontamentos || []).forEach(function(a){ out = out.concat(a.fotos || []); });
  return out;
}

export function pessoasDo(s){
  const set = new Set();
  if(s.responsavel) set.add(s.responsavel);
  (s.equipe || []).forEach(function(p){ set.add(p); });
  (s.apontamentos || []).forEach(function(a){
    (a.colaboradores || []).forEach(function(p){ set.add(p); });
  });
  return Array.from(set);
}

export function ultimaAtualizacao(s){
  const aps = s.apontamentos || [];
  if(!aps.length) return s.criadoEm || "";
  return aps.map(function(a){ return a.data || ""; }).sort().pop();
}

export function proximoCodigo(){
  return proximosCodigos(1)[0];
}

/* n códigos livres em sequência (cadastro em lote, importação) */
export function proximosCodigos(n){
  let maior = 0;
  estado.servicos.forEach(function(s){
    const m = /(\d+)$/.exec(s.codigo || "");
    if(m) maior = Math.max(maior, Number(m[1]));
  });
  const out = [];
  for(let i = 1; i <= n; i++) out.push("SRV-" + String(maior + i).padStart(3, "0"));
  return out;
}

export function codigoEmUso(codigo, exceto){
  return estado.servicos.find(function(x){ return x.codigo === codigo && x.id !== exceto; }) || null;
}

/* Serviço novo com os campos de sempre. A linha de base (previsto no
   momento do cadastro) fica congelada em inicioBase/fimBase para o
   Gantt comparar previsto x realizado. */
export function novoServico(campos){
  const s = Object.assign({
    id: idServico(), codigo:"", titulo:"", local:"", disciplina:"", status:"planejado",
    inicio:"", fimPrev:"", fimReal:"", responsavel:"", equipe:[], avanco:0,
    descricao:"", quantidade:0, unidade:"", apontamentos:[], fotos:[],
    criadoEm: new Date().toISOString()
  }, campos || {});
  s.inicioBase = s.inicio;
  s.fimBase = s.fimPrev;
  return s;
}
function idServico(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }
