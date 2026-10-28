import { impactMotion } from './game/impact'
import {
  Speedometer,
  VehicleStatus,
  RouteProgress,
  ControlsBar,
  UtilityControls
} from './ui/HUD/GameHUD'
import { NavigationMap } from './ui/NavigationMap'
import { junctionRecords } from './game/junctions'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowUpRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Volume1,
  VolumeX,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  X,
  ArrowUp,
  Link,
  Check,
  Heart,
  MoveUpRight,
  Keyboard,
  Smartphone,
  Info,
  Maximize,
  Minimize,
  Github,
  Camera
} from 'lucide-react'
import { GameEngine, type CameraView, type Settings } from './game/engine'
import { loadPosterArtwork, disposePosterArtwork } from './game/poster-artwork'
import { disposeTemplates } from './game/assets'
import { Simulation, type Snapshot, type Input } from './game/simulation'
import {
  map,
  ROUTE_LENGTH,
  ROUTE_ID,
  LEGACY_OFFSET,
  SILK_LENGTH
} from './game/route'
import { capture, captureException } from './posthog'

function read<T> (key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}
function save (key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* Private mode still permits playing. */
  }
}
const bestKey = 'orr.best.' + ROUTE_ID
const lengthLabel = (ROUTE_LENGTH / 1000).toFixed(2)
const initial = new Simulation().snapshot()
const defaults: Settings = {
  trafficHornLevel: 2,
  reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
  quality: 'auto'
}
function loadSettings (): Settings {
  const saved = read<Partial<Settings> & { muted?: boolean; reducedNoise?: boolean }>(
    'orr.settings',
    {}
  )
  const legacyLevel = saved.muted ? 0 : saved.reducedNoise ? 1 : 2
  return {
    ...defaults,
    ...saved,
    trafficHornLevel: saved.trafficHornLevel ?? legacyLevel
  }
}
const hornLevelText = ['No traffic horns', 'Low traffic horns', 'All traffic horns'] as const
function TrafficHornSlider ({
  value,
  onChange,
  settings = false
}: {
  value: Settings['trafficHornLevel']
  onChange: (value: Settings['trafficHornLevel']) => void
  settings?: boolean
}) {
  return (
    <div
      className={`traffic-horn-slider${settings ? ' settings-horn-slider' : ''}`}
      title={`${hornLevelText[value]}. Player horn and vehicle sounds stay on.`}
    >
      <div className='traffic-horn-options' aria-hidden='true'>
        <VolumeX size={settings ? 18 : 16} />
        <Volume1 size={settings ? 18 : 16} />
        <Volume2 size={settings ? 18 : 16} />
      </div>
      <input
        type='range'
        min='0'
        max='2'
        step='1'
        value={value}
        aria-label='Amount of background traffic horns'
        aria-valuetext={hornLevelText[value]}
        onChange={e => onChange(Number(e.target.value) as Settings['trafficHornLevel'])}
      />
    </div>
  )
}
function TouchButton ({
  action,
  label,
  children,
  engine,
  className = ''
}: {
  action: keyof Input
  label: string
  children: React.ReactNode
  engine: GameEngine | null
  className?: string
}) {
  const pointers = useRef(new Set<number>())
  const release = (e: React.PointerEvent<HTMLButtonElement>) => {
    pointers.current.delete(e.pointerId)
    if (!pointers.current.size) engine?.touch(action, false)
    e.currentTarget.classList.remove('pressed')
  }
  return (
    <button
      className={'touch-button ' + className}
      aria-label={label}
      onPointerDown={e => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        pointers.current.add(e.pointerId)
        engine?.touch(action, true)
        e.currentTarget.classList.add('pressed')
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {children}
    </button>
  )
}
export default function App () {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameEngine | null>(null)
  const [snapshot, setSnapshot] = useState<Snapshot>(initial),
    [loaded, setLoaded] = useState(false),
    [loadProgress, setLoadProgress] = useState(0),
    [showLoaderImage, setShowLoaderImage] = useState(true),
    [error, setError] = useState(''),
    [settings, setSettings] = useState<Settings>(loadSettings)
  const [dialog, setDialog] = useState<'settings' | 'notes' | null>(null),
    [best, setBest] = useState(() =>
      Math.max(0, Number(read(bestKey, 0)) || 0)
    ),
    [copied, setCopied] = useState(false),
    [full, setFull] = useState(false),
    [copyError, setCopyError] = useState(false),
    [cameraView, setCameraView] = useState<CameraView>('cockpit')
  const settingsReady = useRef(false)
  const inspect =
    import.meta.env.DEV && new URLSearchParams(location.search).has('inspect')
  useEffect(() => {
    let cancelled = false
    const loadStarted = performance.now()
    const id = requestAnimationFrame(async () => {
      try {
        setLoadProgress(8)
        await loadPosterArtwork(progress =>
          setLoadProgress(Math.round(8 + progress * 72))
        )
      } catch (e) {
        captureException(e, { operation: 'load_poster_artwork' })
        if (!cancelled)
          setError(
            e instanceof Error
              ? e.message
              : 'The hoarding posters could not load. Reload to try again.'
          )
        return
      }
      if (cancelled) {
        disposeTemplates()
        disposePosterArtwork()
        return
      }
      try {
        setLoadProgress(88)
        const g = new GameEngine(
          canvas.current!,
          settings,
          s => {
            if (!cancelled) setSnapshot(s)
          },
          setError,
          view => {
            if (!cancelled) setCameraView(view)
          }
        )
        engine.current = g
        setLoadProgress(100)
        setLoaded(true)
        capture('game_loaded', {
          route_id: ROUTE_ID,
          route_length_m: ROUTE_LENGTH,
          load_time_ms: Math.round(performance.now() - loadStarted)
        })
      } catch (e) {
        disposeTemplates()
        disposePosterArtwork()
        captureException(e, { operation: 'initialize_game_engine' })
        setError(
          'This browser could not start the 3D view. Try a browser with WebGL enabled.'
        )
        console.error(e)
      }
    })
    return () => {
      cancelled = true
      cancelAnimationFrame(id)
      engine.current?.dispose()
      engine.current = null
    }
  }, [])
  useEffect(() => {
    if (!loaded) return
    const id = window.setTimeout(() => setShowLoaderImage(false), 400)
    return () => window.clearTimeout(id)
  }, [loaded])
  useEffect(() => {
    engine.current?.applySettings(settings)
    save('orr.settings', settings)
  }, [settings, loaded])
  useEffect(() => {
    if (settingsReady.current)
      engine.current?.track('game_settings_updated', {
        traffic_horn_level: settings.trafficHornLevel,
        reduced_motion: settings.reducedMotion,
        graphics_quality: settings.quality
      })
    else settingsReady.current = true
  }, [settings])
  useEffect(() => {
    if (!inspect && snapshot.phase === 'ended' && snapshot.distance > best) {
      setBest(snapshot.distance)
      save(bestKey, snapshot.distance)
    }
  }, [inspect, snapshot.phase, snapshot.distance, best])
  useEffect(() => {
    const f = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', f)
    return () => document.removeEventListener('fullscreenchange', f)
  }, [])
  useEffect(() => {
    if (engine.current) engine.current.uiBlocked = !!dialog
    if (!dialog) return
    const previous = document.activeElement as HTMLElement | null
    const node = document.querySelector<HTMLElement>('[role=dialog]')
    const targets = () =>
      Array.from(
        node?.querySelectorAll<HTMLElement>('button,a[href],input,select') ?? []
      )
    targets()[0]?.focus()
    const trap = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setDialog(null)
      }
      if (event.key === 'Tab') {
        const f = targets()
        const first = f[0],
          last = f[f.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last?.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first?.focus()
        }
      }
    }
    document.addEventListener('keydown', trap)
    return () => {
      document.removeEventListener('keydown', trap)
      previous?.focus()
    }
  }, [dialog])
  const open = (which: 'settings' | 'notes') => {
    engine.current?.pause('dialog')
    engine.current?.track(
      which === 'settings' ? 'game_settings_opened' : 'game_map_notes_opened'
    )
    setDialog(which)
  }
  const copy = async () => {
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    try {
      await navigator.clipboard.writeText(url.toString())
      engine.current?.track('game_link_copied', { game_phase: snapshot.phase })
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch (e) {
      captureException(e, { operation: 'copy_game_link' })
      setCopyError(true)
    }
  }
  const fullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await document.documentElement.requestFullscreen()
    } catch (e) {
      captureException(e, {
        operation: 'toggle_fullscreen'
      }) /* Some mobile browsers use their own fullscreen chrome. */
    }
  }
  const start = () => {
    if (!loaded || error) return
    engine.current?.start()
  }
  const ready = snapshot.phase === 'ready',
    paused = snapshot.phase === 'paused',
    ended = snapshot.phase === 'ended'
  const kph = Math.round(snapshot.speed * 3.6),
    distance =
      snapshot.distance >= 1000
        ? (snapshot.distance / 1000).toFixed(2) + ' km'
        : Math.floor(snapshot.distance) + ' m'
  return (
    <main className={'game ' + (ready ? 'is-ready ' : 'is-driving')}>

      <canvas
        ref={canvas}
        className='world'
        aria-label={`${
          cameraView === 'cockpit' ? 'Third-person car' : 'First-person cockpit'
        } view of Bengaluru’s Outer Ring Road`}
      />
      <div className='vignette' />
      {!ready && <header className='topbar'>
        <div className='identity'>
          <a
            className='wordmark'
            href='#'
            aria-label='orr.run home'
            onClick={e => {
              e.preventDefault()
              if (!ready) engine.current?.pause()
            }}
          >
            orr<span>.</span>run
            <MoveUpRight size={22} strokeWidth={2.8} />
          </a>
          <span className='edition'>
            BENGALURU, IN<small>Outer Ring Road</small>
          </span>
        </div>
        <div className='top-actions'>
          <span className='road-weather'>
            <span className='sun-icon'>☀</span> 27° <i /> A LITTLE HAZY
          </span>
          {!ready && !ended && (
            <button
              className='icon-button'
              title={`Switch to ${
                cameraView === 'cockpit' ? 'third-person' : 'cockpit'
              } view (C)`}
              aria-label={`Switch to ${
                cameraView === 'cockpit'
                  ? 'third-person car'
                  : 'first-person cockpit'
              } view`}
              aria-pressed={cameraView === 'chase'}
              onClick={() => engine.current?.toggleCameraView()}
            >
              <Camera size={19} />
            </button>
          )}
          <TrafficHornSlider
            value={settings.trafficHornLevel}
            onChange={trafficHornLevel =>
              setSettings({ ...settings, trafficHornLevel })
            }
          />
          <button
            className='icon-button'
            title='Settings'
            aria-label='Settings'
            onClick={() => open('settings')}
          >
            <Settings2 size={19} />
          </button>
          {!ready && !ended && (
            <button
              className='icon-button'
              title={paused ? 'Resume' : 'Pause'}
              aria-label={paused ? 'Resume' : 'Pause'}
              onClick={() =>
                paused ? engine.current?.resume() : engine.current?.pause()
              }
            >
              {paused ? <Play size={18} /> : <Pause size={18} />}
            </button>
          )}
        </div>
      </header>}
      {!ready && !dialog && (
        <Speedometer speed={snapshot.speed} flight={snapshot.flight} />
      )}

      {ready && !dialog && (
        <div className='rush-launcher'>
          <header className='rush-nav'>
            <a href='#' className='rush-brand' onClick={event => event.preventDefault()} aria-label='Roadster Rush home'>
              <strong>Roadster <em>Rush</em></strong>
              <span>BANGALORE ORR</span>
            </a>
            <nav aria-label='Launcher navigation'>
              <a href='https://www.antimattr.one/' target='_blank' rel='noreferrer'>Sponsors</a>
              <button className='rush-nav-play' onClick={start} disabled={!loaded || !!error}>
                {loaded && !error && <Play size={19} fill='currentColor' />}
                <span>{loaded ? 'Play' : 'Loading the game'}</span>
              </button>
            </nav>
          </header>

          <section className='rush-hero' aria-label='Roadster Rush game preview'>
            {showLoaderImage && (
              <img
                className='rush-loader-bg'
                src='/loaderBG.png'
                alt=''
                aria-hidden='true'
                style={{
                  filter: `blur(${Math.max(
                    0,
                    90 * (1 - loadProgress / 100)
                  ).toFixed(1)}px)`,
                  opacity: loaded ? 0 : 1
                }}
              />
            )}
            <div className='rush-hero-shade' aria-hidden='true' />
            <div className='rush-copy'>
              <h1>Fly the <em>Tesla Roadster</em></h1>
              <p>Through Bangalore’s Outer Ring Road traffic.</p>
            </div>
            <div className='rush-launch-control'>
              <div className='rush-load-track' role='progressbar' aria-label='Loading the game' aria-valuemin={0} aria-valuemax={100} aria-valuenow={loadProgress}>
                <span style={{width: `${loadProgress}%`}} />
              </div>
              <small>{error ? 'GAME LOAD INTERRUPTED' : loaded ? 'GAME WORLD READY' : 'LOADING GAME WORLD…'}</small>
              <button onClick={start} disabled={!loaded || !!error}>
                {loaded && !error && <Play size={21} fill='currentColor' />}
                <span>{loaded ? 'Play' : 'Loading the game'}</span>
              </button>
            </div>
          </section>

          <section className='rush-route-summary' aria-label='Route summary'>
            <div className='rush-route-name'>
              <span>SILK BOARD · OUTER RING ROAD</span>
              <strong>MARATHAHALLI</strong>
            </div>
            <div className='rush-route-distance'>
              <strong>{lengthLabel}</strong><span>km</span>
            </div>
            <div className='rush-best'>
              <span>YOUR BEST</span>
              <strong>{best > 0 ? `${(best / 1000).toFixed(2)} km` : '—'}</strong>
            </div>
          </section>
        </div>
      )}
      {!ready && !dialog && <VehicleStatus snapshot={snapshot} />}
      {!ready && !dialog && <RouteProgress s={snapshot.s} />}
      {!dialog && (
        <div className='map-position'>
          <NavigationMap
            s={ready ? 250 : snapshot.s}
            x={snapshot.x}
            traffic={snapshot.trafficSections}
          />
        </div>
      )}
      {!ready && !dialog && (
        <>
          <ControlsBar flight={snapshot.flight} />
          <UtilityControls
            copy={copy}
            copied={copied}
            reset={() => engine.current?.resetCar()}
            fullscreen={fullscreen}
            notes={() => open('notes')}
          />
        </>
      )}
      {!ready && !paused && !ended && !dialog && (
        <div className='touch-controls'>
          <div
            className='touch-steering steering-wheel'
            style={{
              transform: `rotate(${(-snapshot.steer * 38).toFixed(1)}deg)`
            }}
          >
            <TouchButton
              action='left'
              label={
                snapshot.flight.state === 'GROUNDED'
                  ? 'Steer left'
                  : 'Roll left'
              }
              engine={engine.current}
              className='wheel-button wheel-left'
            >
              <ChevronLeft />
            </TouchButton>
            <div className='steering-wheel-core'>ORR</div>
            <TouchButton
              action='right'
              label={
                snapshot.flight.state === 'GROUNDED'
                  ? 'Steer right'
                  : 'Roll right'
              }
              engine={engine.current}
              className='wheel-button wheel-right'
            >
              <ChevronRight />
            </TouchButton>
          </div>
          <TouchButton
            action='ascend'
            label='Vertical thrust'
            engine={engine.current}
            className='horn-touch'
          >
            <ArrowUp size={20} />
          </TouchButton>
          <div className='touch-pedals'>
            <TouchButton
              action='brake'
              label='Brake'
              engine={engine.current}
              className='brake'
            >
              <span className='pedal-grooves' />
              <span>BRAKE</span>
            </TouchButton>
            <TouchButton
              action='throttle'
              label='Accelerate'
              engine={engine.current}
              className='accelerator'
            >
              <span className='pedal-grooves' />
              <span>GO</span>
            </TouchButton>
          </div>
        </div>
      )}
      {(paused || ended) && !dialog && (!inspect || ended) && (
        <div className='modal-backdrop'>
          <section className='pause-panel'>
            <span className='eyebrow'>
              {ended ? 'THAT’S BENGALURU FOR YOU.' : 'TAKE A BREATHER.'}
            </span>
            <h2>{ended ? 'Traffic won.' : 'Parked for a moment.'}</h2>
            <p>
              {ended
                ? 'There’s always another gap. And another run.'
                : 'Your next meeting can wait.'}
            </p>
            <div className='result-grid'>
              <div>
                <strong>{distance}</strong>
                <small>DISTANCE</small>
              </div>
              <div>
                <strong>{snapshot.overtakes}</strong>
                <small>OVERTAKES</small>
              </div>
              <div>
                <strong>
                  {Math.floor(snapshot.time / 60)}:
                  {String(Math.floor(snapshot.time % 60)).padStart(2, '0')}
                </strong>
                <small>ON THE ROAD</small>
              </div>
            </div>
            <button
              className='drive-button'
              onClick={() =>
                ended ? engine.current?.restart() : engine.current?.resume()
              }
            >
              <span>{ended ? 'Give it another go' : 'Back to the road'}</span>
              {ended ? <RotateCcw size={20} /> : <ArrowRight size={22} />}
            </button>
            {ended && (
              <a
                className='drive-button antimattr-button'
                target='_blank'
                rel='noopener noreferrer'
                href='https://www.antimattr.one/project-mnemosyne?utm_source=orr-run&utm_medium=organic&utm_campaign=orr-run-campaign-sep-24'
                onClick={() =>
                  engine.current?.track(
                    'antimattr_clicked',
                    {
                      placement: 'game_over',
                      destination_url:
                        'https://www.antimattr.one/project-mnemosyne?utm_source=orr-run&utm_medium=organic&utm_campaign=orr-run-campaign-sep-24'
                    },
                    true
                  )
                }
              >
                <span>Checkout antimattr</span>
                <ArrowUpRight size={22} />
              </a>
            )}
            <div className='pause-links'>
              <button
                className='text-button'
                onClick={() => engine.current?.restart()}
              >
                <RotateCcw size={14} /> Restart
              </button>
              <button className='text-button' onClick={copy}>
                <Link size={14} />
                {copied ? 'Copied' : 'Copy game link'}
              </button>
            </div>
          </section>
        </div>
      )}
      {dialog && (
        <div className='modal-backdrop'>
          <section
            role='dialog'
            aria-modal='true'
            aria-labelledby='dialog-title'
            className={
              'settings-panel ' + (dialog === 'notes' ? 'notes-panel' : '')
            }
          >
            <button
              className='close-button'
              aria-label='Close dialog'
              onClick={() => setDialog(null)}
            >
              <X size={22} />
            </button>
            <span className='eyebrow'>
              ORR.RUN / {dialog === 'settings' ? 'YOUR DRIVE' : 'THE REAL ROAD'}
            </span>
            <h2 id='dialog-title'>
              {dialog === 'settings'
                ? 'Make yourself comfortable.'
                : 'A longer piece of the real ORR.'}
            </h2>
            {dialog === 'settings' ? (
              <>
                <div className='setting-row'>
                  <span>
                    Background traffic horns
                    <small>Off, low (25%), or full. Player horn and vehicle sounds stay on.</small>
                  </span>
                  <TrafficHornSlider
                    settings
                    value={settings.trafficHornLevel}
                    onChange={trafficHornLevel =>
                      setSettings({ ...settings, trafficHornLevel })
                    }
                  />
                </div>
                <label className='setting-row'>
                  <span>
                    Reduce camera motion
                    <small>Keep the driver’s view steady.</small>
                  </span>
                  <input
                    type='checkbox'
                    checked={settings.reducedMotion}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        reducedMotion: e.target.checked
                      })
                    }
                  />
                </label>
                <label className='setting-row'>
                  <span>
                    Graphics<small>Auto adjusts for your device.</small>
                  </span>
                  <select
                    aria-label='Graphics quality'
                    value={settings.quality}
                    onChange={e =>
                      setSettings({
                        ...settings,
                        quality: e.target.value as Settings['quality']
                      })
                    }
                  >
                    <option value='auto'>Auto</option>
                    <option value='high'>High</option>
                    <option value='low'>Low</option>
                  </select>
                </label>
                <div className='control-help'>
                  <Keyboard size={19} />
                  <p>
                    <strong>W / ↑</strong> accelerate · <strong>S / ↓</strong>{' '}
                    brake
                    <br />
                    <strong>A D / ← →</strong> steer · <strong>Shift</strong>{' '}
                    horn · <strong>C</strong> camera
                    <br />
                    <strong>Space</strong> upward thruster
                    <br />
                    Hold <strong>Space</strong> + press <strong>B</strong> backflip
                    <br />
                    <strong>I K</strong> pitch · <strong>A D</strong> roll ·{' '}
                    <strong>Q E</strong> yaw
                  </p>
                </div>
                <div className='control-help'>
                  <Smartphone size={18} />
                  <p>
                    On your phone, turn sideways and use the pedals and steering
                    buttons together. Tap the camera button to switch views.
                  </p>
                </div>
              </>
            ) : (
              <>
                <p>
                  The route runs from Silk Board through HSR, Agara and
                  Bellandur, then continues through the Marathahalli ORR
                  underpass. The Adobe–Electra kilometre remains exactly 1,000
                  m. It ends 100 m beyond the mapped northern ramp. The short
                  hospital approach is archived in the atlas.
                </p>
                <div className='note-numbers'>
                  <div>
                    <b>{map.buildings.length}</b>
                    <span>mapped structures, including metro station</span>
                  </div>
                  <div>
                    <b>{Math.round(ROUTE_LENGTH).toLocaleString()} m</b>
                    <span>road centreline</span>
                  </div>
                </div>
                <p>
                  <strong>What’s verified:</strong> mapped footprints and
                  alignment from OpenStreetMap; dated Google Maps observations
                  with individual coverage gaps in the field atlas. The
                  extension has not yet been fully reconciled against
                  ground-level imagery.
                </p>
                <p>
                  <strong>What’s approximate:</strong> unsurveyed heights, many
                  facades, individual trees, signs, and barrier positions. This
                  is not a complete current building-by-building visual survey.
                  Flyover heights, junction movement paths and signal timings
                  are estimates. Agara Lake retains its mapped shoreline and
                  island; roadside trees screen the water. No live traffic data
                  is used.
                </p>
                <p>
                  For playability, carriageways are widened and metro supports
                  are adjusted into clear medians or verges. Extra trees,
                  pedestrians, the 14 advertising hoardings, parked tourist-bus
                  queues, potholes and waterlogged stretches are game-added
                  scenery. About 70% of the road is rough; damaged surfaces and
                  shallow water slow the car without taking health. Litter and
                  wall stains are also game-added scenery. Reduce camera motion
                  in Settings for a steady view. Wall-mounted nameplates
                  identify mapped names; their placement is a game adaptation
                  unless separately observed.
                </p>
                <p>
                  Sarjapur Road is a game boundary: stay on ORR. Simulated
                  crossing traffic can use the branch. Manipal Hospital remains
                  on the right.
                </p>
                <p>
                  The nearby JPMorgan location is represented as mapped;
                  Electra’s Google listing was marked temporarily closed. This
                  is an independent game, not affiliated with any depicted
                  business.
                </p>
                <div className='source-links'>
                  <a href='/?survey=1'>
                    Open the field atlas <ArrowUpRight size={15} />
                  </a>
                  <a href='/data/route-survey.json' download>
                    Download survey inventory <ArrowUpRight size={15} />
                  </a>
                  <a href='/data/game-road-conditions.json' download>
                    Download game road conditions <ArrowUpRight size={15} />
                  </a>
                  <a
                    href='https://www.openstreetmap.org/copyright'
                    target='_blank'
                    rel='noreferrer'
                  >
                    © OpenStreetMap contributors · ODbL{' '}
                    <ArrowUpRight size={15} />
                  </a>
                  <a
                    href='https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=12.9438,77.6976&heading=285&pitch=8&fov=90'
                    target='_blank'
                    rel='noreferrer'
                  >
                    Explore the street reference <ArrowUpRight size={15} />
                  </a>
                </div>
              </>
            )}
          </section>
        </div>
      )}
      {snapshot.phase === 'looping' && (
        <div className='loop-fade' style={{ opacity: snapshot.fade }}>
          <span>BACK TO SILK BOARD.</span>
          <h2>
            Same road.
            <br />
            New chaos.
          </h2>
        </div>
      )}
      {snapshot.impact > 0 && (
        <div
          className='impact'
          style={{
            opacity: impactMotion(
              snapshot.impactEvent,
              snapshot.time,
              settings.reducedMotion
            ).flash
          }}
        />
      )}
      {error && (
        <div className='modal-backdrop'>
          <section className='pause-panel'>
            <h2>A bump in the road.</h2>
            <p>{error}</p>
            <button className='drive-button' onClick={() => location.reload()}>
              Retry loading <RotateCcw size={20} />
            </button>
          </section>
        </div>
      )}
      {copyError && (
        <div className='copy-fallback'>
          <label>
            Copy this game link
            <input
              readOnly
              value={location.origin}
              onFocus={e => e.target.select()}
            />
          </label>
          <button
            onClick={() => setCopyError(false)}
            aria-label='Close copy link'
          >
            <X size={18} />
          </button>
        </div>
      )}
      {inspect && !ended && (
        <div className='inspect-tools'>
          <label>
            Inspect route{' '}
            <input
              type='range'
              min='0'
              max={ROUTE_LENGTH}
              step='any'
              aria-label='Inspect route station'
              defaultValue='0'
              onChange={e => {
                engine.current?.inspectStation(+e.target.value)
              }}
            />
          </label>
          <span>
            {Math.round(snapshot.s)} m · {kph} km/h
          </span>
          <input
            type='number'
            aria-label='Inspection metres'
            min='0'
            max={ROUTE_LENGTH}
            onChange={e =>
              engine.current?.inspectStation(Number(e.target.value))
            }
          />
          {junctionRecords.map(j => (
            <button
              key={j.id}
              onClick={() => engine.current?.inspectStation(j.stopLine - 40)}
            >
              {j.name}
            </button>
          ))}
          <button onClick={() => engine.current?.inspectStation(SILK_LENGTH)}>
            Route join
          </button>
          <button onClick={() => engine.current?.inspectStation(LEGACY_OFFSET)}>
            Original start
          </button>
          <button onClick={() => engine.current?.inspectStation(ROUTE_LENGTH)}>
            Endpoint
          </button>
          <button onClick={() => engine.current?.touch('throttle', true)}>
            Hold accelerator
          </button>
          <button
            onClick={() => {
              engine.current?.touch('throttle', false)
              engine.current?.touch('brake', true)
            }}
          >
            Hold brake
          </button>
          <button
            onClick={() => {
              engine.current?.touch('brake', false)
              engine.current?.touch('throttle', false)
            }}
          >
            Release pedals
          </button>
          <button
            onClick={() => {
              setDialog(null)
              engine.current?.resume()
            }}
          >
            Drive from here
          </button>
          <button onClick={() => engine.current?.inspectReaction('gesture')}>
            Preview driver gesture
          </button>
          <button onClick={() => engine.current?.inspectReaction('impact')}>
            Test collision impact
          </button>
          <button onClick={() => engine.current?.inspectHorns()}>
            Preview traffic horns
          </button>
          <button onClick={() => engine.current?.inspectWeaving()}>
            Preview weaving traffic
          </button>
          <button onClick={() => engine.current?.inspectEnd()}>
            Preview end screen
          </button>
          <button onClick={() => engine.current?.runScenerySweep()}>
            Run three scenery sweeps
          </button>
          <button
            onClick={() => {
              save(bestKey, 0)
              setBest(0)
            }}
          >
            Clear test best
          </button>
        </div>
      )}
      <div className='rotate-hint'>
        <Smartphone size={18} />
        <span>
          A wider windshield looks better.
          <br />
          <strong>Turn your phone sideways.</strong>
        </span>
      </div>
    </main>
  )
}
