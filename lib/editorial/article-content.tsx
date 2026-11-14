import Image from "next/image";

export type InlineImage = { src: string; alt: string; caption: string };

const imageLine = /^!\[([^\]]+)\]\((\/[^\s)]+|https:\/\/[^\s)]+)\s+"([^"]+)"\)$/;

export function getInlineImages(body: string): InlineImage[] {
  return body.split("\n").map((line) => {
    const match = imageLine.exec(line.trim());
    return match ? { alt: match[1], src: match[2], caption: match[3] } : null;
  }).filter((item): item is InlineImage => Boolean(item));
}

// Small, deliberately limited editorial syntax. React escapes all prose; no
// arbitrary HTML or script-bearing media is accepted from the CMS.
export function ArticleContent({ body }: { body: string }) {
  return <>{body.replace(/^(#{2,3} .+)$/gm, "\n$1\n").split(/\n\s*\n/).map((block, index) => {
    const value = block.trim();
    if (!value) return null;
    if (value.startsWith("## ")) return <h2 key={index}>{value.slice(3)}</h2>;
    if (value.startsWith("### ")) return <h3 key={index}>{value.slice(4)}</h3>;
    const image = getInlineImages(value)[0];
    if (image && value.split("\n").length === 1) return <figure className="editorial-inline-image" key={index}>
      <Image src={image.src} alt={image.alt} width={1200} height={675} sizes="(max-width: 800px) 100vw, 760px" unoptimized={!image.src.startsWith("/")} />
      <figcaption>{image.caption}</figcaption>
    </figure>;
    if (value.startsWith("- ")) return <ul key={index}>{value.split("\n").filter((line) => line.startsWith("- ")).map((line, item) => <li key={item}>{line.slice(2)}</li>)}</ul>;
    return <p key={index}>{value}</p>;
  })}</>;
}
