/**
 * URL for files in `public/` — must respect Vite `base` (e.g. GitHub Pages subfolders).
 */
export function publicAsset(relativePath: string): string {
  const p = relativePath.startsWith('/') ? relativePath.slice(1) : relativePath
  return `${import.meta.env.BASE_URL}${p}`
}
