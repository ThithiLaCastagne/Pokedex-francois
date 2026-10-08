import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Database,
  Leaf,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react'
import type { Profile } from '../preferences'
import { profileColors } from '../preferences'
import type { Observation } from '../types'
import { clearObservations, importBackup } from '../storage'
import { collectionStats } from '../collection'
import Dialog from './Dialog'

export default function SettingsView({
  profile,
  onProfile,
  observations,
  onBackup,
  onRefresh,
  notify,
  onInstall,
  installed,
}: {
  profile: Profile
  onProfile: (value: Profile) => boolean
  observations: Observation[]
  onBackup: () => void
  onRefresh: () => Promise<void>
  notify: (message: string) => void
  onInstall?: () => void
  installed: boolean
}) {
  const [name, setName] = useState(profile.name)
  const [color, setColor] = useState(profile.color)
  const [goal, setGoal] = useState(profile.goal)
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState(false)
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persistent?: boolean }>({})
  const [importFile, setImportFile] = useState<File | null>(null)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const stats = collectionStats(observations)
  useEffect(() => {
    Promise.all([navigator.storage?.estimate?.(), navigator.storage?.persisted?.()])
      .then(([estimate, persistent]) => setStorage({ ...estimate, persistent }))
      .catch(() => {})
  }, [observations])
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN CARNET QUI VOUS RESSEMBLE</p>
          <h1>
            Votre espace, vos choix<span>.</span>
          </h1>
          <p className="page-description">Personnalisez votre profil et gardez la main sur vos souvenirs.</p>
        </div>
      </div>
      <div className="settings-grid">
        <section className="panel settings-card profile-settings">
          <div className="profile-heading">
            <span className="avatar avatar-large" style={{ background: color }}>
              {(name || '?').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <h2>Votre profil d’explorateur</h2>
              <p>
                {stats.species} espèces · {stats.total} rencontres
              </p>
            </div>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              if (!name.trim()) return
              if (onProfile({ ...profile, name: name.trim(), color, goal }))
                notify('Profil enregistré sur cet appareil.')
            }}
          >
            <label className="field-label" htmlFor="profile-name">
              Votre pseudonyme
            </label>
            <input
              className="input-field"
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={30}
              required
              autoComplete="nickname"
            />
            <p className="field-help">
              Visible seulement lorsque vous partagez votre collection ou rejoignez un cercle.
            </p>
            <fieldset className="color-options">
              <legend>Votre couleur</legend>
              {profileColors.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`Couleur ${value}`}
                  aria-pressed={color === value}
                  style={{ background: value }}
                  onClick={() => setColor(value)}
                >
                  {color === value && <Check size={18} />}
                </button>
              ))}
            </fieldset>
            <label className="field-label" htmlFor="profile-goal">
              Votre petit objectif hebdomadaire
            </label>
            <select
              id="profile-goal"
              className="input-field"
              value={goal}
              onChange={(event) => setGoal(Number(event.target.value))}
            >
              {[1, 3, 5, 10].map((number) => (
                <option key={number} value={number}>
                  {number} rencontre{number > 1 ? 's' : ''} par semaine
                </option>
              ))}
            </select>
            <p className="field-help">
              Un repère personnel, jamais une obligation de sortir ou de déranger un animal.
            </p>
            <button className="btn btn-primary" type="submit">
              Enregistrer mon profil <Check size={16} />
            </button>
          </form>
        </section>
        <section className="panel settings-card">
          <span className="settings-icon">
            <Database size={24} />
          </span>
          <h2>Vos souvenirs méritent une copie.</h2>
          <p>
            Votre carnet est conservé dans ce navigateur. Téléchargez une sauvegarde pour protéger vos
            observations et vos photos ou les retrouver sur un autre appareil.
          </p>
          <div className="storage-summary">
            <span>{stats.total} observations</span>
            <span>{stats.photos} photos</span>
            {storage.usage !== undefined && (
              <span>{(storage.usage / 1024 / 1024).toFixed(1)} Mo utilisés par ce site</span>
            )}
          </div>
          <div className="settings-actions">
            <button className="btn btn-primary" disabled={!observations.length || busy} onClick={onBackup}>
              <ArrowDownToLine size={17} />
              Exporter le carnet
            </button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => fileRef.current?.click()}>
              <ArrowUpFromLine size={17} />
              Importer
            </button>
          </div>
          <input
            hidden
            type="file"
            ref={fileRef}
            accept="application/json,.json"
            aria-label="Importer une sauvegarde"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) {
                if (file.size > 100 * 1024 * 1024) notify('La sauvegarde dépasse 100 Mo.')
                else {
                  setError('')
                  setImportFile(file)
                }
              }
              event.target.value = ''
            }}
          />
          <p className="field-help">
            L’import ajoute les observations absentes sans remplacer celles déjà présentes. La sauvegarde
            contient le carnet, pas le profil, les envies ni les collections reçues.
          </p>
          <div className="setting-state">
            <ShieldCheck size={16} />
            {storage.persistent
              ? 'Stockage persistant accordé par le navigateur'
              : 'Une sauvegarde reste votre meilleure protection'}
          </div>
          {!storage.persistent && navigator.storage?.persist && (
            <button
              className="text-button"
              onClick={async () => {
                try {
                  const granted = await navigator.storage.persist()
                  setStorage((previous) => ({ ...previous, persistent: granted }))
                  notify(
                    granted
                      ? 'Stockage persistant accordé. Continuez à exporter des sauvegardes.'
                      : 'Le navigateur n’accorde pas le stockage persistant. Vos sauvegardes restent essentielles.',
                  )
                } catch {
                  notify('Le navigateur ne permet pas de modifier ce réglage.')
                }
              }}
            >
              Demander de conserver les données sur l’appareil
            </button>
          )}
        </section>
        <section className="panel settings-card">
          <span className="settings-icon">
            <Smartphone size={24} />
          </span>
          <h2>Votre carnet dans la poche.</h2>
          <p>
            Installez faune. sur votre écran d’accueil. Le carnet et le guide restent disponibles hors
            connexion après une première visite complète.
          </p>
          {installed ? (
            <div className="setting-state">
              <Check size={16} />
              L’application est installée
            </div>
          ) : onInstall ? (
            <button className="btn btn-primary" onClick={onInstall}>
              <ArrowDownToLine size={17} />
              Installer l’application
            </button>
          ) : (
            <div className="install-instructions">
              <p>
                <strong>Sur iPhone :</strong> Safari → Partager → Sur l’écran d’accueil.
              </p>
              <p>
                <strong>Sur Android ou ordinateur :</strong> menu du navigateur → Installer l’application, si
                proposé.
              </p>
            </div>
          )}
          <p className="field-help">
            Le fond de carte, les sites de référence et le cercle connecté nécessitent Internet.
          </p>
        </section>
        <section className="panel settings-card">
          <span className="settings-icon">
            <LockKeyhole size={24} />
          </span>
          <h2>Privé, jusqu’à votre choix de partager.</h2>
          <p>
            Le carnet local ne transmet pas vos photos ou vos notes. Le partage par lien inclut seulement
            votre pseudonyme, les compteurs et les espèces du guide.
          </p>
          <p>
            Dans un cercle connecté, seules les informations que vous publiez sont envoyées au service du
            cercle et visibles par ses membres. Le carnet personnel n’est pas synchronisé automatiquement.
          </p>
          <p className="field-help">
            Toute personne ayant accès à ce profil de navigateur peut consulter le carnet. Une sauvegarde ou
            un lien partagé n’est pas chiffré et peut être transféré.
          </p>
        </section>
        <section className="panel settings-card">
          <span className="settings-icon">
            <MapPin size={24} />
          </span>
          <h2>Des régions, jamais des positions précises.</h2>
          <p>
            La géolocalisation facultative suggère seulement une grande région. Aucune coordonnée précise
            n’est conservée et les métadonnées sont retirées des photos importées.
          </p>
          <p className="field-help">
            Évitez les adresses et les emplacements de nids dans vos notes ou légendes. OpenStreetMap et les
            liens documentaires sont des services externes.
          </p>
        </section>
        <section className="panel settings-card ethics-card">
          <span className="settings-icon">
            <Leaf size={24} />
          </span>
          <h2>Le plus beau souvenir laisse le vivant tranquille.</h2>
          <ul>
            <li>Observez à distance, sans toucher ni nourrir.</li>
            <li>Respectez les nids, terriers et zones protégées.</li>
            <li>Évitez les appels sonores, les flashs et les poursuites.</li>
            <li>Une rencontre sans photo compte tout autant.</li>
          </ul>
          <p className="field-help">
            Les fiches et leurs illustrations ne remplacent pas une identification naturaliste. Les crédits
            sont consultables{' '}
            <a href={`${import.meta.env.BASE_URL}photos/CREDITS.md`} target="_blank" rel="noreferrer">
              ici
            </a>
            .
          </p>
        </section>
      </div>
      <section className="danger-zone">
        <div>
          <h3>Effacer le carnet de cet appareil</h3>
          <p>Vos sauvegardes téléchargées et publications dans les cercles ne sont pas supprimées.</p>
        </div>
        <button
          className="btn btn-danger"
          disabled={!observations.length || busy}
          onClick={() => {
            setError('')
            setReset(true)
          }}
        >
          <Trash2 size={16} />
          Effacer le carnet
        </button>
      </section>
      {reset && (
        <Dialog
          title="Effacer toutes vos rencontres ?"
          subtitle="SUPPRESSION LOCALE DÉFINITIVE"
          onClose={() => setReset(false)}
          busy={busy}
        >
          <p>
            Cette action supprimera {observations.length} observation{observations.length > 1 ? 's' : ''} et
            leurs photos de ce navigateur. Téléchargez une sauvegarde si vous souhaitez les conserver.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="share-actions">
            <button className="btn btn-secondary" disabled={busy} onClick={() => setReset(false)}>
              Conserver mon carnet
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await clearObservations()
                  await onRefresh()
                  onProfile({ ...profile, demoDismissed: true })
                  setReset(false)
                  notify('Votre carnet a été effacé de cet appareil.')
                } catch {
                  setError('La suppression a échoué. Réessayez.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              Confirmer la suppression
            </button>
          </div>
        </Dialog>
      )}
      {importFile && (
        <Dialog
          title="Restaurer une sauvegarde"
          subtitle="VOS RENCONTRES VOUS SUIVENT"
          onClose={() => setImportFile(null)}
          busy={busy}
        >
          <p>
            Importer <strong>{importFile.name}</strong> dans votre carnet ? Les observations déjà présentes
            sont conservées. Les identifiants en double sont ignorés.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="share-actions">
            <button className="btn btn-secondary" disabled={busy} onClick={() => setImportFile(null)}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  const count = await importBackup(await importFile.text())
                  await onRefresh()
                  setImportFile(null)
                  notify(`${count} observation${count > 1 ? 's' : ''} importée${count > 1 ? 's' : ''}.`)
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : 'Sauvegarde invalide.')
                } finally {
                  setBusy(false)
                }
              }}
            >
              {busy ? 'Restauration…' : 'Importer les observations'}
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
