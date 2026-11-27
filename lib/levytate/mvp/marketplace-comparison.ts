export const marketplaceComparisonLimit=3;

/** Keep the shortlist stable. At capacity, the user explicitly removes an
 * item; a fourth click never evicts a previously selected programme. */
export function toggleMarketplaceComparison(current:string[],id:string):string[] {
  if(current.includes(id))return current.filter(item=>item!==id);
  if(current.length>=marketplaceComparisonLimit)return current;
  return [...current,id];
}
