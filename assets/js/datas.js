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

/* ------------------------------------------------------------
   DIAS ÚTEIS — deslocamentos (Fase 3)
   Usam o mesmo calendário acima (segunda a sexta, sem os
   FERIADOS de Recife/PE). Servem ao cadastro em lote ("5 dias
   úteis entre pavimentos") e à edição em lote ("adiar 3 dias").
   ------------------------------------------------------------ */
export function ehDiaUtil(iso){
  const d = dataLocal(iso);
  if(!d) return false;
  const s = d.getDay();
  return s !== 0 && s !== 6 && !ehFeriado(iso);
}

/* a própria data, se for dia útil; senão o próximo dia útil */
export function proximoDiaUtil(iso){
  const d = dataLocal(iso);
  if(!d) return "";
  while(!ehDiaUtil(paraISO(d))) d.setDate(d.getDate() + 1);
  return paraISO(d);
}

/* anda n dias úteis a partir da data (n negativo volta no tempo).
   somarDiasUteis("2026-10-09", 1) -> 2026-10-13 (pula fim de semana e 12/10) */
export function somarDiasUteis(iso, n){
  const d = dataLocal(iso);
  if(!d) return "";
  const passo = n < 0 ? -1 : 1;
  let falta = Math.abs(n);
  while(falta > 0){
    d.setDate(d.getDate() + passo);
    if(ehDiaUtil(paraISO(d))) falta--;
  }
  return paraISO(d);
}

/* término de um serviço que começa em `inicio` e dura `n` dias úteis
   (o dia de início conta como o primeiro) */
export function terminoPorDiasUteis(inicio, n){
  const ini = proximoDiaUtil(inicio);
  return n > 1 ? somarDiasUteis(ini, n - 1) : ini;
}

/* lê datas de planilha: "06/07/2026", "6/7/26", "2026-07-06" ou o número
   de série do Excel (46209). Devolve "AAAA-MM-DD" ou "" se inválida.
   Nunca usa new Date("2026-07-06"), que o navegador lê como UTC. */
export function lerData(v){
  if(v === null || v === undefined || v === "") return "";
  if(typeof v === "number" && v > 20000 && v < 80000){
    const d = new Date(1899, 11, 30);           /* base do Excel */
    d.setDate(d.getDate() + Math.floor(v));
    return paraISO(d);
  }
  if(v instanceof Date && !isNaN(v)) return paraISO(new Date(v.getFullYear(), v.getMonth(), v.getDate()));
  const t = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  let a, mes, dia;
  if(m){ a = +m[1]; mes = +m[2]; dia = +m[3]; }
  else {
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/.exec(t);
    if(!m) return "";
    dia = +m[1]; mes = +m[2]; a = +m[3]; if(a < 100) a += 2000;
  }
  const d = new Date(a, mes - 1, dia);
  if(d.getFullYear() !== a || d.getMonth() !== mes - 1 || d.getDate() !== dia) return "";
  return paraISO(d);
}