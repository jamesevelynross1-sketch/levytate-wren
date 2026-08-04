import { redirect } from "next/navigation";
import MprHomePage, { metadata } from "./page-MPR";

export { metadata };

export default function HomePage() {
  if (process.env.LEVYTATE_STAGING_ENTRY_ENABLED?.trim().toLowerCase() === "true") {
    redirect("/levytate/login");
  }

  return <MprHomePage />;
}
