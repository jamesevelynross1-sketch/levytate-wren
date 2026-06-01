"use server";

import { redirect } from "next/navigation";
import {
  clearAdminSessionCookie,
  isValidAdminPassword,
  setAdminSessionCookie,
} from "@/lib/server/admin-auth";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!isValidAdminPassword(password)) {
    redirect("/admin/subscribers?error=1");
  }

  await setAdminSessionCookie();
  redirect("/admin/subscribers");
}

export async function logoutAdmin() {
  await clearAdminSessionCookie();
  redirect("/admin/subscribers");
}
