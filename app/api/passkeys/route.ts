import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("passkey_credentials")
    .select("id, label, device_type, backed_up, transports, created_at, last_used_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    const storageUnavailable = error.code === "42P01"
      || error.code === "PGRST205"
      || /passkey_credentials|schema cache/i.test(error.message);

    if (storageUnavailable) {
      return NextResponse.json({ data: [], available: false });
    }

    return NextResponse.json(
      { error: "לא ניתן לבדוק כרגע את זמינות הכניסה המהירה." },
      { status: 503 }
    );
  }

  return NextResponse.json({ data: data ?? [], available: true });
}
