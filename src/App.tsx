import {
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type UIEvent as ReactUIEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import cafeWorkspace from './assets/images/cafe-grind-workspace.jpeg'
import portrait from './assets/images/kendrick-portrait.jpg'
import raceCarGraduation from './assets/images/kendrick-race-car-graduation.jpg'
import './App.css'

const resume = '/documents/kendrick-ng-resume.pdf'

const pages = [
  { id: 'top', label: 'Home', headingId: 'hero-title' },
  { id: 'about', label: 'About', headingId: 'about-title' },
  { id: 'experience', label: 'Experience', headingId: 'experience-title' },
  { id: 'projects', label: 'Projects', headingId: 'projects-title' },
  { id: 'contact', label: 'Contact', headingId: 'contact-title' },
] as const

type PageId = (typeof pages)[number]['id']
type HistoryMode = 'none' | 'push' | 'replace'
type PagePosition = 'top' | 'bottom' | 'preserve'

const navigation = pages.slice(1)
const wheelEdgeTolerance = 4
const touchThreshold = 40
const edgeTolerance = 1
const transitionDuration = 480
const transitionGuard = 100

const pageIndexFromHash = (hash = window.location.hash) => {
  const id = hash.replace('#', '') as PageId
  const index = pages.findIndex((page) => page.id === id)
  return index >= 0 ? index : 0
}

const isInteractiveTarget = (target: EventTarget | null) =>
  target instanceof Element &&
  Boolean(target.closest('a, button, input, select, textarea, summary, [contenteditable="true"]'))

const isAtTopBoundary = (scroller: HTMLElement) =>
  scroller.scrollTop <= edgeTolerance

const isAtBottomBoundary = (scroller: HTMLElement) =>
  scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop <= edgeTolerance

const projectFilters = [
  { key: 'all', label: 'All' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'web-app', label: 'Web/App' },
  { key: 'ai-ml', label: 'AI/ML' },
  { key: 'data', label: 'Data' },
  { key: 'embedded', label: 'Embedded' },
] as const

type ProjectFilter = (typeof projectFilters)[number]['key']
type ProjectTag = Exclude<ProjectFilter, 'all'>
type Project = {
  year: string
  title: string
  category: string
  description: string
  href?: string
  appStoreHref?: string
  tags: ProjectTag[]
}

const projectsPerPage = 3

const principles = [
  {
    number: '01',
    title: 'Who',
    description: "I'm an engineer, and a competitive one at that. I'm detail oriented, and someone who won't settle for less.",
  },
  {
    number: '02',
    title: 'What',
    description: "I solve real problems that my peers and I experience. I build apps for problems I need convenient solutions for. \
                  I look for pain points in the industry and find fixes, designing for reliability and efficiency. I need my users to feel supported.",
  },
  {
    number: '03',
    title: 'Why',
    description: "I'm a modern soul. I'm an enjoyer of online connections and how the Internet changed our world. I fell in love with\
                  the capabilities of tech and how it supports me and those around me. Thus, I pursue software as a way to protect what I love.",
  },
]

const projects: Project[] = [
  {
    year: '2026',
    title: 'Kubernetes-inspect MCP',
    category: 'Python MCP · Docker · KIND',
    description:
      'With the rapid adaptation of AI agents, it is imperative that they can work effectively with industry standard tools. \
      This is a Kubernetes-facing MCP server POC for inspecting pods, deployments, services, and cluster state through production-style debugging workflows.',
    href: 'https://github.com/kkng-git/cluster-inspect-agent',
    tags: ['favorites', 'ai-ml'],
  },
  {
    year: '2026',
    title: 'Loot Me!',
    category: 'VisionKit · SwiftUI · Gemini · Firebase',
    description:
      'A bill-splitting iMessage extension with a custom OCR pipeline for robust receipt text extraction. With this extension, snap a picture and seamlessly split complex bills between one or more Apple contacts!',
    href: 'https://github.com/Joshuliu/loot',
    appStoreHref: 'https://apps.apple.com/us/app/loot-me/id6757330604',
    tags: ['favorites', 'web-app'],
  },
  //{
  //  year: '2024',
  //  title: 'Event Discovery',
  //  category: 'Web application · JavaScript · Flask',
  //  description:
  //    'An API-backed event discovery experience with a browser interface and a lightweight Flask service for search workflows.',
  //  href: 'https://github.com/kkng-git/kkng-Ticketmaster-HW2',
  //  tags: ['web-app'],
  //},
  {
    year: '2025',
    title: 'Hike Review',
    category: 'React Native · TypeScript · Flask · MySQL · GCP',
    description:
      'A mobile trail-discovery platform for exploring Santa Cruz hikes, sharing community reviews, saving favorites, and organizing group outings.',
    href: 'https://github.com/Hike-Review',
    tags: ['favorites', 'web-app'],
  },
  {
    year: '2025',
    title: 'Weenix Kernel',
    category: 'C · Kernel Development · Filesystems · Virtual Memory',
    description:
      'Kernel work in C: wrote the virtual file system layer, set up S5FS, and implemented virtual memory system.',
    tags: ['embedded'],
  },
]

const experience = [
  {
    period: '2026 — Now',
    role: 'Engineering Intern',
    company: 'Tokonoma AI',
    companyHref: 'https://tokonoma.ai',
    description:
      'Developing product MCP tools, enterprise SSO integrations, agent evaluation infrastructure, and continuous integration workflows.',
    detail: 'Reduced token usage by 30% through MCP tool optimization.',
    skills: [
      'Python',
      'MCP',
      'Google SAML SSO',
      'Okta EMA',
      'DevOps',
      'Agent Evaluation',
      'GitHub Actions',
      'Starlette',
      'Uvicorn',
      'PostgreSQL',
    ],
  },
  {
    period: '2022 — 2024',
    role: 'Software Engineering Intern',
    company: 'WideSense Inc.',
    companyHref: 'https://www.linkedin.com/company/widesense/',
    description:
      'Returned for three internship terms, building customer and administrative features across frontend, backend, and database layers.',
    detail: 'Built an IoT analytics dashboard and helped maintain over 80% test coverage.',
    skills: ['Python', 'AngularJS', 'Flask', 'PostgreSQL', 'InfluxDB', 'Jasmine', 'Alembic'],
  },
  {
    period: '2020 — 2022',
    role: 'Engineering Intern',
    company: 'Pluribus Networks',
    companyHref: 'https://www.arista.com/en/support/pluribus-resources',
    description:
      'Built Python performance-test tooling for network switch fabrics and published high-volume stress-test data through Kafka.',
    detail: 'Analyzed Elasticsearch-backed metrics in Kibana and Grafana.',
    skills: ['Python', 'Kafka', 'Elasticsearch', 'Kibana', 'Grafana'],
  },
]

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(pageIndexFromHash)
  const [scrolled, setScrolled] = useState(() => pageIndexFromHash() > 0)
  const [activeProjectFilter, setActiveProjectFilter] =
    useState<ProjectFilter>('favorites')
  const [projectPage, setProjectPage] = useState(1)
  const pageDeckRef = useRef<HTMLElement | null>(null)
  const pageScrollRefs = useRef<Array<HTMLDivElement | null>>([])
  const projectResultsRef = useRef<HTMLDivElement | null>(null)
  const activeIndexRef = useRef(activeIndex)
  const menuOpenRef = useRef(menuOpen)
  const transitioningRef = useRef(false)
  const transitionTimerRef = useRef<number | null>(null)
  const pendingFocusRef = useRef(false)
  const touchGestureRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    startedAtTop: false,
    startedAtBottom: false,
    triggered: false,
  })

  const filteredProjects =
    activeProjectFilter === 'all'
      ? projects
      : projects.filter((project) => project.tags.includes(activeProjectFilter))
  const totalProjectPages = Math.ceil(filteredProjects.length / projectsPerPage)
  const safeProjectPage = Math.min(projectPage, Math.max(1, totalProjectPages))
  const visibleProjects = filteredProjects.slice(
    (safeProjectPage - 1) * projectsPerPage,
    safeProjectPage * projectsPerPage,
  )

  const resetTouchGesture = useCallback(() => {
    touchGestureRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      startedAtTop: false,
      startedAtBottom: false,
      triggered: false,
    }
  }, [])

  const positionPage = useCallback((index: number, position: PagePosition) => {
    if (position === 'preserve') return

    const scroller = pageScrollRefs.current[index]
    if (!scroller) return

    scroller.scrollTop =
      position === 'top' ? 0 : Math.max(0, scroller.scrollHeight - scroller.clientHeight)
  }, [])

  const finishTransition = useCallback(() => {
    transitioningRef.current = false
    if (transitionTimerRef.current !== null) {
      window.clearTimeout(transitionTimerRef.current)
      transitionTimerRef.current = null
    }
  }, [])

  const focusPageHeading = useCallback((index: number) => {
    window.requestAnimationFrame(() => {
      document.getElementById(pages[index].headingId)?.focus({ preventScroll: true })
    })
  }, [])

  const updateHistory = useCallback((index: number, mode: HistoryMode) => {
    if (mode === 'none') return

    const hash = `#${pages[index].id}`
    if (window.location.hash === hash) return

    if (mode === 'push') {
      window.history.pushState(null, '', hash)
    } else {
      window.history.replaceState(null, '', hash)
    }
  }, [])

  const goToPage = useCallback((
    requestedIndex: number,
    options: {
      historyMode?: HistoryMode
      focus?: boolean
      position?: PagePosition
    } = {},
  ) => {
    const targetIndex = Math.max(0, Math.min(pages.length - 1, requestedIndex))
    const {
      historyMode = 'replace',
      focus = false,
      position = 'preserve',
    } = options

    if (targetIndex === activeIndexRef.current) {
      positionPage(targetIndex, position)
      setScrolled(
        targetIndex > 0 || (pageScrollRefs.current[targetIndex]?.scrollTop ?? 0) > 24,
      )
      updateHistory(targetIndex, historyMode)
      if (focus) focusPageHeading(targetIndex)
      return
    }

    finishTransition()
    positionPage(targetIndex, position)
    transitioningRef.current = true
    activeIndexRef.current = targetIndex
    pendingFocusRef.current = focus
    setActiveIndex(targetIndex)
    setScrolled(targetIndex > 0 || (pageScrollRefs.current[targetIndex]?.scrollTop ?? 0) > 24)
    updateHistory(targetIndex, historyMode)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    transitionTimerRef.current = window.setTimeout(
      finishTransition,
      reducedMotion ? transitionGuard : transitionDuration + transitionGuard,
    )
  }, [finishTransition, focusPageHeading, positionPage, updateHistory])

  useEffect(() => {
    activeIndexRef.current = activeIndex
    if (pendingFocusRef.current) {
      pendingFocusRef.current = false
      focusPageHeading(activeIndex)
    }
  }, [activeIndex, focusPageHeading])

  useEffect(() => {
    menuOpenRef.current = menuOpen
  }, [menuOpen])

  useEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    const handleHistoryNavigation = () => {
      goToPage(pageIndexFromHash(), { historyMode: 'none', focus: true })
    }

    window.addEventListener('popstate', handleHistoryNavigation)
    window.addEventListener('hashchange', handleHistoryNavigation)

    return () => {
      window.history.scrollRestoration = previousScrollRestoration
      window.removeEventListener('popstate', handleHistoryNavigation)
      window.removeEventListener('hashchange', handleHistoryNavigation)
    }
  }, [goToPage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menuOpenRef.current) {
        setMenuOpen(false)
        return
      }

      if (
        menuOpenRef.current ||
        event.defaultPrevented ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isInteractiveTarget(event.target)
      ) {
        return
      }

      let direction: 1 | -1
      let distance = 0

      if (event.key === 'ArrowDown') {
        direction = 1
        distance = 52
      } else if (event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey)) {
        direction = 1
      } else if (event.key === 'ArrowUp') {
        direction = -1
        distance = 52
      } else if (event.key === 'PageUp' || (event.key === ' ' && event.shiftKey)) {
        direction = -1
      } else {
        return
      }

      const scroller = pageScrollRefs.current[activeIndexRef.current]
      if (!scroller) return

      const atTop = isAtTopBoundary(scroller)
      const atBottom = isAtBottomBoundary(scroller)
      const canScrollWithinPage = direction > 0 ? !atBottom : !atTop

      event.preventDefault()

      if (canScrollWithinPage) {
        scroller.scrollBy({
          top: direction * (distance || scroller.clientHeight * 0.82),
          behavior: 'auto',
        })
        return
      }

      if (!transitioningRef.current) {
        goToPage(activeIndexRef.current + direction, {
          historyMode: 'replace',
          focus: true,
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [goToPage])

  useEffect(() => () => finishTransition(), [finishTransition])

  const handlePageScroll = (index: number, event: ReactUIEvent<HTMLDivElement>) => {
    if (index === activeIndexRef.current) {
      setScrolled(index > 0 || event.currentTarget.scrollTop > 24)
    }
  }

  useEffect(() => {
    const deck = pageDeckRef.current
    if (!deck) return

    const handleWheel = (event: WheelEvent) => {
      if (
        menuOpenRef.current ||
        event.ctrlKey ||
        event.deltaY === 0 ||
        Math.abs(event.deltaY) < Math.abs(event.deltaX) * 0.6
      ) {
        return
      }

      const currentIndex = activeIndexRef.current
      const scroller = pageScrollRefs.current[currentIndex]
      if (!scroller) return

      const multiplier =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? scroller.clientHeight
            : 1
      const delta = event.deltaY * multiplier
      const direction = delta > 0 ? 1 : -1
      const maximumScroll = Math.max(0, scroller.scrollHeight - scroller.clientHeight)
      const distanceToBoundary =
        direction > 0
          ? Math.max(0, maximumScroll - scroller.scrollTop)
          : Math.max(0, scroller.scrollTop)
      const startedAtBoundary = distanceToBoundary <= wheelEdgeTolerance
      const targetIndex = currentIndex + direction

      if (!startedAtBoundary) {
        const scrollTopBeforeEvent = scroller.scrollTop

        window.requestAnimationFrame(() => {
          if (
            activeIndexRef.current !== currentIndex ||
            transitioningRef.current ||
            Math.abs(scroller.scrollTop - scrollTopBeforeEvent) > 0.5
          ) {
            return
          }

          const latestMaximumScroll = Math.max(
            0,
            scroller.scrollHeight - scroller.clientHeight,
          )
          scroller.scrollTop = Math.max(
            0,
            Math.min(latestMaximumScroll, scrollTopBeforeEvent + delta),
          )
        })
        return
      }

      if (
        targetIndex < 0 ||
        targetIndex >= pages.length ||
        transitioningRef.current
      ) {
        if (event.cancelable) event.preventDefault()
        return
      }

      if (event.cancelable) event.preventDefault()
      scroller.scrollTop = direction > 0 ? maximumScroll : 0

      goToPage(targetIndex, {
        historyMode: 'replace',
        position: direction > 0 ? 'top' : 'bottom',
      })
    }

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || menuOpenRef.current) {
        resetTouchGesture()
        return
      }

      const touch = event.touches[0]
      const scroller = pageScrollRefs.current[activeIndexRef.current]
      touchGestureRef.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        startedAtTop: scroller ? isAtTopBoundary(scroller) : true,
        startedAtBottom: scroller ? isAtBottomBoundary(scroller) : false,
        triggered: false,
      }
    }

    const tryTouchHandoff = (event?: TouchEvent) => {
      const gesture = touchGestureRef.current
      if (
        !gesture.active ||
        gesture.triggered ||
        menuOpenRef.current ||
        transitioningRef.current
      ) {
        return false
      }

      const totalX = gesture.lastX - gesture.startX
      const totalY = gesture.lastY - gesture.startY
      if (
        Math.abs(totalY) < touchThreshold ||
        Math.abs(totalY) <= Math.abs(totalX) * 1.1
      ) {
        return false
      }

      const currentIndex = activeIndexRef.current
      const direction = totalY < 0 ? 1 : -1
      const startedAtBoundary =
        direction > 0 ? gesture.startedAtBottom : gesture.startedAtTop
      if (!startedAtBoundary) return false

      const targetIndex = currentIndex + direction
      if (targetIndex < 0 || targetIndex >= pages.length) return false

      const scroller = pageScrollRefs.current[currentIndex]
      if (!scroller) return false
      const atBoundary =
        direction > 0 ? isAtBottomBoundary(scroller) : isAtTopBoundary(scroller)
      if (!atBoundary) return false

      if (event?.cancelable) event.preventDefault()
      scroller.scrollTop =
        direction > 0
          ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
          : 0
      gesture.triggered = true
      goToPage(targetIndex, {
        historyMode: 'replace',
        position: direction > 0 ? 'top' : 'bottom',
      })
      return true
    }

    const handleTouchMove = (event: TouchEvent) => {
      const gesture = touchGestureRef.current
      if (!gesture.active || event.touches.length !== 1) return

      if (gesture.triggered) {
        if (event.cancelable) event.preventDefault()
        return
      }

      const touch = event.touches[0]
      gesture.lastX = touch.clientX
      gesture.lastY = touch.clientY

      const totalX = gesture.lastX - gesture.startX
      const totalY = gesture.lastY - gesture.startY
      if (Math.abs(totalY) > Math.abs(totalX) * 1.1) {
        const direction = totalY < 0 ? 1 : -1
        const scroller = pageScrollRefs.current[activeIndexRef.current]
        const startedAtBoundary =
          direction > 0 ? gesture.startedAtBottom : gesture.startedAtTop
        const atBoundary = scroller && (
          direction > 0 ? isAtBottomBoundary(scroller) : isAtTopBoundary(scroller)
        )

        if (scroller && startedAtBoundary && atBoundary) {
          if (event.cancelable) event.preventDefault()
          scroller.scrollTop =
            direction > 0
              ? Math.max(0, scroller.scrollHeight - scroller.clientHeight)
              : 0
        }
      }

      tryTouchHandoff(event)
    }

    const handleTouchEnd = (event: TouchEvent) => {
      const gesture = touchGestureRef.current
      const finalTouch = event.changedTouches[0]
      if (gesture.active && finalTouch) {
        gesture.lastX = finalTouch.clientX
        gesture.lastY = finalTouch.clientY
        tryTouchHandoff()
      }
      resetTouchGesture()
    }

    deck.addEventListener('wheel', handleWheel, { passive: false })
    deck.addEventListener('touchstart', handleTouchStart, { passive: true })
    deck.addEventListener('touchmove', handleTouchMove, { passive: false })
    deck.addEventListener('touchend', handleTouchEnd, { passive: true })
    deck.addEventListener('touchcancel', resetTouchGesture, { passive: true })

    return () => {
      deck.removeEventListener('wheel', handleWheel)
      deck.removeEventListener('touchstart', handleTouchStart)
      deck.removeEventListener('touchmove', handleTouchMove)
      deck.removeEventListener('touchend', handleTouchEnd)
      deck.removeEventListener('touchcancel', resetTouchGesture)
    }
  }, [goToPage, resetTouchGesture])

  const handlePageLink = (
    event: ReactMouseEvent<HTMLAnchorElement>,
    id: PageId,
    options: { position?: PagePosition } = {},
  ) => {
    event.preventDefault()
    setMenuOpen(false)
    resetTouchGesture()
    goToPage(pages.findIndex((page) => page.id === id), {
      historyMode: 'push',
      focus: true,
      position: options.position ?? 'top',
    })
  }

  const handleCaretNavigation = (targetIndex: number) => {
    resetTouchGesture()
    goToPage(targetIndex, {
      historyMode: 'replace',
      focus: true,
      position: 'top',
    })
  }

  const handleProjectFilterChange = (filter: ProjectFilter) => {
    setActiveProjectFilter(filter)
    setProjectPage(1)
  }

  const handleProjectPageChange = (nextPage: number) => {
    if (
      nextPage < 1 ||
      nextPage > totalProjectPages ||
      nextPage === safeProjectPage
    ) {
      return
    }

    setProjectPage(nextPage)
    window.requestAnimationFrame(() => {
      const scroller = pageScrollRefs.current[3]
      const results = projectResultsRef.current
      if (!scroller || !results) return

      scroller.scrollTop = Math.max(0, results.offsetTop - 24)
    })
  }

  const handleSkipLink = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    focusPageHeading(activeIndexRef.current)
  }

  const pageA11yProps = (index: number) => ({
    'aria-hidden': activeIndex !== index,
    inert: activeIndex !== index,
  })

  return (
    <div className={`site${menuOpen ? ' is-menu-open' : ''}`}>
      <a className="skip-link" href="#main" onClick={handleSkipLink}>Skip to content</a>

      <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
        <button
          className="menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((open) => !open)}
        >
          {menuOpen ? 'Close' : 'Menu'}
        </button>

        <nav
          id="primary-navigation"
          className={`site-nav${menuOpen ? ' is-open' : ''}`}
          aria-label="Primary navigation"
        >
          {navigation.map((item) => (
            <a
              key={item.label}
              href={`#${item.id}`}
              aria-current={activeIndex === pages.findIndex((page) => page.id === item.id) ? 'page' : undefined}
              onClick={(event) => handlePageLink(event, item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      {activeIndex > 0 && (
        <button
          className="page-caret page-caret-top"
          type="button"
          aria-label={`Go to previous section: ${pages[activeIndex - 1].label}`}
          onClick={() => handleCaretNavigation(activeIndex - 1)}
        >
          <span aria-hidden="true" />
        </button>
      )}

      {activeIndex < pages.length - 1 && (
        <button
          className="page-caret page-caret-bottom"
          type="button"
          aria-label={`Go to next section: ${pages[activeIndex + 1].label}`}
          onClick={() => handleCaretNavigation(activeIndex + 1)}
        >
          <span aria-hidden="true" />
        </button>
      )}

      <main
        ref={pageDeckRef}
        id="main"
        className="page-deck"
      >
        <div
          className="page-track"
          style={{ '--page-offset': `${activeIndex * -100}%` } as CSSProperties}
        >
        <section className="page" id="top" aria-labelledby="hero-title" {...pageA11yProps(0)}>
          <div
            className="page-scroll"
            ref={(node) => { pageScrollRefs.current[0] = node }}
            onScroll={(event) => handlePageScroll(0, event)}
          >
          <div className="hero">
          <div className="hero-frame hero-frame-copy" aria-hidden="true" />
          <div className="hero-frame hero-frame-image" aria-hidden="true" />

          <div className="hero-copy">
            <p className="hero-kicker">Software Engineer · Bay Area</p>
            <h1 id="hero-title" tabIndex={-1}>Kendrick Ng</h1>
            <p className="hero-degree">MSCS @ USC | B.S. Computer Science @ UC Santa Cruz</p>
            <p className="hero-intro">
              Welcome to my portfolio! I’m a software engineer who builds to connect and support people.
              I’m always excited to meet new people, so reach out if you’re looking to start something new.
            </p>
            <div className="hero-actions">
              <a className="arrow-link" href="#projects" onClick={(event) => handlePageLink(event, 'projects')}>
                See selected projects <span aria-hidden="true">↘</span>
              </a>
              <a className="arrow-link arrow-link-muted" href={resume} target="_blank" rel="noreferrer">
                View résumé <span aria-hidden="true">↗</span>
              </a>
            </div>
          </div>

          <figure className="portrait-block">
            <div className="portrait-crop">
              <img
                className="portrait-source"
                src={portrait}
                alt="Kendrick Ng in graduation attire at the University of California, Santa Cruz"
                width="1536"
                height="2304"
                decoding="async"
                fetchPriority="high"
              />
            </div>
          </figure>
          </div>
          </div>
        </section>

        <section className="page" id="about" aria-labelledby="about-title" {...pageA11yProps(1)}>
          <div
            className="page-scroll"
            ref={(node) => { pageScrollRefs.current[1] = node }}
            onScroll={(event) => handlePageScroll(1, event)}
          >
          <div className="section about">
          <div className="section-label">
            <span>01</span>
            <p>About</p>
          </div>

          <div className="about-grid">
            <div className="about-title-card">
              {/*<p className="overline">My W's</p>*/}
              <h2 id="about-title" tabIndex={-1}>
                My Ws
              </h2>
            </div>

            <figure className="about-photo about-photo-race-car">
              <img
                src={raceCarGraduation}
                alt="Kendrick in graduation attire beside the UC Santa Cruz Formula SAE race car"
                width="2304"
                height="1536"
                loading="lazy"
                decoding="async"
              />
            </figure>

            <figure className="about-photo about-photo-cafe">
              <img
                src={cafeWorkspace}
                alt="A collaborative coding session with laptops, coffee, and a receipt"
                width="3024"
                height="4032"
                loading="lazy"
                decoding="async"
              />
            </figure>

            {principles.slice(0, 1).map((principle) => (
              <article key={principle.title} className={`principle principle-${principle.number}`}>
                <p>{principle.number}</p>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}

            {principles.slice(1).map((principle) => (
              <article key={principle.title} className={`principle principle-${principle.number}`}>
                <p>{principle.number}</p>
                <h3>{principle.title}</h3>
                <p>{principle.description}</p>
              </article>
            ))}
          </div>

          {/*<div className="about-body">
            <p className="about-lead">
              I like working where thoughtful engineering meets a real human need.
            </p>
            <p>
              My goal is to understand the problem beneath the request, make the complicated parts legible,
              and build an experience people can rely on. I’m especially interested in developer tools,
              intelligent systems, infrastructure, and products that help people make better decisions.
            </p>
          </div>*/}
          </div>
          </div>
        </section>

        <section className="page" id="experience" aria-labelledby="experience-title" {...pageA11yProps(2)}>
          <div
            className="page-scroll"
            ref={(node) => { pageScrollRefs.current[2] = node }}
            onScroll={(event) => handlePageScroll(2, event)}
          >
          <div className="section experience">
          <div className="section-label">
            <span>02</span>
            <h2 id="experience-title" tabIndex={-1}>Experience</h2>
          </div>

          <div className="experience-list">
            {experience.map((item) => (
              <article className="experience-item" key={`${item.company}-${item.period}`}>
                <p className="experience-year">{item.period}</p>
                <div className="experience-role">
                  <h3>{item.role}</h3>
                  {item.companyHref ? (
                    <a
                      className="experience-company"
                      href={item.companyHref}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {item.company} <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <p>{item.company}</p>
                  )}
                </div>
                <div
                  className="experience-skills"
                  aria-label={`${item.company} technologies`}
                >
                  {item.skills.map((skill) => (
                    <span key={skill}>{skill}</span>
                  ))}
                </div>
                <div className="experience-description">
                  <p>{item.description}</p>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
          </div>
          </div>
        </section>

        <section className="page" id="projects" aria-labelledby="projects-title" {...pageA11yProps(3)}>
          <div
            className="page-scroll"
            ref={(node) => { pageScrollRefs.current[3] = node }}
            onScroll={(event) => handlePageScroll(3, event)}
          >
          <div className="section projects">
          <div className="section-label">
            <span>03</span>
            <h2 id="projects-title" tabIndex={-1}>Projects</h2>
          </div>

          <div className="project-filters" role="group" aria-label="Filter projects">
            {projectFilters.map((filter, index) => (
              <span className="project-filter-option" key={filter.key}>
                {index > 0 && <span className="project-filter-separator" aria-hidden="true">|</span>}
                <button
                  className={activeProjectFilter === filter.key ? 'is-active' : undefined}
                  type="button"
                  aria-pressed={activeProjectFilter === filter.key}
                  onClick={() => handleProjectFilterChange(filter.key)}
                >
                  {filter.label}
                </button>
              </span>
            ))}
          </div>

          <div className="project-results" ref={projectResultsRef}>
            {visibleProjects.length > 0 ? (
              <div className="project-list">
                {visibleProjects.map((project) => (
                  <article className="project" key={project.title}>
                    <div className="project-copy">
                      <div className="project-meta">
                        <time className="project-year" dateTime={project.year}>
                          {project.year}
                        </time>
                        <p className="project-category">{project.category}</p>
                      </div>
                      <h3>{project.title}</h3>
                      <p>{project.description}</p>
                      {(project.href || project.appStoreHref) && (
                        <div className="project-links">
                          {project.href && (
                            <a
                              className="project-link"
                              href={project.href}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View repository <span aria-hidden="true">↗</span>
                            </a>
                          )}
                          {project.appStoreHref && (
                            <a
                              className="project-link"
                              href={project.appStoreHref}
                              target="_blank"
                              rel="noreferrer"
                            >
                              View on App Store <span aria-hidden="true">↗</span>
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="project-empty" role="status">
                <p>In the works!</p>
              </div>
            )}
          </div>

          {totalProjectPages > 1 && (
            <nav className="project-pagination" aria-label="Project result pages">
              <button
                type="button"
                disabled={safeProjectPage === 1}
                onClick={() => handleProjectPageChange(safeProjectPage - 1)}
              >
                ← Previous
              </button>
              {Array.from({ length: totalProjectPages }, (_, index) => index + 1).map((page) => (
                <button
                  className={safeProjectPage === page ? 'is-active' : undefined}
                  type="button"
                  key={page}
                  aria-current={safeProjectPage === page ? 'page' : undefined}
                  aria-label={`Project results page ${page}`}
                  onClick={() => handleProjectPageChange(page)}
                >
                  {page}
                </button>
              ))}
              <button
                type="button"
                disabled={safeProjectPage === totalProjectPages}
                onClick={() => handleProjectPageChange(safeProjectPage + 1)}
              >
                Next →
              </button>
            </nav>
          )}
          </div>
          </div>
        </section>

        <section className="page" id="contact" aria-labelledby="contact-title" {...pageA11yProps(4)}>
          <div
            className="page-scroll"
            ref={(node) => { pageScrollRefs.current[4] = node }}
            onScroll={(event) => handlePageScroll(4, event)}
          >
          <div className="contact">
          <div className="contact-frame" aria-hidden="true" />
          <p className="overline">04 · Contact</p>
          <h2 id="contact-title" tabIndex={-1}>
            Let’s start
            <br />
            <span>something new.</span>
          </h2>
          <p>
            Whether its engineering related or something creative, I'm always open to learn more about it. Hit me up if you're looking to share ideas or talk about cool things!
          </p>
          <div className="contact-actions">
            <a className="contact-link" href="mailto:ng.kendrick@yahoo.com">
              Email <span aria-hidden="true">↗</span>
            </a>
            <a className="contact-link" href="https://www.linkedin.com/in/kkng01" target="_blank" rel="noreferrer">
              LinkedIn <span aria-hidden="true">↗</span>
            </a>
            <a className="contact-link" href="https://github.com/kkng-git" target="_blank" rel="noreferrer">
              GitHub <span aria-hidden="true">↗</span>
            </a>
          </div>
          </div>

          <footer className="site-footer">
            <p>© {new Date().getFullYear()} Kendrick Ng</p>
            <p>Built with care in the Bay Area</p>
            <a href="#top" onClick={(event) => handlePageLink(event, 'top', { position: 'top' })}>
              Back to top <span aria-hidden="true">↑</span>
            </a>
          </footer>
          </div>
        </section>
        </div>
      </main>

      <p className="sr-only" aria-live="polite">{pages[activeIndex].label} page</p>
    </div>
  )
}

export default App
