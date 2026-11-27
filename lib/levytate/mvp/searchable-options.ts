export type SearchableOption = {value:string;label:string;searchText?:string};

/** Keep the user's existing choice and option ordering. A search is a view
 * filter, never a new eligibility rule or an automatic selection. */
export function filterSearchableOptions(options:SearchableOption[],selected:string,query:string) {
  const terms=query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const matchesOption=(option:SearchableOption)=>{
    const haystack=`${option.label} ${option.searchText??""}`.toLowerCase();
    const words=haystack.split(/[^\p{L}\p{N}]+/u);
    return terms.every(term=>terms.length>1&&term.length===1?words.includes(term):haystack.includes(term));
  };
  return {
    choices:options.filter(option=>option.value===""||option.value===selected||matchesOption(option)),
    matches:options.filter(option=>option.value!==""&&matchesOption(option)).length,
  };
}
