import type { Metadata } from "next";
import { StockShell } from "@/components/stocks/StockShell";

export const metadata: Metadata = {
  title: "Stock Signal Dashboard",
  description: "Decision-support dashboard for daily stock signals, watchlists, portfolio risk and catalysts.",
};

export default function StocksLayout({ children }: { children: React.ReactNode }) {
  return <StockShell>{children}</StockShell>;
}
