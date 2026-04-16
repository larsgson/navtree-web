import { atom, computed } from "nanostores"
import type { PageTiming } from "../lib/types"

export interface SegmentEntry {
  pageId: string
  paragraphIndex: number
  startTime: number
  endTime: number
  sectionIndex: number
  imageUrl?: string | null
}

export type AudioPlayState = "idle" | "playing"

export interface PausedState {
  segmentIdx: number
}

export const $audioPlayState = atom<AudioPlayState>("idle")
export const $currentSegmentIdx = atom<number>(0)
export const $currentWordIdx = atom<number>(-1)
export const $currentParagraphInSegment = atom<number>(0)
export const $segmentEntries = atom<SegmentEntry[]>([])
export const $pausedState = atom<PausedState | null>(null)
export const $audioUnlocked = atom<boolean>(false)
export const $playerVisible = atom<boolean>(false)
export const $playerCardInfo = atom<{ title: string; imageUrl: string | null }>({
  title: "\u2014",
  imageUrl: null,
})
export const $focusMode = atom<boolean>(false)
export const $audioPagePath = atom<string>("")
export const $audioToast = atom<string>("")

export const $isPlaying = computed($audioPlayState, (s) => s !== "idle")

let audioContext: {
  bookId: string
  categoryId: string
  audioUrl: string
  allTimings: Record<string, PageTiming>
} | null = null

let audioEl: HTMLAudioElement | null = null
let audioSrc = ""

function getAudio(): HTMLAudioElement {
  if (!audioEl) {
    audioEl = new Audio()
    audioEl.addEventListener("error", () => {
      if ($audioPlayState.get() !== "idle") stopAll()
    })
    audioEl.addEventListener("timeupdate", onTimeUpdate)
  }
  return audioEl
}

function seekAndPlay(url: string, startTime: number): Promise<void> {
  const el = getAudio()
  if (audioSrc === url) {
    el.currentTime = startTime
    return el.play().catch(() => {})
  } else {
    audioSrc = url
    el.src = url
    return new Promise<void>((resolve, reject) => {
      el.addEventListener("canplay", function onCanPlay() {
        el.removeEventListener("canplay", onCanPlay)
        el.currentTime = startTime
        el.play().then(resolve).catch(reject)
      })
    })
  }
}

export function preloadAudio(url: string) {
  if (!url) return
  // Don't touch the audio element — iOS requires play() in a user gesture.
  // Instead, use a throwaway Audio to warm the browser's HTTP cache.
  const tmp = new Audio()
  tmp.preload = "auto"
  tmp.src = url
  tmp.load()
}

function onTimeUpdate() {
  if ($audioPlayState.get() !== "playing") return
  const entries = $segmentEntries.get()
  if (!entries.length || !audioEl) return

  const currentTime = audioEl.currentTime
  const idx = $currentSegmentIdx.get()
  const entry = entries[idx]
  if (!entry) return

  if (currentTime >= entry.endTime) {
    const nextIdx = idx + 1
    if (nextIdx < entries.length) {
      advanceSegment(nextIdx)
    } else {
      stopAll()
    }
    return
  }

  if (audioContext?.allTimings) {
    const timing = audioContext.allTimings[entry.pageId]
    if (timing?.words?.[entry.paragraphIndex]) {
      const wordTimestamps = timing.words[entry.paragraphIndex]
      let wordIdx = -1
      for (let i = wordTimestamps.length - 1; i >= 0; i--) {
        if (currentTime >= wordTimestamps[i]) {
          wordIdx = i
          break
        }
      }
      if (wordIdx !== $currentWordIdx.get()) {
        $currentWordIdx.set(wordIdx)
      }
    }
  }
}

function advanceSegment(idx: number) {
  const entries = $segmentEntries.get()
  const entry = entries[idx]
  if (!entry) {
    stopAll()
    return
  }
  if (entry.startTime === 0 && entry.endTime === 0) {
    stopAll()
    return
  }
  $currentSegmentIdx.set(idx)
  $currentWordIdx.set(-1)
  $playerCardInfo.set({
    title: `Page ${entry.pageId}`,
    imageUrl: entry.imageUrl || $playerCardInfo.get().imageUrl,
  })
}

export function playSegment(idx: number): Promise<void> {
  const entries = $segmentEntries.get()
  const entry = entries[idx]
  if (!entry || !audioContext?.audioUrl) {
    stopAll()
    return Promise.resolve()
  }

  if (entry.startTime === 0 && entry.endTime === 0) {
    $audioToast.set("No timing available")
    return Promise.resolve()
  }

  $currentSegmentIdx.set(idx)
  $currentWordIdx.set(-1)
  $audioPlayState.set("playing")
  $pausedState.set(null)
  $playerVisible.set(true)

  $playerCardInfo.set({
    title: `Page ${entry.pageId}`,
    imageUrl: entry.imageUrl || $playerCardInfo.get().imageUrl,
  })

  return seekAndPlay(audioContext.audioUrl, entry.startTime)
}

export function pausePlayback() {
  $pausedState.set({ segmentIdx: $currentSegmentIdx.get() })
  getAudio().pause()
  $audioPlayState.set("idle")
}

export function resumePlayback() {
  const paused = $pausedState.get()
  if (!paused) return
  $currentSegmentIdx.set(paused.segmentIdx)
  $audioPlayState.set("playing")
  getAudio().play().catch(() => {})
  $pausedState.set(null)
}

export function stopAll() {
  getAudio().pause()
  $audioPlayState.set("idle")
  $pausedState.set(null)
  $focusMode.set(false)
  $playerVisible.set(false)
  $currentWordIdx.set(-1)
}

export function setAudioForCategory(params: {
  bookId: string
  categoryId: string
  audioUrl: string
  allTimings: Record<string, PageTiming>
  entries: SegmentEntry[]
}): boolean {
  const isSame =
    audioContext &&
    audioContext.bookId === params.bookId &&
    audioContext.categoryId === params.categoryId

  if (!isSame && $audioPlayState.get() !== "idle") {
    getAudio().pause()
    $audioPlayState.set("idle")
    $pausedState.set(null)
    $playerVisible.set(false)
  }

  audioContext = {
    bookId: params.bookId,
    categoryId: params.categoryId,
    audioUrl: params.audioUrl,
    allTimings: params.allTimings,
  }

  $segmentEntries.set(params.entries)

  if (isSame && ($audioPlayState.get() !== "idle" || $pausedState.get())) {
    return true
  }

  return false
}

export function unlockAudio() {
  if ($audioUnlocked.get()) return
  $audioUnlocked.set(true)

  const sr = 44100
  const n = 441
  const buf = new ArrayBuffer(44 + n * 2)
  const v = new DataView(buf)
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i))
  }
  w(0, "RIFF")
  v.setUint32(4, 36 + n * 2, true)
  w(8, "WAVE")
  w(12, "fmt ")
  v.setUint32(16, 16, true)
  v.setUint16(20, 1, true)
  v.setUint16(22, 1, true)
  v.setUint32(24, sr, true)
  v.setUint32(28, sr * 2, true)
  v.setUint16(32, 2, true)
  v.setUint16(34, 16, true)
  w(36, "data")
  v.setUint32(40, n * 2, true)
  const blob = new Blob([buf], { type: "audio/wav" })
  const url = URL.createObjectURL(blob)

  // Unlock the actual audio element within the user gesture — iOS requires
  // play() on the same element that will be used for real playback.
  const el = getAudio()
  el.src = url
  el.play().then(() => el.pause()).catch(() => {})
  // Do NOT clear .src — it would race with seekAndPlay if triggered on the same gesture.
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
