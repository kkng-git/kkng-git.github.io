import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from 'react'

type SpotifyLink = {
  spotifyUrl: string | null
}

type Artist = SpotifyLink & {
  id: string | null
  name: string
}

type Artwork = {
  url: string
  width: number | null
  height: number | null
}

type PlayableItem = SpotifyLink & {
  type: 'track' | 'episode'
  id: string
  name: string
  artists: Artist[]
  album: (SpotifyLink & {
    id: string | null
    name: string | null
  }) | null
  show: (SpotifyLink & {
    id: string | null
    name: string | null
  }) | null
  artwork: Artwork | null
  durationMs: number | null
  explicit: boolean
  uri: string | null
}

type CurrentlyPlayingResponse = {
  isPlaying: boolean
  item: PlayableItem | null
  progressMs: number | null
  fetchedAt: string
}

type RecentlyPlayedItem = PlayableItem & {
  playedAt: string | null
}

type RecentlyPlayedResponse = {
  items: RecentlyPlayedItem[]
  fetchedAt: string
}

type RecommendationsResponse = {
  source: SpotifyLink & {
    type: 'playlist'
    id: string
  }
  items: PlayableItem[]
  fetchedAt: string
}

type FeaturedItem = {
  item: PlayableItem
  mode: 'live' | 'recent'
}

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export type OverlayPhase = 'closed' | 'entering' | 'open' | 'closing'

type MusicPanelProps = {
  isMobile: boolean
  onClose: () => void
  open: boolean
  phase: OverlayPhase
}

const apiBaseUrl = (
  import.meta.env.VITE_SPOTIFY_API_BASE_URL || 'http://localhost:8080'
).replace(/\/+$/, '')

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type MotionStyle = CSSProperties & {
  '--motion-delay': string
  '--motion-exit-delay': string
  '--motion-data-delay': string
}

const maximumMotionOrder = 6

const motionStyle = (order: number): MotionStyle => {
  const safeOrder = Math.min(Math.max(order, 0), maximumMotionOrder)

  return {
    '--motion-delay': `${40 + safeOrder * 32}ms`,
    '--motion-exit-delay': `${(maximumMotionOrder - safeOrder) * 16}ms`,
    '--motion-data-delay': `${Math.max(0, safeOrder - 3) * 16}ms`,
  }
}

const fetchJson = async <ResponseType,>(
  path: string,
  signal: AbortSignal,
): Promise<ResponseType> => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Music API request failed with status ${response.status}`)
  }

  return response.json() as Promise<ResponseType>
}

const isAbortError = (error: unknown) =>
  error instanceof DOMException && error.name === 'AbortError'

const artistLine = (item: PlayableItem) => {
  if (item.type === 'episode') {
    return item.show?.name || 'Spotify podcast'
  }

  return item.artists.map((artist) => artist.name).filter(Boolean).join(', ') ||
    'Unknown artist'
}

const collectionLine = (item: PlayableItem) =>
  item.type === 'episode' ? item.show?.name : item.album?.name

function ArtworkView({
  className,
  item,
}: {
  className: string
  item: PlayableItem
}) {
  if (!item.artwork?.url) {
    return (
      <span className={`${className} music-artwork-placeholder`} aria-hidden="true">
        ♪
      </span>
    )
  }

  return (
    <img
      className={className}
      src={item.artwork.url}
      alt=""
      width={item.artwork.width ?? 640}
      height={item.artwork.height ?? 640}
      loading="lazy"
    />
  )
}

function FeaturedCard({ item }: { item: PlayableItem }) {
  const className =
    'music-feature-card music-motion-item music-data-reveal'
  const style = motionStyle(3)
  const content = (
    <>
      <ArtworkView className="music-feature-artwork" item={item} />
      <span className="music-feature-copy">
        <strong>{item.name}</strong>
        <span>{artistLine(item)}</span>
        {collectionLine(item) && (
          <span className="music-collection">{collectionLine(item)}</span>
        )}
        <span className="music-open-label">Open on Spotify ↗</span>
      </span>
    </>
  )

  if (!item.spotifyUrl) {
    return <div className={className} style={style}>{content}</div>
  }

  return (
    <a
      className={className}
      href={item.spotifyUrl}
      target="_blank"
      rel="noreferrer"
      style={style}
    >
      {content}
    </a>
  )
}

function RecommendationRow({
  index,
  item,
}: {
  index: number
  item: PlayableItem
}) {
  const className =
    'music-recommendation-row music-motion-item music-data-reveal'
  const style = motionStyle(5 + index)
  const content = (
    <>
      <ArtworkView className="music-recommendation-artwork" item={item} />
      <span className="music-recommendation-copy">
        <strong>{item.name}</strong>
        <span>{artistLine(item)}</span>
      </span>
      <span className="music-row-arrow" aria-hidden="true">↗</span>
    </>
  )

  if (!item.spotifyUrl) {
    return <div className={className} style={style}>{content}</div>
  }

  return (
    <a
      className={className}
      href={item.spotifyUrl}
      target="_blank"
      rel="noreferrer"
      style={style}
    >
      {content}
    </a>
  )
}

export default function MusicPanel({
  isMobile,
  onClose,
  open,
  phase,
}: MusicPanelProps) {
  const [featured, setFeatured] = useState<FeaturedItem | null>(null)
  const [featuredState, setFeaturedState] = useState<LoadState>('loading')
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null)
  const [recommendationsState, setRecommendationsState] =
    useState<LoadState>('loading')
  const panelRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const { signal } = controller

    const loadFeatured = async () => {
      try {
        const current = await fetchJson<CurrentlyPlayingResponse>(
          '/currently-playing',
          signal,
        )

        if (current.isPlaying && current.item) {
          setFeatured({ item: current.item, mode: 'live' })
          setFeaturedState('ready')
          return
        }
      } catch (error) {
        if (isAbortError(error)) return
      }

      try {
        const recent = await fetchJson<RecentlyPlayedResponse>(
          '/recently-played',
          signal,
        )
        const latestItem = Array.isArray(recent.items) ? recent.items[0] : null

        if (latestItem) {
          setFeatured({ item: latestItem, mode: 'recent' })
          setFeaturedState('ready')
        } else {
          setFeaturedState('empty')
        }
      } catch (error) {
        if (!isAbortError(error)) {
          setFeaturedState('error')
        }
      }
    }

    const loadRecommendations = async () => {
      try {
        const response = await fetchJson<RecommendationsResponse>(
          '/recommendations',
          signal,
        )

        setRecommendations(response)
        setRecommendationsState(
          Array.isArray(response.items) && response.items.length > 0
            ? 'ready'
            : 'empty',
        )
      } catch (error) {
        if (!isAbortError(error)) {
          setRecommendationsState('error')
        }
      }
    }

    queueMicrotask(() => {
      if (signal.aborted) return

      setFeatured(null)
      setFeaturedState('loading')
      setRecommendations(null)
      setRecommendationsState('loading')
      void loadFeatured()
      void loadRecommendations()
    })

    return () => controller.abort()
  }, [open])

  useEffect(() => {
    if (phase !== 'closed' || open) return

    queueMicrotask(() => {
      setFeatured(null)
      setFeaturedState('loading')
      setRecommendations(null)
      setRecommendationsState('loading')
    })
  }, [open, phase])

  useEffect(() => {
    if (!open) return

    const frame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [open])

  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        return
      }

      if (!isMobile || event.key !== 'Tab') return

      const focusableElements = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [],
      ).filter((element) => !element.hasAttribute('disabled'))

      if (focusableElements.length === 0) {
        event.preventDefault()
        panelRef.current?.focus()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]
      const activeElement = document.activeElement

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, onClose, open])

  if (phase === 'closed') return null

  const live = featured?.mode === 'live'
  const statusLabel = live ? 'Live' : 'Offline'
  const statusClassName =
    featuredState === 'loading'
      ? 'is-checking'
      : live
        ? 'is-live'
        : 'is-offline'

  return (
    <div
      className={`music-layer is-${phase}`}
      aria-hidden={!open ? true : undefined}
      inert={!open ? true : undefined}
    >
      <div
        className="music-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />

      <section
        ref={panelRef}
        className="music-panel"
        id="music-panel"
        role="dialog"
        aria-labelledby="music-panel-title"
        aria-modal={isMobile ? true : undefined}
        tabIndex={-1}
      >
        <span className="music-panel-frame" aria-hidden="true" />

        <header className="music-panel-header">
          <div className="music-motion-item" style={motionStyle(0)}>
            <p>Personal soundtrack</p>
            <h2 id="music-panel-title">Kendrick’s Player</h2>
          </div>
          <button
            ref={closeButtonRef}
            className="music-close-button music-motion-item"
            type="button"
            onClick={onClose}
            style={motionStyle(1)}
          >
            Close
          </button>
        </header>

        <section
          className="music-feature"
          aria-labelledby="music-feature-title"
          aria-busy={featuredState === 'loading'}
        >
          <div
            className={`music-status ${statusClassName} music-motion-item`}
            role="status"
            aria-live="polite"
            style={motionStyle(1)}
          >
            <span className="music-status-dot" aria-hidden="true" />
            <span>{statusLabel}</span>
          </div>
          <h3
            className="music-motion-item"
            id="music-feature-title"
            style={motionStyle(2)}
          >
            {live ? 'Now playing' : 'Recently played'}
          </h3>

          {featuredState === 'loading' && (
            <div
              className="music-feature-skeleton music-motion-item"
              aria-hidden="true"
              style={motionStyle(3)}
            >
              <span />
              <span>
                <i />
                <i />
                <i />
              </span>
            </div>
          )}

          {featuredState === 'ready' && featured && (
            <FeaturedCard item={featured.item} />
          )}

          {featuredState === 'empty' && (
            <p
              className="music-empty-state music-motion-item music-data-reveal"
              style={motionStyle(3)}
            >
              No recent listening history is available right now.
            </p>
          )}

          {featuredState === 'error' && (
            <p
              className="music-empty-state music-motion-item music-data-reveal"
              style={motionStyle(3)}
            >
              Listening activity is temporarily unavailable.
            </p>
          )}
        </section>

        <section
          className="music-recommendations"
          aria-labelledby="music-recommendations-title"
          aria-busy={recommendationsState === 'loading'}
        >
          <div
            className="music-recommendations-header music-motion-item"
            style={motionStyle(4)}
          >
            <h3 id="music-recommendations-title">Kendrick’s Recommendations</h3>
            {recommendations?.source.spotifyUrl && (
              <a
                href={recommendations.source.spotifyUrl}
                target="_blank"
                rel="noreferrer"
              >
                Playlist ↗
              </a>
            )}
          </div>

          <div
            className="music-recommendations-list"
            tabIndex={recommendationsState === 'ready' ? 0 : -1}
            aria-label="Kendrick’s Spotify recommendations"
          >
            {recommendationsState === 'loading' && [0, 1, 2, 3].map((index) => (
              <div
                className="music-row-skeleton music-motion-item"
                key={index}
                aria-hidden="true"
                style={motionStyle(5 + index)}
              >
                <span />
                <span>
                  <i />
                  <i />
                </span>
              </div>
            ))}

            {recommendationsState === 'ready' &&
              recommendations?.items.map((item, index) => (
                <RecommendationRow
                  index={index}
                  item={item}
                  key={item.id}
                />
              ))}

            {recommendationsState === 'empty' && (
              <p
                className="music-empty-state music-motion-item music-data-reveal"
                style={motionStyle(5)}
              >
                No recommendations are available right now.
              </p>
            )}

            {recommendationsState === 'error' && (
              <p
                className="music-empty-state music-motion-item music-data-reveal"
                style={motionStyle(5)}
              >
                Recommendations are temporarily unavailable.
              </p>
            )}
          </div>
        </section>
      </section>
    </div>
  )
}
