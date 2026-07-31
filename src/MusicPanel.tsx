import {
  type CSSProperties,
  useCallback,
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
type EmbedState =
  | 'ready'
  | 'requesting'
  | 'playing'
  | 'paused'

export type OverlayPhase = 'closed' | 'entering' | 'open' | 'closing'

type MusicPanelProps = {
  isMobile: boolean
  onClose: () => void
  open: boolean
  phase: OverlayPhase
}

type SpotifyEmbedEvent = {
  data?: {
    duration?: number
    isBuffering?: boolean
    isPaused?: boolean
    playingURI?: string
    position?: number
  }
}

type SpotifyEmbedController = {
  addListener: (
    event: 'ready' | 'playback_started' | 'playback_update',
    listener: (event: SpotifyEmbedEvent) => void,
  ) => void
  destroy: () => void
  loadEntity: (
    spotifyUriOrUrl: string,
    preferVideo?: boolean,
    startAt?: number,
  ) => void
  pause: () => void
  play: () => void
}

type SpotifyIframeApi = {
  createController: (
    element: HTMLElement,
    options: {
      height: number
      uri?: string
      url?: string
      width: string
    },
    callback: (controller: SpotifyEmbedController) => void,
  ) => void
}

declare global {
  interface Window {
    __kendrickSpotifyIframeApi?: SpotifyIframeApi
    onSpotifyIframeApiReady?: (api: SpotifyIframeApi) => void
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_SPOTIFY_API_BASE_URL || 'http://localhost:8080'
).replace(/\/+$/, '')
const spotifyIframeScriptId = 'spotify-iframe-api'
const spotifyIframeScriptUrl = 'https://open.spotify.com/embed/iframe-api/v1'
const spotifyEmbedHeight = 152
const playbackFallbackDelay = 3200
const spotifyReadyFallbackDelay = 8000

const reportMusicPlayerError = (message: string, error?: unknown) => {
  if (error === undefined) {
    console.error('[music-player]', message)
    return
  }

  console.error('[music-player]', message, error)
}

let spotifyIframeApiPromise: Promise<SpotifyIframeApi> | null = null

const loadSpotifyIframeApi = () => {
  if (window.__kendrickSpotifyIframeApi) {
    return Promise.resolve(window.__kendrickSpotifyIframeApi)
  }

  if (spotifyIframeApiPromise) return spotifyIframeApiPromise

  spotifyIframeApiPromise = new Promise<SpotifyIframeApi>((resolve, reject) => {
    const previousReadyHandler = window.onSpotifyIframeApiReady

    window.onSpotifyIframeApiReady = (api) => {
      window.__kendrickSpotifyIframeApi = api
      resolve(api)
      previousReadyHandler?.(api)
    }

    const existingScript = document.getElementById(spotifyIframeScriptId)
    if (existingScript) {
      existingScript.remove()
    }

    const script = document.createElement('script')
    script.id = spotifyIframeScriptId
    script.src = spotifyIframeScriptUrl
    script.async = true
    script.addEventListener('error', () => {
      spotifyIframeApiPromise = null
      reject(new Error('Spotify iFrame API failed to load'))
    }, { once: true })
    document.body.appendChild(script)
  })

  return spotifyIframeApiPromise
}

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

const playbackSource = (item: PlayableItem) => item.uri || item.spotifyUrl

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

function FeaturedCard({
  embedReady,
  embedState,
  item,
  live,
  onPause,
  onPlay,
}: {
  embedReady: boolean
  embedState: EmbedState
  item: PlayableItem
  live: boolean
  onPause: () => void
  onPlay: () => void
}) {
  const className =
    'music-feature-card music-motion-item music-data-reveal'
  const style = motionStyle(3)
  const playbackAvailable = live && Boolean(playbackSource(item))
  const playbackPending = embedState === 'requesting'
  const playbackActive = embedState === 'playing'

  return (
    <div className={className} style={style}>
      <span className="music-feature-artwork-shell">
        <ArtworkView className="music-feature-artwork" item={item} />
        {playbackAvailable && (
          <button
            className="music-artwork-control"
            type="button"
            aria-label={`${playbackActive ? 'Pause' : 'Play'} ${item.name}`}
            disabled={!embedReady || playbackPending}
            onClick={playbackActive ? onPause : onPlay}
          >
            <span
              className={`music-artwork-playback-icon${
                playbackPending
                  ? ' is-loading'
                  : playbackActive
                    ? ' is-pause'
                    : ' is-play'
              }`}
              aria-hidden="true"
            />
          </button>
        )}
      </span>

      <span className="music-feature-copy">
        {item.spotifyUrl ? (
          <a
            className="music-feature-title"
            href={item.spotifyUrl}
            target="_blank"
            rel="noreferrer"
          >
            <strong>{item.name}</strong>
          </a>
        ) : (
          <strong>{item.name}</strong>
        )}
        <span>{artistLine(item)}</span>
        {collectionLine(item) && (
          <span className="music-collection">{collectionLine(item)}</span>
        )}
      </span>
    </div>
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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [embedReady, setEmbedReady] = useState(false)
  const [embedState, setEmbedState] = useState<EmbedState>('ready')
  const [recommendations, setRecommendations] =
    useState<RecommendationsResponse | null>(null)
  const [recommendationsState, setRecommendationsState] =
    useState<LoadState>('loading')
  const initialLoadCompleteRef = useRef(false)
  const panelRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const embedEngineRef = useRef<HTMLDivElement | null>(null)
  const embedHostRef = useRef<HTMLDivElement | null>(null)
  const embedControllerRef = useRef<SpotifyEmbedController | null>(null)
  const playbackFallbackTimerRef = useRef<number | null>(null)
  const followUpRefreshTimerRef = useRef<number | null>(null)
  const followUpAbortRef = useRef<AbortController | null>(null)
  const refreshCurrentlyPlayingRef = useRef<() => void>(() => undefined)
  const autoFollowEnabledRef = useRef(false)
  const controllerReadyRef = useRef(false)
  const endRefreshInFlightRef = useRef(false)
  const loadedItemIdRef = useRef<string | null>(null)
  const lastPlaybackDurationRef = useRef(0)
  const lastPlaybackPositionRef = useRef(0)
  const playbackHasStartedRef = useRef(false)
  const playbackSessionStartedRef = useRef(false)
  const programmaticStartPendingRef = useRef(false)
  const pendingUserPlaybackRef = useRef(false)
  const featuredRef = useRef<FeaturedItem | null>(featured)

  useEffect(() => {
    featuredRef.current = featured
  }, [featured])

  const clearPlaybackFallback = useCallback(() => {
    if (playbackFallbackTimerRef.current === null) return

    window.clearTimeout(playbackFallbackTimerRef.current)
    playbackFallbackTimerRef.current = null
  }, [])

  const clearFollowUpRefresh = useCallback(() => {
    if (followUpRefreshTimerRef.current !== null) {
      window.clearTimeout(followUpRefreshTimerRef.current)
      followUpRefreshTimerRef.current = null
    }

    followUpAbortRef.current?.abort()
    followUpAbortRef.current = null
    endRefreshInFlightRef.current = false
  }, [])

  const prepareLivePlayback = useCallback((nextFeatured: FeaturedItem) => {
    const controller = embedControllerRef.current
    if (!controller || nextFeatured.mode !== 'live') return false

    const source = playbackSource(nextFeatured.item)
    if (!source) {
      reportMusicPlayerError('The live item does not have a Spotify source.')
      setEmbedState('ready')
      return false
    }

    controller.loadEntity(source, false, 0)
    loadedItemIdRef.current = nextFeatured.item.id
    lastPlaybackDurationRef.current = 0
    lastPlaybackPositionRef.current = 0
    playbackHasStartedRef.current = false
    return true
  }, [])

  const requestLivePlayback = useCallback((
    requestedFeatured?: FeaturedItem,
  ) => {
    const nextFeatured = requestedFeatured ?? featuredRef.current
    const controller = embedControllerRef.current

    if (nextFeatured?.mode !== 'live') {
      pendingUserPlaybackRef.current = false
      setEmbedState('ready')
      reportMusicPlayerError('Playback was requested without a live track.')
      return
    }

    if (!controller || !controllerReadyRef.current) {
      pendingUserPlaybackRef.current = true
      clearPlaybackFallback()
      setEmbedState('requesting')

      playbackFallbackTimerRef.current = window.setTimeout(() => {
        playbackFallbackTimerRef.current = null
        if (!pendingUserPlaybackRef.current) return

        pendingUserPlaybackRef.current = false
        setEmbedState('ready')
        reportMusicPlayerError(
          'Spotify did not become ready after the album-cover action.',
        )
      }, spotifyReadyFallbackDelay)
      return
    }

    pendingUserPlaybackRef.current = false
    programmaticStartPendingRef.current = true
    if (
      loadedItemIdRef.current !== nextFeatured.item.id &&
      !prepareLivePlayback(nextFeatured)
    ) {
      programmaticStartPendingRef.current = false
      return
    }

    clearPlaybackFallback()
    setEmbedState('requesting')
    controller.play()

    playbackFallbackTimerRef.current = window.setTimeout(() => {
      playbackFallbackTimerRef.current = null
      setEmbedState((currentState) => {
        if (currentState === 'playing') return currentState

        reportMusicPlayerError(
          'Spotify did not confirm playback after the album-cover action.',
        )
        programmaticStartPendingRef.current = false
        return 'ready'
      })
    }, playbackFallbackDelay)
  }, [clearPlaybackFallback, prepareLivePlayback])

  const allowLivePlayback = useCallback(() => {
    autoFollowEnabledRef.current = true
    requestLivePlayback()
  }, [requestLivePlayback])

  const stopAutoFollow = useCallback(() => {
    autoFollowEnabledRef.current = false
    programmaticStartPendingRef.current = false
    clearPlaybackFallback()
    clearFollowUpRefresh()
    setEmbedState('paused')
  }, [clearFollowUpRefresh, clearPlaybackFallback])

  const pauseLivePlayback = useCallback(() => {
    const controller = embedControllerRef.current
    if (!controller) {
      reportMusicPlayerError('Pause was requested without an active player.')
      return
    }

    controller.pause()
    stopAutoFollow()
  }, [stopAutoFollow])

  const scheduleFollowUpRefresh = useCallback((delay: number) => {
    if (!autoFollowEnabledRef.current) return

    if (followUpRefreshTimerRef.current !== null) {
      window.clearTimeout(followUpRefreshTimerRef.current)
    }

    followUpRefreshTimerRef.current = window.setTimeout(() => {
      followUpRefreshTimerRef.current = null
      refreshCurrentlyPlayingRef.current()
    }, delay)
  }, [])

  const refreshCurrentlyPlaying = useCallback(async () => {
    if (
      !autoFollowEnabledRef.current ||
      endRefreshInFlightRef.current
    ) {
      return
    }

    endRefreshInFlightRef.current = true
    setEmbedState('requesting')
    followUpAbortRef.current?.abort()
    const controller = new AbortController()
    followUpAbortRef.current = controller

    try {
      const current = await fetchJson<CurrentlyPlayingResponse>(
        '/currently-playing',
        controller.signal,
      )

      if (!autoFollowEnabledRef.current) return

      if (current.isPlaying && current.item) {
        const nextFeatured: FeaturedItem = {
          item: current.item,
          mode: 'live',
        }

        featuredRef.current = nextFeatured
        setFeatured(nextFeatured)
        setFeaturedState('ready')
        requestLivePlayback(nextFeatured)
        return
      }

      const finishedFeature = featuredRef.current
      if (finishedFeature) {
        const recentFeature: FeaturedItem = {
          ...finishedFeature,
          mode: 'recent',
        }
        featuredRef.current = recentFeature
        setFeatured(recentFeature)
        setFeaturedState('ready')
      } else {
        setFeaturedState('empty')
      }
      setEmbedState('ready')
    } catch (error) {
      if (!isAbortError(error) && autoFollowEnabledRef.current) {
        reportMusicPlayerError(
          'Could not refresh the live track after playback ended.',
          error,
        )
        setEmbedState('ready')
        scheduleFollowUpRefresh(5000)
      }
    } finally {
      if (followUpAbortRef.current === controller) {
        followUpAbortRef.current = null
      }
      endRefreshInFlightRef.current = false
    }
  }, [requestLivePlayback, scheduleFollowUpRefresh])

  useEffect(() => {
    refreshCurrentlyPlayingRef.current = () => {
      void refreshCurrentlyPlaying()
    }
  }, [refreshCurrentlyPlaying])

  useEffect(() => {
    if (!open) return

    const controller = new AbortController()
    const { signal } = controller
    const isInitialLoad = !initialLoadCompleteRef.current

    const loadFeatured = async () => {
      try {
        const current = await fetchJson<CurrentlyPlayingResponse>(
          '/currently-playing',
          signal,
        )

        if (current.isPlaying && current.item) {
          const nextFeatured: FeaturedItem = {
            item: current.item,
            mode: 'live',
          }
          const existingFeature = featuredRef.current

          if (
            playbackSessionStartedRef.current &&
            existingFeature?.mode === 'live' &&
            existingFeature.item.id === nextFeatured.item.id
          ) {
            setFeaturedState('ready')
            return
          }

          featuredRef.current = nextFeatured
          setFeatured(nextFeatured)
          setFeaturedState('ready')
          return
        }

        if (playbackHasStartedRef.current) {
          setFeaturedState('ready')
          return
        }
      } catch (error) {
        if (isAbortError(error)) return
        reportMusicPlayerError(
          'Could not load the currently playing item.',
          error,
        )
        if (playbackHasStartedRef.current) {
          setFeaturedState('ready')
          return
        }
      }

      try {
        const recent = await fetchJson<RecentlyPlayedResponse>(
          '/recently-played',
          signal,
        )
        const latestItem = Array.isArray(recent.items) ? recent.items[0] : null

        if (latestItem) {
          const nextFeatured: FeaturedItem = {
            item: latestItem,
            mode: 'recent',
          }
          featuredRef.current = nextFeatured
          setFeatured(nextFeatured)
          setFeaturedState('ready')
        } else {
          featuredRef.current = null
          setFeatured(null)
          setFeaturedState('empty')
        }
      } catch (error) {
        if (!isAbortError(error)) {
          reportMusicPlayerError(
            'Could not load the recently played fallback.',
            error,
          )
          if (isInitialLoad) {
            setFeaturedState('error')
          }
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
          reportMusicPlayerError(
            'Could not load music recommendations.',
            error,
          )
          if (isInitialLoad) {
            setRecommendationsState('error')
          }
        }
      }
    }

    const loadPanel = async () => {
      await Promise.all([
        loadFeatured(),
        loadRecommendations(),
      ])

      if (signal.aborted || !isInitialLoad) return

      initialLoadCompleteRef.current = true
      setInitialLoadComplete(true)
    }

    queueMicrotask(() => {
      if (signal.aborted) return

      if (isInitialLoad && !playbackSessionStartedRef.current) {
        featuredRef.current = null
        setFeatured(null)
        setFeaturedState('loading')
      }
      if (isInitialLoad) {
        setRecommendations(null)
        setRecommendationsState('loading')
      }
      void loadPanel()
    })

    return () => controller.abort()
  }, [open])

  const livePlayerAvailable =
    featuredState === 'ready' &&
    featured?.mode === 'live' &&
    Boolean(playbackSource(featured.item))

  useEffect(() => {
    if (!livePlayerAvailable || !embedHostRef.current) return

    const initialFeatured = featuredRef.current
    if (!initialFeatured || initialFeatured.mode !== 'live') return

    const source = playbackSource(initialFeatured.item)
    if (!source) {
      reportMusicPlayerError('The live item does not have a Spotify source.')
      queueMicrotask(() => setEmbedState('ready'))
      return
    }

    let active = true
    const host = embedHostRef.current
    setEmbedReady(false)

    void loadSpotifyIframeApi()
      .then((api) => {
        if (!active) return

        const contentOption = initialFeatured.item.uri
          ? { uri: initialFeatured.item.uri }
          : { url: source }

        api.createController(
          host,
          {
            ...contentOption,
            width: '100%',
            height: spotifyEmbedHeight,
          },
          (controller) => {
            if (!active) {
              controller.destroy()
              return
            }

            embedControllerRef.current = controller
            // createController has already loaded this track at its beginning.
            // Reloading it here leaves the Embed between entities when Play runs.
            loadedItemIdRef.current = initialFeatured.item.id
            const configureEmbedFrame = () => {
              const embedFrame =
                embedEngineRef.current?.querySelector<HTMLIFrameElement>(
                  'iframe',
                )
              if (!embedFrame) return

              embedFrame.tabIndex = -1
              embedFrame.setAttribute(
                'allow',
                'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
              )
            }
            configureEmbedFrame()

            controller.addListener('ready', () => {
              if (!active) return

              controllerReadyRef.current = true
              setEmbedReady(true)
              configureEmbedFrame()

              const currentFeature = featuredRef.current
              if (!currentFeature || currentFeature.mode !== 'live') return

              if (currentFeature.item.id !== loadedItemIdRef.current) {
                prepareLivePlayback(currentFeature)
              }

              const playbackWasRequested =
                pendingUserPlaybackRef.current ||
                autoFollowEnabledRef.current

              if (playbackWasRequested) {
                requestLivePlayback(currentFeature)
              } else {
                setEmbedState(
                  playbackSessionStartedRef.current
                    ? 'paused'
                    : 'ready',
                )
              }
            })

            controller.addListener('playback_started', () => {
              if (!active) return

              clearPlaybackFallback()
              programmaticStartPendingRef.current = false
              autoFollowEnabledRef.current = true
              playbackHasStartedRef.current = true
              playbackSessionStartedRef.current = true
              setEmbedState('playing')
            })

            controller.addListener('playback_update', (event) => {
              if (!active) return

              const {
                duration = 0,
                isBuffering = false,
                isPaused,
                position = 0,
              } = event.data ?? {}
              const previousDuration = lastPlaybackDurationRef.current
              const previousPosition = lastPlaybackPositionRef.current
              const effectiveDuration = duration || previousDuration
              const reachedEnd = effectiveDuration > 0 && (
                position >= effectiveDuration - 250 ||
                (
                  isPaused === true &&
                  previousPosition >= effectiveDuration - 1500
                )
              )

              lastPlaybackDurationRef.current = duration
              lastPlaybackPositionRef.current = position

              if (
                autoFollowEnabledRef.current &&
                playbackHasStartedRef.current &&
                reachedEnd
              ) {
                playbackHasStartedRef.current = false
                programmaticStartPendingRef.current = false
                setEmbedState('requesting')
                void refreshCurrentlyPlaying()
                return
              }

              if (isPaused === false && !isBuffering) {
                programmaticStartPendingRef.current = false
                autoFollowEnabledRef.current = true
                playbackHasStartedRef.current = true
                playbackSessionStartedRef.current = true
                setEmbedState('playing')
                return
              }

              if (
                isPaused === true &&
                !isBuffering &&
                playbackHasStartedRef.current &&
                !programmaticStartPendingRef.current
              ) {
                stopAutoFollow()
              }
            })
          },
        )
      })
      .catch((error) => {
        if (!active) return

        pendingUserPlaybackRef.current = false
        clearPlaybackFallback()
        setEmbedReady(false)
        reportMusicPlayerError('Could not initialize Spotify playback.', error)
        setEmbedState('ready')
      })

    return () => {
      active = false
      clearPlaybackFallback()
      pendingUserPlaybackRef.current = false
      controllerReadyRef.current = false
      setEmbedReady(false)
      loadedItemIdRef.current = null
      lastPlaybackDurationRef.current = 0
      lastPlaybackPositionRef.current = 0
      playbackHasStartedRef.current = false
      embedControllerRef.current?.destroy()
      embedControllerRef.current = null
    }
  }, [
    clearPlaybackFallback,
    livePlayerAvailable,
    prepareLivePlayback,
    refreshCurrentlyPlaying,
    requestLivePlayback,
    stopAutoFollow,
  ])

  useEffect(() => {
    if (
      !livePlayerAvailable ||
      !controllerReadyRef.current ||
      featured?.mode !== 'live' ||
      loadedItemIdRef.current === featured.item.id
    ) {
      return
    }

    if (autoFollowEnabledRef.current) {
      requestLivePlayback(featured)
    } else {
      prepareLivePlayback(featured)
      setEmbedState(
        playbackSessionStartedRef.current ? 'paused' : 'ready',
      )
    }
  }, [
    featured,
    livePlayerAvailable,
    prepareLivePlayback,
    requestLivePlayback,
  ])

  useEffect(() => () => {
    clearPlaybackFallback()
    clearFollowUpRefresh()
  }, [clearFollowUpRefresh, clearPlaybackFallback])

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

  const live = featured?.mode === 'live'
  const statusLabel = live ? 'Live' : 'Offline'
  const statusClassName =
    featuredState === 'loading'
      ? 'is-checking'
      : live
        ? 'is-live'
        : 'is-offline'

  return (
    <>
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
          className={`music-panel${
            initialLoadComplete ? '' : ' is-initial-loading'
          }`}
          id="music-panel"
          role="dialog"
          aria-busy={!initialLoadComplete}
          aria-label={!initialLoadComplete ? 'Kendrick’s Player' : undefined}
          aria-labelledby={
            initialLoadComplete ? 'music-panel-title' : undefined
          }
          aria-modal={isMobile ? true : undefined}
          tabIndex={-1}
        >
          <span className="music-panel-frame" aria-hidden="true" />

          <header className="music-panel-header">
            {initialLoadComplete && (
              <div
                className="music-motion-item music-data-reveal"
                style={motionStyle(0)}
              >
                <p>Personal soundtrack</p>
                <h2 id="music-panel-title">Kendrick’s Player</h2>
              </div>
            )}
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

          {!initialLoadComplete && (
            <div
              className="music-panel-loading"
              role="status"
              aria-live="polite"
            >
              <span className="music-panel-spinner" aria-hidden="true" />
              <span className="sr-only">Loading music player</span>
            </div>
          )}

          {initialLoadComplete && (
            <>
              <section
                className="music-feature"
                aria-labelledby="music-feature-title"
              >
                <div
                  className={`music-status ${statusClassName} music-motion-item music-data-reveal`}
                  role="status"
                  aria-live="polite"
                  style={motionStyle(1)}
                >
                  <span className="music-status-dot" aria-hidden="true" />
                  <span>{statusLabel}</span>
                </div>
                <h3
                  className="music-motion-item music-data-reveal"
                  id="music-feature-title"
                  style={motionStyle(2)}
                >
                  {live ? 'Now playing' : 'Recently played'}
                </h3>

                {featuredState === 'ready' && featured && (
                  <FeaturedCard
                    embedReady={embedReady}
                    embedState={embedState}
                    item={featured.item}
                    live={featured.mode === 'live'}
                    onPause={pauseLivePlayback}
                    onPlay={allowLivePlayback}
                  />
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
              >
                <div
                  className="music-recommendations-header music-motion-item music-data-reveal"
                  style={motionStyle(4)}
                >
                  <h3 id="music-recommendations-title">
                    Kendrick’s Recommendations
                  </h3>
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
            </>
          )}
        </section>
      </div>

      {featuredState === 'ready' &&
        featured?.mode === 'live' &&
        playbackSource(featured.item) && (
          <div
            className="music-embed-engine"
            ref={embedEngineRef}
            aria-hidden="true"
          >
            <div ref={embedHostRef} />
          </div>
        )}
    </>
  )
}
