"use client";

/**
 * Ícone de um item: renderiza a imagem (PNG) quando o template tiver o campo
 * `image`, com fallback para o emoji padrão (template.icon). As imagens usam
 * `loading="lazy"` + `decoding="async"` para só baixar quando entrarem na tela.
 */
export default function ItemIcon({
  template,
  className = "h-6 w-6 object-contain",
  emojiClass = "text-xl leading-none",
  alt = "",
}: {
  template?: { image?: string; icon?: string } | null;
  className?: string;
  emojiClass?: string;
  alt?: string;
}) {
  const src = template?.image;
  if (src) {
    return <img src={src} alt={alt} loading="lazy" decoding="async" draggable={false} className={className} />;
  }
  return <span className={`inline-flex items-center justify-center ${emojiClass}`}>{template?.icon || "❔"}</span>;
}