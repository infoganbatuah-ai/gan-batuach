"use client";

import { PasswordUpdateForm } from "@/components/auth/password-update-form";

export function ObserverSetPasswordForm() {
  return <PasswordUpdateForm product="digital_observer" loginHref="/digital-observer/login" requestHref="/digital-observer/forgot-password" />;
}
