import fs from "node:fs"
import path from "node:path"
import type {
  BookStructure,
  TemplateCategory,
  TemplateStory,
  LocaleData,
  CategoryMeta,
  StoryMeta,
  ImageConfig,
  PageTiming,
} from "./types"

const DATA_DIR = path.join(process.cwd(), "src/data")

export function discoverBooks(): string[] {
  if (!fs.existsSync(DATA_DIR)) return []
  return fs.readdirSync(DATA_DIR).filter((d) => {
    const fullPath = path.join(DATA_DIR, d)
    return (
      fs.statSync(fullPath).isDirectory() &&
      fs.existsSync(path.join(fullPath, "template", "index.toml"))
    )
  })
}

export function loadBookStructure(bookId: string): BookStructure | null {
  const templateDir = path.join(DATA_DIR, bookId, "template")
  const rootToml = path.join(templateDir, "index.toml")
  if (!fs.existsSync(rootToml)) return null

  const rootContent = fs.readFileSync(rootToml, "utf-8")

  let imageConfig: ImageConfig | null = null
  const baseUrlMatch = rootContent.match(/base_url\s*=\s*"([^"]+)"/)
  if (baseUrlMatch) {
    imageConfig = { base_url: baseUrlMatch[1] }
  }

  let coverImage = ""
  const imgMatch = rootContent.match(/\[image\]\s*\n\s*filename\s*=\s*"([^"]+)"/)
  if (imgMatch) coverImage = imgMatch[1]

  const categoryEntries: Array<{ id: string; image: string }> = []
  let inCategory = false
  let catId = ""
  let catImage = ""

  for (const line of rootContent.split("\n")) {
    const trimmed = line.trim()
    if (trimmed === "[[categories]]") {
      if (inCategory && catId) {
        categoryEntries.push({ id: catId, image: catImage })
      }
      inCategory = true
      catId = ""
      catImage = ""
      continue
    }
    if (inCategory) {
      const idMatch = trimmed.match(/^id\s*=\s*"([^"]+)"/)
      if (idMatch) catId = idMatch[1]
      const imgMatch = trimmed.match(/^image\s*=\s*"([^"]+)"/)
      if (imgMatch) catImage = imgMatch[1]
    }
  }
  if (inCategory && catId) {
    categoryEntries.push({ id: catId, image: catImage })
  }

  const categories: TemplateCategory[] = []

  for (const cat of categoryEntries) {
    const catToml = path.join(templateDir, cat.id, "index.toml")
    if (!fs.existsSync(catToml)) continue

    const catContent = fs.readFileSync(catToml, "utf-8")
    const stories: TemplateStory[] = []

    let audioUrl = ""
    let audioHqUrl = ""
    const dramaticMatch = catContent.match(/dramatic_url\s*=\s*"([^"]+)"/)
    if (dramaticMatch) audioUrl = dramaticMatch[1]
    const hqMatch = catContent.match(/dramatic_hq_url\s*=\s*"([^"]+)"/)
    if (hqMatch) audioHqUrl = hqMatch[1]

    let inStory = false
    let storyId = ""
    let storyImage = ""

    for (const line of catContent.split("\n")) {
      const trimmed = line.trim()
      if (trimmed === "[[stories]]") {
        if (inStory && storyId) {
          stories.push({ id: storyId, image: storyImage })
        }
        inStory = true
        storyId = ""
        storyImage = ""
        continue
      }
      if (inStory) {
        const idMatch = trimmed.match(/^id\s*=\s*"([^"]+)"/)
        if (idMatch) storyId = idMatch[1]
        const imgMatch = trimmed.match(/^image\s*=\s*"([^"]+)"/)
        if (imgMatch) storyImage = imgMatch[1]
      }
    }
    if (inStory && storyId) {
      stories.push({ id: storyId, image: storyImage })
    }

    categories.push({
      id: cat.id,
      image: cat.image,
      audioUrl,
      audioHqUrl,
      stories,
    })
  }

  if (!coverImage && categories.length > 0 && categories[0].stories.length > 0) {
    coverImage = categories[0].stories[0].image
  }

  return { id: bookId, coverImage, imageConfig, categories }
}

export function loadLocaleData(
  bookId: string,
  iso3: string,
): LocaleData | null {
  const filePath = path.join(DATA_DIR, bookId, "template", "locales", `${iso3}.toml`)
  if (!fs.existsSync(filePath)) return null

  const content = fs.readFileSync(filePath, "utf-8")
  const lines = content.split("\n")

  let bookTitle = ""
  const topLevel: Record<string, string> = {}
  const categories: Record<string, CategoryMeta> = {}
  const categoryExtras: Record<string, Record<string, string>> = {}
  const stories: Record<string, StoryMeta> = {}
  const sections: Record<string, Record<string, string>> = {}

  let currentSection = ""
  const pendingValues: Record<string, string> = {}

  function flushSection() {
    if (!currentSection) return

    const parts = currentSection.split(".")

    if (parts.length === 1) {
      if (pendingValues.title) {
        categories[currentSection] = {
          title: pendingValues.title,
          description: pendingValues.description || "",
        }
      }
      const extras: Record<string, string> = {}
      for (const [key, value] of Object.entries(pendingValues)) {
        if (key !== "title" && key !== "description") {
          extras[key] = value
        }
      }
      if (Object.keys(extras).length > 0) {
        categoryExtras[currentSection] = extras
      }
    } else if (parts.length === 2) {
      const storyKey = `${parts[0]}.${parts[1]}`
      if (pendingValues.title || pendingValues.description) {
        stories[storyKey] = {
          title: pendingValues.title || "",
          description: pendingValues.description || "",
        }
      }
      const sectionData: Record<string, string> = {}
      for (const [key, value] of Object.entries(pendingValues)) {
        if (key.startsWith("p")) {
          sectionData[key] = value
        }
      }
      if (Object.keys(sectionData).length > 0) {
        if (!sections[storyKey]) sections[storyKey] = {}
        Object.assign(sections[storyKey], sectionData)
      }
    }
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue

    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/)
    if (sectionMatch) {
      flushSection()
      currentSection = sectionMatch[1]
      for (const key of Object.keys(pendingValues)) {
        delete pendingValues[key]
      }
      continue
    }

    const kvMatch = trimmed.match(/^(\w+)\s*=\s*"((?:[^"\\]|\\.)*)"/)
    if (kvMatch) {
      const key = kvMatch[1]
      const value = kvMatch[2].replace(/\\"/g, '"')

      if (!currentSection) {
        if (key === "title") bookTitle = value
        topLevel[key] = value
      }

      pendingValues[key] = value
    }
  }

  flushSection()

  return { bookTitle, topLevel, categories, categoryExtras, stories, sections }
}

export function loadMarkdownContent(
  bookId: string,
  categoryId: string,
  pageId: string,
): string | null {
  const mdPath = path.join(DATA_DIR, bookId, "template", categoryId, `${pageId}.md`)
  if (!fs.existsSync(mdPath)) return null
  return fs.readFileSync(mdPath, "utf-8")
}

export function loadPageTiming(
  bookId: string,
  categoryId: string,
  pageId: string,
): PageTiming {
  const timingDir = path.join(DATA_DIR, bookId, "timing", "export", categoryId)

  let segments: number[] = []
  let words: number[][] = []

  const segPath = path.join(timingDir, `${pageId}.json`)
  if (fs.existsSync(segPath)) {
    try {
      segments = JSON.parse(fs.readFileSync(segPath, "utf-8"))
    } catch { /* empty */ }
  }

  const wordPath = path.join(timingDir, `${pageId}_words.json`)
  if (fs.existsSync(wordPath)) {
    try {
      words = JSON.parse(fs.readFileSync(wordPath, "utf-8"))
    } catch { /* empty */ }
  }

  return { segments, words }
}

export function loadAllPageTimings(
  bookId: string,
  categoryId: string,
  pageIds: string[],
): Record<string, PageTiming> {
  const result: Record<string, PageTiming> = {}
  for (const pageId of pageIds) {
    result[pageId] = loadPageTiming(bookId, categoryId, pageId)
  }
  return result
}

export function discoverTimingFiles(
  bookId: string,
  categoryId: string,
): string[] {
  const timingDir = path.join(DATA_DIR, bookId, "timing", "export", categoryId)
  if (!fs.existsSync(timingDir)) return []
  return fs.readdirSync(timingDir)
    .filter((f) => f.endsWith(".json") && !f.includes("_words"))
    .map((f) => f.replace(".json", ""))
    .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
}

export function loadCombinedTiming(
  bookId: string,
  categoryId: string,
): PageTiming {
  const timingIds = discoverTimingFiles(bookId, categoryId)
  const allSegments: number[] = []
  const allWords: number[][] = []
  for (const id of timingIds) {
    const timing = loadPageTiming(bookId, categoryId, id)
    allSegments.push(...timing.segments)
    allWords.push(...timing.words)
  }
  return { segments: allSegments, words: allWords }
}

export function discoverLocales(bookId: string): string[] {
  const localesDir = path.join(DATA_DIR, bookId, "template", "locales")
  if (!fs.existsSync(localesDir)) return []
  return fs.readdirSync(localesDir)
    .filter((f) => f.endsWith(".toml"))
    .map((f) => f.replace(".toml", ""))
}
