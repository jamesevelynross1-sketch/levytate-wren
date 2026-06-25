import type { ProviderMatchingRequest } from "@/lib/levytate/domain";

export const initialProviderMatchingRequests: ProviderMatchingRequest[] = [
  { id: 1, date: "11 Jun 2026", need: "Procurement Lead succession", programme: "Level 4 Commercial Procurement and Supply", sites: "York Head Office", learners: "3", status: "Under Review", delivery: "Blended", funding: "Levy", urgency: "Within 6 months" },
  { id: 2, date: "10 Jun 2026", need: "Data skills in Operations", programme: "Level 3 Data Technician", sites: "All sites", learners: "8", status: "Provider Shortlist Being Prepared", delivery: "Flexible", funding: "Unsure", urgency: "Within 3 months" },
];
