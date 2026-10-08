import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  Award,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Leaf,
  LockKeyhole,
  Plus,
  Share2,
  ShieldCheck,
  Sprout,
  Users,
  WifiOff,
  X,
} from 'lucide-react'
import { deleteObservation, downloadBackup, loadObservations, saveObservation, setFavorite } from './storage'
import { localDay } from './collection'
import { onUpdateAvailable, applyUpdate } from './pwa'
import { readProfile, saveProfile } from './preferences'
import type { Profile } from './preferences'
import { decodeSnapshot, readFriends, saveFriend, snapshotOf } from './sharing'
import type { CollectionSnapshot } from './sharing'
import type { Observation, ObservationInput } from './types'
import JournalView from './components/JournalView'
import ObservationForm from './components/ObservationForm'
import ObservationDetail from './components/ObservationDetail'
import ShareDialog from './components/ShareDialog'
import ReceivedCollection from './components/ReceivedCollection'

const ExplorerView = lazy(() => import('./components/ExplorerView'))
const CircleView = lazy(() => import('./components/CircleView'))
const ProgressView = lazy(() => import('./components/ProgressView'))
const SettingsView = lazy(() => import('./components/SettingsView'))

type View = 'journal' | 'explore' | 'circle' | 'progress' | 'settings'
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const navigation = [
  { id: 'journal', label: 'Mon carnet', mobile: 'Carnet', icon: BookOpen },
  { id: 'explore', label: 'Explorer le vivant', mobile: 'Explorer', icon: Compass },
  { id: 'circle', label: 'Mon cercle', mobile: 'Cercle', icon: Users },
  { id: 'progress', label: 'Ma progression', mobile: 'Progrès', icon: Award },
  { id: 'settings', label: 'Mon profil', mobile: 'Profil', icon: Leaf },
] as const

export default function App() {
  const [view, setView] = useState<View>('journal')
  const [observations, setObservations] = useState<Observation[]>([])
  const [loaded, setLoaded] = useState(false)
  const [profile, setProfile] = useState(readProfile)
  const [selected, setSelected] = useState<{ observation: Observation; readOnly: boolean } | null>(null)
  const [form, setForm] = useState<{ initial?: Observation; suggestedSpeciesId?: string } | null>(null)
  const [share, setShare] = useState<CollectionSnapshot | null>(null)
  const [incoming, setIncoming] = useState<CollectionSnapshot | null>(null)
  const [circleVersion, setCircleVersion] = useState(0)
  const [toast, setToast] = useState('')
  const [updateReady, setUpdateReady] = useState(false)
  useEffect(() => onUpdateAvailable(() => setUpdateReady(true)), [])
  const [storageError, setStorageError] = useState('')
  const [online, setOnline] = useState(navigator.onLine)
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(matchMedia('(display-mode: standalone)').matches)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const main = useRef<HTMLElement>(null)
  const headingFocus = useRef(false)
  const notify = useCallback((message: string) => {
    setToast(message)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 6500)
  }, [])
  const refresh = useCallback(async () => {
    const items = await loadObservations()
    setObservations(items)
    setStorageError('')
    setLoaded(true)
  }, [])
  const closeForm = useCallback(() => setForm(null), [])
  const closeDetail = useCallback(() => setSelected(null), [])
  const updateProfile = (value: Profile): boolean => {
    try {
      saveProfile(value)
      setProfile(value)
      return true
    } catch {
      notify('Le profil n’a pas pu être enregistré. Vérifiez le stockage du navigateur.')
      return false
    }
  }

  useEffect(() => {
    let cancelled = false
    loadObservations()
      .then((items) => {
        if (!cancelled) {
          setObservations(items)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoaded(true)
          setStorageError(
            'Impossible d’ouvrir le stockage de ce navigateur. Votre carnet n’est pas affiché. Autorisez le stockage puis réessayez.',
          )
        }
      })
    const visibility = () => {
      if (document.visibilityState === 'visible') void refresh().catch(() => {})
    }
    document.addEventListener('visibilitychange', visibility)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', visibility)
      if (toastTimer.current) clearTimeout(toastTimer.current)
    }
  }, [refresh])

  useEffect(() => {
    try {
      saveProfile(profile)
    } catch {
      /* The notebook can still run if preferences are unavailable. */
    }
  }, [profile])
  useEffect(() => {
    const changed = () => setOnline(navigator.onLine)
    const install = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as InstallPrompt)
    }
    const installedEvent = () => {
      setInstalled(true)
      setInstallPrompt(null)
    }
    window.addEventListener('online', changed)
    window.addEventListener('offline', changed)
    window.addEventListener('beforeinstallprompt', install)
    window.addEventListener('appinstalled', installedEvent)
    return () => {
      window.removeEventListener('online', changed)
      window.removeEventListener('offline', changed)
      window.removeEventListener('beforeinstallprompt', install)
      window.removeEventListener('appinstalled', installedEvent)
    }
  }, [])

  useEffect(() => {
    const readHash = () => {
      const hash = location.hash.slice(1)
      if (hash.startsWith('collection=')) {
        try {
          setIncoming(decodeSnapshot(hash.slice(11)))
          setView('circle')
        } catch (error) {
          notify(error instanceof Error ? error.message : 'Lien invalide.')
        }
        history.replaceState(null, '', `${location.pathname}${location.search}#circle`)
      } else if (navigation.some((item) => item.id === hash)) setView(hash as View)
      else if (!hash) setView('journal')
    }
    readHash()
    window.addEventListener('hashchange', readHash)
    return () => window.removeEventListener('hashchange', readHash)
  }, [notify])

  useEffect(() => {
    document.title = `${navigation.find((item) => item.id === view)?.label} · faune.`
    if (headingFocus.current) {
      main.current?.focus({ preventScroll: true })
      window.scrollTo({ top: 0, behavior: 'instant' })
    }
    headingFocus.current = true
  }, [view])

  const navigate = useCallback((next: View) => {
    location.hash = next
    setView(next)
  }, [])
  const add = (suggestedSpeciesId?: string) => setForm({ suggestedSpeciesId })
  const open = (observation: Observation, readOnly = false) => setSelected({ observation, readOnly })
  const openSpecies = (speciesId: string) =>
    open(
      {
        id: `catalog-${speciesId}`,
        speciesId,
        regionId: null,
        date: localDay(),
        notes: '',
        photos: [],
        favorite: false,
        createdAt: new Date().toISOString(),
      },
      true,
    )
  const favorite = async (observation: Observation) => {
    try {
      await setFavorite(observation.id, !observation.favorite)
      await refresh()
      setSelected((previous) =>
        previous?.observation.id === observation.id
          ? { ...previous, observation: { ...observation, favorite: !observation.favorite } }
          : previous,
      )
    } catch {
      notify('Le favori n’a pas pu être enregistré. Réessayez.')
    }
  }
  const submit = async (input: ObservationInput) => {
    const editing = Boolean(form?.initial)
    await saveObservation(input, form?.initial?.id)
    await refresh()
    setForm(null)
    setSelected(null)
    if (!editing) navigate('journal')
    notify(editing ? 'Observation mise à jour.' : 'Une nouvelle rencontre dans votre carnet !')
  }
  const backup = async () => {
    try {
      await downloadBackup()
      notify('Sauvegarde téléchargée. Elle contient vos observations et vos photos.')
    } catch (error) {
      notify(error instanceof Error ? error.message : 'La sauvegarde a échoué.')
    }
  }
  const shareCollection = () => setShare(snapshotOf(observations, profile))
  const install = async () => {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      await installPrompt.userChoice
      setInstallPrompt(null)
    } catch {
      notify('Installation indisponible. Utilisez le menu de votre navigateur.')
    }
  }

  return (
    <div className="app-shell">
      <a
        href="#main-content"
        className="skip-link"
        onClick={(event) => {
          event.preventDefault()
          main.current?.focus()
        }}
      >
        Aller au contenu
      </a>
      <aside className="sidebar" aria-label="Navigation principale">
        <button className="brand" onClick={() => navigate('journal')} aria-label="faune, retourner au carnet">
          <span className="brand-mark">
            <Sprout size={25} strokeWidth={1.5} />
          </span>
          <span>
            <span className="brand-name">
              faune<span>.</span>
            </span>
            <span className="brand-subtitle">VOTRE CARNET DU VIVANT</span>
          </span>
        </button>
        <span className="sidebar-label">L’AVENTURE EST DEHORS</span>
        <nav className="nav-list">
          {navigation
            .filter((item) => item.id !== 'settings')
            .map((item) => (
              <button
                key={item.id}
                className={`nav-item ${view === item.id ? 'active' : ''}`}
                onClick={() => navigate(item.id)}
                aria-current={view === item.id ? 'page' : undefined}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                {item.id === 'journal' && <span className="nav-count">{observations.length}</span>}
                {item.id === 'circle' && <span className="nav-new">NOUVEAU</span>}
              </button>
            ))}
        </nav>
        <div className="sidebar-field-note">
          <span className="field-note-icon">
            <Leaf size={27} strokeWidth={1.3} />
          </span>
          <p>
            Moins d’écran.
            <br />
            <strong>Plus de vivant.</strong>
          </p>
          <span>
            Le plus beau du voyage
            <br />
            se passe juste dehors.
          </span>
        </div>
        <div className="sidebar-bottom">
          <button className="sidebar-privacy" onClick={() => navigate('settings')}>
            <ShieldCheck size={17} />
            <span>
              Privé par nature <ChevronRight size={14} />
            </span>
          </button>
          <button
            className={`profile-nav ${view === 'settings' ? 'active' : ''}`}
            onClick={() => navigate('settings')}
            aria-current={view === 'settings' ? 'page' : undefined}
          >
            <span className="avatar" style={{ background: profile.color }}>
              {profile.name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{profile.name}</strong>
              <small>Curieux de nature</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Votre espace nature</span>
            <ChevronRight size={13} />
            <strong>{navigation.find((item) => item.id === view)?.label}</strong>
          </div>
          <button
            className="mobile-brand"
            onClick={() => navigate('journal')}
            aria-label="faune, retourner au carnet"
          >
            <Sprout size={23} />
            faune.
          </button>
          <div className="topbar-actions">
            <span className={`connection-state ${online ? '' : 'offline'}`}>
              {online ? <LockKeyhole size={13} /> : <WifiOff size={14} />}
              {online ? 'Carnet privé' : 'Hors connexion'}
            </span>
            <button
              className="icon-button share-top"
              aria-label="Partager ma collection"
              onClick={shareCollection}
            >
              <Share2 size={19} />
            </button>
            <button
              className="btn btn-primary add-top"
              aria-label="Ajouter une observation"
              onClick={() => add()}
              disabled={!loaded || Boolean(storageError)}
            >
              <Plus size={18} />
              <span>Ajouter une observation</span>
            </button>
          </div>
        </header>
        <main className="main-content" id="main-content" ref={main} tabIndex={-1}>
          {updateReady && (
            <div className="update-banner">
              <p>
                Une nouvelle version de faune. est prête. Vos observations enregistrées seront conservées.
              </p>
              <button className="btn btn-secondary" onClick={applyUpdate}>
                Mettre à jour
              </button>
            </div>
          )}
          {storageError && (
            <div className="storage-alert" role="alert">
              <p>{storageError}</p>
              <button
                className="btn btn-secondary"
                onClick={() => void refresh().catch(() => notify('Le stockage est toujours indisponible.'))}
              >
                Réessayer
              </button>
            </div>
          )}
          {!online && (
            <div className="offline-banner">
              <WifiOff size={16} />
              <p>
                Vous êtes hors connexion. Votre carnet reste ici ; le cercle connecté et la carte attendront
                le retour du réseau.
              </p>
            </div>
          )}
          <Suspense
            fallback={
              <div className="loading-state">
                <Leaf size={28} />
                Un instant, la nature prend sa place…
              </div>
            }
          >
            {view === 'journal' && (
              <JournalView
                observations={observations}
                profile={profile}
                loaded={loaded}
                onOpen={open}
                onFavorite={(item) => void favorite(item)}
                onAdd={() => add()}
                onExplore={() => navigate('explore')}
                onProgress={() => navigate('progress')}
                onBackup={() => void backup()}
                onDismissDemo={() => updateProfile({ ...profile, demoDismissed: true })}
              />
            )}
            {view === 'explore' && (
              <ExplorerView
                observations={observations}
                profile={profile}
                onProfile={updateProfile}
                onSpecies={openSpecies}
                onOpen={open}
                onAdd={add}
              />
            )}
            {view === 'circle' && (
              <CircleView
                key={circleVersion}
                observations={observations}
                profile={profile}
                onShare={shareCollection}
                onSpecies={openSpecies}
                notify={notify}
              />
            )}
            {view === 'progress' && (
              <ProgressView
                observations={observations}
                profile={profile}
                onAdd={() => add()}
                onShare={shareCollection}
              />
            )}
            {view === 'settings' && (
              <SettingsView
                observations={observations}
                profile={profile}
                onProfile={updateProfile}
                onBackup={() => void backup()}
                onRefresh={refresh}
                notify={notify}
                onInstall={installPrompt ? () => void install() : undefined}
                installed={installed}
              />
            )}
          </Suspense>
          <footer className="content-footer">
            <span>
              <Leaf size={15} />
              faune. <span>Observer. Apprendre. Préserver.</span>
            </span>
            <button onClick={() => navigate('settings')}>
              <ShieldCheck size={13} />
              Vos souvenirs vous appartiennent.
            </button>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navigation mobile">
        {navigation.map((item) => (
          <button
            key={item.id}
            className={view === item.id ? 'active' : ''}
            aria-current={view === item.id ? 'page' : undefined}
            onClick={() => navigate(item.id)}
          >
            <item.icon size={21} strokeWidth={view === item.id ? 2 : 1.7} />
            <span>{item.mobile}</span>
          </button>
        ))}
      </nav>
      {form && (
        <ObservationForm
          initial={form.initial}
          suggestedSpeciesId={form.suggestedSpeciesId}
          onClose={closeForm}
          onSave={submit}
        />
      )}
      {selected && !form && (
        <ObservationDetail
          key={selected.observation.id}
          observation={selected.observation}
          readOnly={selected.readOnly}
          onClose={closeDetail}
          onEdit={() => setForm({ initial: selected.observation })}
          onObserve={
            selected.readOnly && selected.observation.speciesId
              ? () => add(selected.observation.speciesId!)
              : undefined
          }
          onDelete={async () => {
            await deleteObservation(selected.observation.id)
            await refresh()
            setSelected(null)
            notify('Observation supprimée.')
          }}
          onFavorite={() => void favorite(selected.observation)}
        />
      )}
      {share && <ShareDialog snapshot={share} onClose={() => setShare(null)} />}
      {incoming && (
        <ReceivedCollection
          snapshot={incoming}
          mine={snapshotOf(observations, profile)}
          saved={readFriends().some((item) => item.id === incoming.id)}
          onClose={() => setIncoming(null)}
          onSave={() => {
            try {
              saveFriend(incoming, profile.id)
              setIncoming(null)
              setCircleVersion((value) => value + 1)
              notify('Collection ajoutée à vos proches.')
            } catch (error) {
              notify(error instanceof Error ? error.message : 'Enregistrement impossible.')
            }
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="Fermer le message" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  )
}
