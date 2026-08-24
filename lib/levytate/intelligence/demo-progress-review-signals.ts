import { progressReviewDemoScenarios } from "./demo-progress-review";
import { analyseProgressReviewIntelligence } from "./progress-review";

export const progressReviewDemoSignals=progressReviewDemoScenarios.flatMap(scenario=>analyseProgressReviewIntelligence(scenario).signals.map(signal=>({...signal,summary:`${scenario.learnerLabel}: ${signal.summary}`})));
