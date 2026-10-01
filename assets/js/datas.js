/* --- datas: sempre tratadas como data de calendário local --- */
export function dataLocal(iso){
  if(!iso) return null;
  const p = String(iso).slice(0,10).split("-");
  if(p.length !== 3) return null;
  const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  return isNaN(d.getTime()) ? null : d;
}
export function paraISO(d){
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dia = String(d.getDate()).padStart(2,"0");
  return d.getFullYear() + "-" + m + "-" + dia;
}
export function hojeISO(){ return paraISO(new Date()); }
export function fmt(iso){
  const d = dataLocal(iso);
  if(!d) return "—";
  return String(d.getDate()).padStart(2,"0") + "/" +
         String(d.getMonth()+1).padStart(2,"0") + "/" +
         String(d.getFullYear()).slice(2);
}
export function fmtLongo(iso){
  const d = dataLocal(iso);
  if(!d) return "—";
  return String(d.getDate()).padStart(2,"0") + "/" +
         String(d.getMonth()+1).padStart(2,"0") + "/" + d.getFullYear();
}
/* diferença em dias de calendário, imune a horário de verão */
export function difDias(isoA, isoB){
  const a = dataLocal(isoA), b = dataLocal(isoB);
  if(!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}
/* duração inclusiva: início e fim contam como dias trabalhados */
export function diasCorridos(ini, fim){
  const d = difDias(ini, fim);
  return d === null ? null : d + 1;
}
/* Calendário da obra: segunda a sexta, descontando feriados.
   Nacionais + estadual de PE (06/03) + municipais do Recife.
   As segundas de carnaval entram porque a obra costuma emendar.
   Confira contra o calendário do cronograma e ajuste à vontade. */
export const FERIADOS = [
  "2026-01-01","2026-02-16","2026-02-17","2026-03-06","2026-04-03","2026-04-21",
  "2026-05-01","2026-06-04","2026-06-24","2026-07-16","2026-09-07","2026-10-12",
  "2026-11-02","2026-11-15","2026-12-25",
  "2027-01-01","2027-02-08","2027-02-09","2027-03-06","2027-03-26","2027-04-21",
  "2027-05-01","2027-05-27","2027-06-24","2027-07-16","2027-09-07","2027-10-12",
  "2027-11-02","2027-11-15","2027-12-25"
];
export const SET_FERIADOS = new Set(FERIADOS);

export function ehFeriado(iso){ return SET_FERIADOS.has(iso); }

export function diasUteis(ini, fim){
  const a = dataLocal(ini), b = dataLocal(fim);
  if(!a || !b || b < a) return null;
  let n = 0;
  const c = new Date(a.getTime());
  while(c <= b){
    const s = c.getDay();
    if(s !== 0 && s !== 6 && !ehFeriado(paraISO(c))) n++;
    c.setDate(c.getDate() + 1);
  }
  return n;
}

export function feriadosNoPeriodo(ini, fim){
  const a = dataLocal(ini), b = dataLocal(fim);
  if(!a || !b || b < a) return [];
  const out = [];
  const c = new Date(a.getTime());
  while(c <= b){
    const s = c.getDay();
    if(s !== 0 && s !== 6 && ehFeriado(paraISO(c))) out.push(paraISO(c));
    c.setDate(c.getDate() + 1);
  }
  return out;
}
