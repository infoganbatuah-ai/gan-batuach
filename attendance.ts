import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
            Math.cos(phi1) * Math.cos(phi2) *
            Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll() { return request.cookies.getAll(); }, setAll(cookiesToSet) { cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value)); } } }
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "משתמש לא מורשה" }, { status: 401 });

    const body = await request.json();
    const { childId, parentLat, parentLng, actionType, signatureBase64, deliveredByRole } = body;

    // שימוש בדרייבר גנרי (any) כדי לעקוף התנגשויות מבנה ב-Supabase Schema
    const { data: kindergarten, error: kError } = await (supabase as any)
      .from("kindergartens")
      .select("latitude, longitude")
      .eq("child_id", childId)
      .maybeSingle();

    if (kError || !kindergarten) {
      return NextResponse.json({ error: "הגן לא נמצא או שחסרות קואורדינטות מיקום במערכת" }, { status: 404 });
    }

    const distance = calculateDistanceMeters(
      Number(parentLat), 
      Number(parentLng), 
      Number(kindergarten.latitude), 
      Number(kindergarten.longitude)
    );

    const MAX_ALLOWED_RADIUS_METERS = 30;
    if (distance > MAX_ALLOWED_RADIUS_METERS) {
      return NextResponse.json({ error: "חריגת מיקום: עליך להיות נוכח פיזית בשטח הגן כדי לדווח" }, { status: 400 });
    }

    const { data: record, error: logError } = await (supabase as any)
      .from("attendance_logs")
      .insert({
        child_id: childId,
        authorized_adult_id: user.id,
        adult_role: deliveredByRole,
        action_type: actionType,
        timestamp: new Date().toISOString(),
        location_verified: true,
        signature_base64: signatureBase64
      })
      .select()
      .maybeSingle();

    if (logError) throw logError;

    return NextResponse.json({ success: true, record });

  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
