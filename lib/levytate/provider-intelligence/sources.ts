import type { ProviderIntelligenceSource } from "./domain.ts";
const s=(value:ProviderIntelligenceSource)=>value;
export const providerIntelligenceSources = [
 s({id:"source-qa",providerId:"provider-qa",label:"QA News",sourceUrl:"https://www.qa.com/about/news/",providerDomain:"qa.com",parser:"html",status:"active"}),
 s({id:"source-baltic",providerId:"provider-baltic",label:"Baltic Blog",sourceUrl:"https://www.balticapprenticeships.com/blog/",providerDomain:"balticapprenticeships.com",parser:"html",status:"active"}),
 s({id:"source-apprentify",providerId:"provider-apprentify",label:"Apprentify Blog",sourceUrl:"https://www.apprentify.com/blog/",providerDomain:"apprentify.com",parser:"html",status:"active"}),
 s({id:"source-lcg",providerId:"provider-learning-curve-group",label:"Learning Curve Group News",sourceUrl:"https://www.learningcurvegroup.co.uk/news/",providerDomain:"learningcurvegroup.co.uk",parser:"html",status:"active"}),
 s({id:"source-marketing-trainer",providerId:"provider-the-marketing-trainer",label:"The Marketing Trainer Blog",sourceUrl:"https://www.themarketingtrainer.co.uk/blog",providerDomain:"themarketingtrainer.co.uk",parser:"html",status:"active"}),
 s({id:"source-hbtc",providerId:"provider-hbtc",label:"HBTC News",sourceUrl:"https://www.hbtc.co.uk/news/",providerDomain:"hbtc.co.uk",parser:"html",status:"active"}),
 s({id:"source-staffs",providerId:"provider-staffordshire-university",label:"University of Staffordshire News",sourceUrl:"https://www.staffs.ac.uk/news",providerDomain:"staffs.ac.uk",parser:"html",status:"active"}),
 s({id:"source-lsp",providerId:"provider-learning-skills-partnership",label:"Learning Skills Partnership Blog",sourceUrl:"https://www.learningskillspartnership.com/blog",providerDomain:"learningskillspartnership.com",parser:"html",status:"active"}),
 s({id:"source-srscc",providerId:"provider-srscc",label:"SRSCC News",sourceUrl:"https://www.srscc.co.uk/news/",providerDomain:"srscc.co.uk",parser:"html",status:"active"}),
 s({id:"source-rhg",providerId:"provider-rhg-consult",label:"RHG Consult",sourceUrl:"https://www.rhgconsult.co.uk/",providerDomain:"rhgconsult.co.uk",parser:"html",status:"needs-review"}),
 s({id:"source-aicore",providerId:"provider-aicore",label:"AiCore",sourceUrl:"https://theaicore.com/",providerDomain:"theaicore.com",parser:"html",status:"needs-review"}),
 s({id:"source-primary-goal",providerId:"provider-primary-goal",label:"Primary Goal",sourceUrl:"https://primarygoal.ac.uk/",providerDomain:"primarygoal.ac.uk",parser:"html",status:"disabled"}),
] as const satisfies readonly ProviderIntelligenceSource[];
