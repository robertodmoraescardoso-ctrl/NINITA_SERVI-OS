/* ------------------------------------------------------------
   MODELO — o catálogo do projeto e o estado em memória

   O catálogo vem de assets/dados/alvenaria-catalogo.json e das
   plantas em assets/dados/alvenaria-plantas.json. Os dois saem
   das pranchas da Tecomat e são versionados no git: mudam só
   quando sai revisão nova. O que a obra produz (apontamento,
   responsável, prazo) mora no Supabase.
   ------------------------------------------------------------ */

export const est = {
  /* catálogo */
  skus: [], pavimentos: [], paredes: [], porId: {}, porPavimento: {},
  plantas: {}, pavPorCodigo: {},
  /* o que veio do banco */
  situacao: {},      /* "PAV__PRxxx" -> último apontamento */
  plano: {},         /* "PAV__PRxxx" -> {id, responsavel, inicio, fim} */
  equipeSugerida: [],
  /* tela */
  pav: "TE", aba: "mapa", vista: "planta", zoom: 3, plantaDe: null,
  filtro: "todas", busca: "", aberta: null,
  conectado: false, podeGravar: false, aviso: ""
};

export const AVISOS = {
  x: ["Contém bloco cortado (XVAR), sem comprimento definido em projeto. A área prevista está subestimada e o % sai otimista.", "!"],
  g: ["Contém o código CER-VER-9X19X1, que não existe na legenda do projeto. Pendente de confirmação com a Tecomat.", "?"],
  z: ["A tabela de projeto não traz bloco de vedação: não há área para medir. Aponte apenas concluída ou não.", "0"],
  e: ["Pendente de verificação do engenheiro de estruturas (nota de prancha).", "E"]
};

export const ROTULO = {
  ok: "Concluída", andamento: "Em execução", atraso: "Fora do prazo",
  zero: "Não iniciada", semquant: "Sem m²"
};

export async function carregarCatalogo(){
  const [cat, pl] = await Promise.all([
    fetch("assets/dados/alvenaria-catalogo.json").then(function(r){
      if(!r.ok) throw new Error("catálogo (HTTP " + r.status + ")"); return r.json(); }),
    fetch("assets/dados/alvenaria-plantas.json").then(function(r){
      if(!r.ok) throw new Error("plantas (HTTP " + r.status + ")"); return r.json(); })
  ]);

  est.skus = cat.skus;
  est.pavimentos = cat.pavimentos;
  est.plantas = pl;
  est.paredes = [];
  est.porId = {};
  est.porPavimento = {};
  est.pavPorCodigo = {};

  for(const p of cat.pavimentos){
    est.pavPorCodigo[p.c] = p;
    const lista = [];
    const jogo = cat.jogos[p.jogo];
    if(jogo){
      for(const w of jogo){
        lista.push({ id: p.c + "__" + w.c, pav: p.c, codigo: w.c, tipo: w.t,
                     espessura: w.e, area: w.a, blocos: w.n, sku: w.b,
                     avisos: w.f || "", prancha: w.p });
      }
    } else {
      for(const c of (cat.pendentes[p.jogo] || [])){
        lista.push({ id: p.c + "__" + c, pav: p.c, codigo: c, tipo: c[0] === "S" ? "s" : "p",
                     espessura: null, area: null, blocos: null, sku: null,
                     avisos: "", prancha: null });
      }
    }
    est.porPavimento[p.c] = lista;
    for(const w of lista){ est.paredes.push(w); est.porId[w.id] = w; }
  }
  return est;
}

/* ---------- regras ---------- */

export function hojeISO(){
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

export function temArea(w){ return typeof w.area === "number" && w.area > 0; }

export function percentual(w){
  const s = est.situacao[w.id];
  if(!s) return 0;
  const n = Number(s.percentual);
  return isNaN(n) ? 0 : Math.max(0, Math.min(100, n));
}

export function m2Executado(w){
  return temArea(w) ? Math.round(w.area * percentual(w)) / 100 : 0;
}

export function status(w){
  const p = percentual(w);
  if(p >= 100) return "ok";
  if(!temArea(w)) return "semquant";
  const pl = est.plano[w.id];
  if(pl && pl.fim && pl.fim < hojeISO()) return "atraso";
  if(p > 0) return "andamento";
  return "zero";
}

export function chavePlanta(pavCodigo){
  const p = est.pavPorCodigo[pavCodigo];
  return p ? p.jogo : null;
}

/* paredes do pavimento em foco que passam pelo filtro e pela busca */
export function visiveis(){
  const lista = est.porPavimento[est.pav] || [];
  const q = est.busca.trim().toUpperCase();
  return lista.filter(function(w){
    if(q && w.codigo.indexOf(q) === -1) return false;
    if(est.filtro === "todas") return true;
    if(est.filtro === "avisos") return !!w.avisos;
    if(est.filtro === "minhas"){
      const pl = est.plano[w.id];
      return !!(pl && pl.responsavel && meuNome() &&
                pl.responsavel.toLowerCase() === meuNome().toLowerCase());
    }
    return status(w) === est.filtro;
  });
}

let _meuNome = "";
export function meuNome(){ return _meuNome; }
export function definirMeuNome(n){ _meuNome = n || ""; }

/* ---------- formatação ---------- */

export function nf(v, casas){
  if(v === null || v === undefined) return "—";
  if(casas === undefined) casas = 2;
  return Number(v).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
}
export function ni(v){
  if(v === null || v === undefined) return "—";
  return Number(v).toLocaleString("pt-BR");
}
export function dataCurta(s){
  return s ? String(s).slice(8,10) + "/" + String(s).slice(5,7) : "—";
}
