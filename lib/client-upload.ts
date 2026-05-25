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
