import { describe,expect,it } from "vitest";
import { readFileSync } from "node:fs";
import { filterSearchableOptions } from "@/lib/levytate/mvp/searchable-options";

describe("Searchable programme choices",()=>{
  const options=[{value:"",label:"Select programme"},{value:"one",label:"Level 4 · Data Analyst",searchText:"Provider A ST0118"},{value:"two",label:"Level 3 · Team Leader",searchText:"Provider B"},{value:"three",label:"Level 4 · Data Technician",searchText:"Provider C"}];
  it("retains the complete catalogue and order when not searching",()=>expect(filterSearchableOptions(options,"","").choices).toEqual(options));
  it("matches multiple case-insensitive terms across a provider and standard",()=>expect(filterSearchableOptions(options,"","provider a DATA").choices.map(x=>x.value)).toEqual(["","one"]));
  it("allows a single-letter search without narrowing the entire catalogue prematurely",()=>expect(filterSearchableOptions(options,"","a").matches).toBe(3));
  it("retains the selected record without presenting it as a query match",()=>expect(filterSearchableOptions(options,"two","ST0118")).toEqual({choices:[options[0],options[1],options[2]],matches:1}));
  it("keeps the empty prompt when there are no matches",()=>expect(filterSearchableOptions(options,"","unknown")).toEqual({choices:[options[0]],matches:0}));
});

describe("LevyTate semantic colour contract",()=>{
  const css=readFileSync(new URL("../app/levytate/design-system.css",import.meta.url),"utf8");
  function colour(name:string){const m=css.match(new RegExp("--lt-"+name+": (\\d+) (\\d+) (\\d+);"));if(!m)throw Error("Missing design token "+name);return m.slice(1).map(Number);}
  const luminance=(rgb:number[])=>rgb.map(value=>value/255).map(value=>value<=0.04045?value/12.92:((value+0.055)/1.055)**2.4).reduce((sum,value,i)=>sum+value*[0.2126,0.7152,0.0722][i],0);
  function contrast(foreground:string,background:string){const a=luminance(colour(foreground)),b=luminance(colour(background));return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);}
  it.each(["ink","secondary","muted","accent","risk"] as const)("provides AA normal-text contrast for %s on white",name=>expect(contrast(name,"surface")).toBeGreaterThanOrEqual(4.5));
  it.each(["ink","secondary","muted","accent","risk"] as const)("provides AA normal-text contrast for %s on canvas",name=>expect(contrast(name,"canvas")).toBeGreaterThanOrEqual(4.5));
  it("scopes shared styling and supports reduced motion",()=>{expect(css).toContain(".lt-design .lt-panel");expect(css).toContain("prefers-reduced-motion:reduce");});
});
