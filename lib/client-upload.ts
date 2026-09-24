export async function uploadFiles(files: File[], bucket: string, prefix: string) {
  const uploaded: string[] = [];
  for (const file of files) {
    const data = new FormData();
    data.append("bucket", bucket);
    data.append("prefix", prefix);
    data.append("file", file);
    const response = await fetch("/api/storage/upload", { method: "POST", body: data });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "העלאת קובץ נכשלה");
    if (body.data?.url) uploaded.push(body.data.url);
  }
  return uploaded;
}

export async function uploadManagementDocument(file: File, fields: Record<string, string>) {
  const form = new FormData();
  form.set("file", file);
  for (const [key, value] of Object.entries(fields)) if (value) form.set(key, value);
  const response = await fetch("/api/documents", { method: "POST", body: form });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.data?.id) throw new Error(body?.error || "העלאת המסמך נכשלה.");
  return body.data as { id: string; file_url: string; name: string; document_type: string; status: string };
}
