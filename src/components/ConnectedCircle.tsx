import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Check,
  Copy,
  Heart,
  Leaf,
  Link,
  LoaderCircle,
  LogOut,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import type { User } from '@supabase/supabase-js'
import {
  cloud,
  cloudConfigured,
  createCircle,
  joinCircle,
  listCircles,
  loadFeed,
  publishObservation,
  toggleKudos,
  addComment,
  removePost,
  removeComment,
  updateSnapshot,
  leaveCircle,
  deleteCircle,
  removeMember,
  rotateInvite,
} from '../cloud'
import type { Circle, Comment, Feed, Kudos, Member, Post } from '../cloud'
import { species } from '../data'
import { observationSpecies } from '../lib'
import { copyText, snapshotOf, validateSnapshot } from '../sharing'
import type { CollectionSnapshot } from '../sharing'
import type { Profile } from '../preferences'
import type { Observation } from '../types'
import Dialog from './Dialog'
import ReceivedCollection from './ReceivedCollection'

interface Props {
  observations: Observation[]
  profile: Profile
  notify: (message: string) => void
}
const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Le service est momentanément indisponible. Réessayez.'

export default function ConnectedCircle({ observations, profile, notify }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(!cloudConfigured)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [circles, setCircles] = useState<Circle[]>([])
  const [circleId, setCircleId] = useState('')
  const [feed, setFeed] = useState<Feed | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const refreshId = useRef(0)
  const [mode, setMode] = useState<'create' | 'join' | 'publish' | 'invite' | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [observationId, setObservationId] = useState('')
  const [caption, setCaption] = useState('')
  const [includePhoto, setIncludePhoto] = useState(false)
  const [confirmation, setConfirmation] = useState<{
    title: string
    body: string
    action: () => Promise<void>
  } | null>(null)
  const [snapshot, setSnapshot] = useState<CollectionSnapshot | null>(null)
  const [updated, setUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!cloudConfigured) return
    let active = true
    const client = cloud()
    client.auth
      .getSession()
      .then(({ data, error: problem }) => {
        if (active) {
          setUser(data.session?.user || null)
          setAuthReady(true)
          if (problem) setError(problem.message)
        }
      })
      .catch((caught) => {
        if (active) {
          setError(errorMessage(caught))
          setAuthReady(true)
        }
      })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (active) {
        setUser(session?.user || null)
        setAuthReady(true)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const reloadCircles = useCallback(async (select?: string) => {
    const items = await listCircles()
    setCircles(items)
    setCircleId((previous) =>
      select && items.some((item) => item.id === select)
        ? select
        : items.some((item) => item.id === previous)
          ? previous
          : items[0]?.id || '',
    )
  }, [])
  useEffect(() => {
    if (!user) {
      setCircles([])
      setCircleId('')
      setFeed(null)
      refreshId.current++
      return
    }
    let active = true
    listCircles()
      .then((items) => {
        if (active) {
          setCircles(items)
          setCircleId((previous) =>
            items.some((item) => item.id === previous) ? previous : items[0]?.id || '',
          )
        }
      })
      .catch((caught) => {
        if (active) setError(errorMessage(caught))
      })
    return () => {
      active = false
    }
  }, [user?.id])

  const refresh = useCallback(async () => {
    if (!circleId || !user) return
    const request = ++refreshId.current
    const data = await loadFeed(circleId)
    if (request === refreshId.current) {
      setFeed(data)
      setUpdated(new Date())
    }
  }, [circleId, user?.id])
  useEffect(() => {
    setFeed(null)
    if (!circleId || !user) return
    let active = true
    const update = () => {
      if (document.visibilityState === 'visible' && navigator.onLine)
        void refresh().catch((caught) => {
          if (active) setError(errorMessage(caught))
        })
    }
    update()
    const timer = setInterval(update, 30_000)
    window.addEventListener('focus', update)
    window.addEventListener('online', update)
    return () => {
      active = false
      refreshId.current++
      clearInterval(timer)
      window.removeEventListener('focus', update)
      window.removeEventListener('online', update)
    }
  }, [circleId, user?.id, refresh])

  const run = async (action: () => Promise<void>, success?: string) => {
    if (busyRef.current) return false
    busyRef.current = true
    setBusy(true)
    setError('')
    try {
      await action()
      if (success) notify(success)
      return true
    } catch (caught) {
      setError(errorMessage(caught))
      return false
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  if (!cloudConfigured)
    return (
      <section className="panel cloud-intro">
        <span className="cloud-status">
          <ShieldCheck size={15} />
          Le cercle connecté reste à activer
        </span>
        <h2>
          Un petit réseau.
          <br />
          De grandes découvertes.
        </h2>
        <p>
          Un espace sur invitation pour partager vos rencontres avec vos proches, vous encourager et échanger.
          Votre carnet personnel reste indépendant.
        </p>
        <div className="cloud-features">
          <div className="cloud-feature">
            <Users size={24} />
            <strong>Un cercle privé</strong>Seuls les membres invités voient les publications.
          </div>
          <div className="cloud-feature">
            <Heart size={24} />
            <strong>Des encouragements</strong>Un cœur pour célébrer chaque découverte.
          </div>
          <div className="cloud-feature">
            <MessageCircle size={24} />
            <strong>Des conversations</strong>Commentez et apprenez les uns des autres.
          </div>
        </div>
        <div className="notice">
          <Leaf size={18} />
          <p>
            Le service de comptes et de partage n’est pas encore relié à cette version. Les liens de
            collection fonctionnent déjà dans l’onglet « Collections de proches ».
          </p>
        </div>
      </section>
    )
  if (!authReady)
    return (
      <div className="loading-state">
        <LoaderCircle className="spin" size={22} />
        Ouverture de votre espace…
      </div>
    )
  if (!user)
    return (
      <section className="panel cloud-intro">
        <span className="section-kicker">
          <Users size={18} />
          VOS PROCHES, VOS DÉCOUVERTES
        </span>
        <h2>Retrouvons-nous dehors.</h2>
        <p>
          Connectez-vous par email pour créer un cercle privé ou rejoindre vos proches. Seul votre pseudonyme
          sera visible des membres.
        </p>
        <form
          className="cloud-login"
          onSubmit={(event) => {
            event.preventDefault()
            void run(async () => {
              const { error: problem } = await cloud().auth.signInWithOtp({
                email: email.trim(),
                options: {
                  shouldCreateUser: true,
                  emailRedirectTo: `${location.origin}${location.pathname}?auth=1#circle`,
                },
              })
              if (problem) throw new Error(problem.message)
              setSent(true)
            }, 'Email de connexion demandé. Consultez votre boîte de réception.')
          }}
        >
          <label className="field-label" htmlFor="circle-email">
            Votre adresse email
          </label>
          <input
            id="circle-email"
            className="input-field"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setSent(false)
            }}
            maxLength={254}
            disabled={busy}
          />
          <button className="btn btn-primary" type="submit" disabled={busy}>
            <Mail size={17} />
            {busy ? 'Envoi…' : sent ? 'Renvoyer l’email' : 'Recevoir mon email de connexion'}
          </button>
        </form>
        {sent && (
          <form
            className="cloud-login"
            onSubmit={(event) => {
              event.preventDefault()
              void run(async () => {
                const { error: problem } = await cloud().auth.verifyOtp({
                  email: email.trim(),
                  token: otp.trim(),
                  type: 'email',
                })
                if (problem) throw new Error(problem.message)
                setOtp('')
              })
            }}
          >
            <p>
              Ouvrez le lien reçu dans ce navigateur. Si l’email contient un code, vous pouvez le saisir ici.
            </p>
            <label className="field-label" htmlFor="circle-otp">
              Code reçu par email
            </label>
            <input
              id="circle-otp"
              className="input-field"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otp}
              onChange={(event) => setOtp(event.target.value)}
              required
              minLength={6}
              maxLength={10}
            />
            <button className="btn btn-secondary" disabled={busy} type="submit">
              Valider le code <ArrowRight size={17} />
            </button>
          </form>
        )}
        {error && (
          <p className="cloud-error" role="alert">
            {error}
          </p>
        )}
        <p className="field-help">
          <ShieldCheck size={14} />
          Le compte sert uniquement au cercle. Il n’envoie pas automatiquement les données de votre carnet.
        </p>
      </section>
    )

  const own = feed?.circle.owner_id === user.id
  const me = feed?.members.find((item) => item.user_id === user.id)
  return (
    <>
      <div className="cloud-toolbar">
        {circles.length > 0 ? (
          <select
            className="input-field"
            aria-label="Choisir un cercle"
            value={circleId}
            onChange={(event) => setCircleId(event.target.value)}
            disabled={busy}
          >
            {circles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted">
            <Check size={15} />
            Vous êtes connecté
          </span>
        )}
        <div>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setError('')
              setMode('create')
            }}
          >
            <Plus size={16} />
            Créer
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => {
              setError('')
              setMode('join')
            }}
          >
            <Link size={16} />
            Rejoindre
          </button>
          <button
            className="icon-button"
            aria-label="Se déconnecter du cercle"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const { error: problem } = await cloud().auth.signOut()
                if (problem) throw new Error(problem.message)
              })
            }
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
      {error && (
        <p className="cloud-error" role="alert">
          {error}
        </p>
      )}
      {!circleId && (
        <div className="empty-state">
          <Users size={34} />
          <h3>Faites une place à vos proches.</h3>
          <p>Créez un cercle, donnez-lui un nom et invitez les personnes avec qui vous aimez explorer.</p>
          <button className="btn btn-primary" onClick={() => setMode('create')}>
            <Plus size={17} />
            Créer mon premier cercle
          </button>
        </div>
      )}
      {circleId && !feed && (
        <div className="loading-state">
          <LoaderCircle className="spin" size={22} />
          Chargement du cercle…
          <button className="text-button" onClick={() => void run(refresh)}>
            Réessayer
          </button>
        </div>
      )}
      {feed && (
        <>
          <div className="cloud-layout">
            <div>
              <div className="panel feed-composer">
                <h3>Une rencontre à leur raconter ?</h3>
                <p>Choisissez ce que vous partagez. Vos notes et lieux restent dans votre carnet.</p>
                <button
                  className="btn btn-primary"
                  disabled={!observations.length || busy}
                  onClick={() => {
                    setObservationId(observations[0]?.id || '')
                    setCaption('')
                    setIncludePhoto(false)
                    setError('')
                    setMode('publish')
                  }}
                >
                  <Plus size={17} />
                  Partager une rencontre
                </button>
                {!observations.length && (
                  <p className="field-help">Ajoutez d’abord une observation dans votre carnet.</p>
                )}
              </div>
              <div className="section-heading">
                <h2>Au fil des découvertes</h2>
                <button
                  className="icon-button"
                  aria-label="Actualiser le fil"
                  disabled={busy}
                  onClick={() => void run(refresh)}
                >
                  <RefreshCw size={17} />
                </button>
              </div>
              {feed.posts.map((post) => (
                <FeedPost
                  key={post.id}
                  post={post}
                  userId={user.id}
                  members={feed.members}
                  kudos={feed.kudos.filter((item) => item.post_id === post.id)}
                  comments={feed.comments.filter((item) => item.post_id === post.id)}
                  owner={own}
                  busy={busy}
                  onKudos={() =>
                    void run(async () => {
                      await toggleKudos(
                        post,
                        user.id,
                        feed.kudos.some((item) => item.post_id === post.id && item.user_id === user.id),
                      )
                      await refresh()
                    })
                  }
                  onComment={(body) =>
                    run(async () => {
                      await addComment(post, user.id, body)
                      await refresh()
                    })
                  }
                  onDelete={() =>
                    setConfirmation({
                      title: 'Retirer cette publication ?',
                      body: 'Elle sera retirée du cercle, avec ses commentaires et encouragements. L’observation de votre carnet reste intacte.',
                      action: async () => {
                        await removePost(post.id)
                        await refresh()
                      },
                    })
                  }
                  onDeleteComment={(id) =>
                    setConfirmation({
                      title: 'Supprimer ce commentaire ?',
                      body: 'Ce commentaire sera définitivement retiré du cercle.',
                      action: async () => {
                        await removeComment(id)
                        await refresh()
                      },
                    })
                  }
                />
              ))}
              {!feed.posts.length && (
                <div className="empty-state">
                  <Leaf size={30} />
                  <h3>Le premier souvenir vous attend.</h3>
                  <p>
                    Les rencontres partagées par les membres apparaîtront ici. Rien n’est publié
                    automatiquement.
                  </p>
                </div>
              )}
              <p className="subtle-note">
                Les 50 publications les plus récentes ·{' '}
                {updated
                  ? `actualisé à ${updated.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
                  : ''}
              </p>
            </div>
            <aside className="panel circle-members">
              <h3>{feed.circle.name}</h3>
              <p className="field-help">
                {feed.members.length} membre{feed.members.length > 1 ? 's' : ''} · sur invitation
              </p>
              {feed.members.map((member) => (
                <div className="circle-member" key={member.user_id}>
                  <span className="avatar" style={{ background: member.color }}>
                    {member.display_name.slice(0, 1).toUpperCase()}
                  </span>
                  <span>
                    <strong>
                      {member.display_name}
                      {member.user_id === user.id ? ' (vous)' : ''}
                    </strong>
                    <small>
                      {member.user_id === feed.circle.owner_id ? 'Créateur du cercle' : 'Curieux de nature'}
                    </small>
                    {member.snapshot && (
                      <button
                        className="text-button"
                        onClick={() => {
                          try {
                            setSnapshot(validateSnapshot(member.snapshot))
                          } catch {
                            notify('Cette collection ne peut pas être lue dans cette version.')
                          }
                        }}
                      >
                        Voir sa collection
                      </button>
                    )}
                  </span>
                  {own && member.user_id !== user.id && (
                    <button
                      className="icon-button"
                      aria-label={`Retirer ${member.display_name} du cercle`}
                      disabled={busy}
                      onClick={() =>
                        setConfirmation({
                          title: `Retirer ${member.display_name} ?`,
                          body: 'Ses publications, encouragements et commentaires seront aussi retirés de ce cercle. Pensez à renouveler le code d’invitation.',
                          action: async () => {
                            await removeMember(circleId, member.user_id)
                            await refresh()
                          },
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
              <button className="btn btn-secondary" onClick={() => setMode('invite')}>
                <Link size={16} />
                Inviter un proche
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    title: me?.snapshot
                      ? 'Actualiser votre collection partagée ?'
                      : 'Partager votre collection au cercle ?',
                    body: 'Votre pseudonyme, vos compteurs et la liste des espèces du guide seront visibles par les membres. Ni notes, ni lieux, ni photos ne seront inclus. La mise à jour est manuelle.',
                    action: async () => {
                      await updateSnapshot(circleId, user.id, profile, snapshotOf(observations, profile))
                      await refresh()
                    },
                  })
                }
              >
                {me?.snapshot ? 'Actualiser ma collection' : 'Partager ma collection'}
              </button>
              {me?.snapshot && (
                <button
                  className="text-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await updateSnapshot(circleId, user.id, profile, null)
                      await refresh()
                    }, 'Votre collection n’est plus affichée dans ce cercle.')
                  }
                >
                  Retirer ma collection du cercle
                </button>
              )}
              <div className="notice">
                <ShieldCheck size={17} />
                <p>
                  Seuls les membres voient ce fil. Ils peuvent enregistrer ou transférer ce que vous partagez.
                </p>
              </div>
              <button
                className="text-button danger-text"
                disabled={busy}
                onClick={() =>
                  setConfirmation({
                    title: own ? 'Supprimer ce cercle ?' : 'Quitter ce cercle ?',
                    body: own
                      ? 'Le cercle et toutes ses publications, collections partagées et conversations seront supprimés pour tous les membres. Les carnets personnels restent intacts.'
                      : 'Vos publications, commentaires, encouragements et votre collection partagée seront retirés de ce cercle. Votre carnet personnel reste intact.',
                    action: async () => {
                      if (own) await deleteCircle(circleId)
                      else await leaveCircle(circleId)
                      setFeed(null)
                      await reloadCircles()
                    },
                  })
                }
              >
                {own ? 'Supprimer le cercle' : 'Quitter le cercle'}
              </button>
            </aside>
          </div>
        </>
      )}
      {(mode === 'create' || mode === 'join') && (
        <Dialog
          title={mode === 'create' ? 'Votre prochain terrain d’aventure.' : 'Vos proches vous attendent.'}
          subtitle={mode === 'create' ? 'CRÉER UN CERCLE PRIVÉ' : 'REJOINDRE UN CERCLE'}
          onClose={() => setMode(null)}
          busy={busy}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void run(
                async () => {
                  const id =
                    mode === 'create' ? await createCircle(name, profile) : await joinCircle(code, profile)
                  await reloadCircles(id)
                  setMode(null)
                  setName('')
                  setCode('')
                },
                mode === 'create' ? 'Votre cercle est créé.' : 'Bienvenue dans le cercle !',
              )
            }}
          >
            <label className="field-label" htmlFor="circle-entry">
              {mode === 'create' ? 'Un nom pour votre cercle' : 'Code d’invitation'}
            </label>
            <input
              id="circle-entry"
              className="input-field"
              required
              minLength={mode === 'create' ? 2 : 36}
              maxLength={mode === 'create' ? 60 : 36}
              placeholder={
                mode === 'create' ? 'Les curieux du dimanche' : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
              }
              value={mode === 'create' ? name : code}
              onChange={(event) =>
                mode === 'create' ? setName(event.target.value) : setCode(event.target.value)
              }
              autoComplete="off"
            />
            <p className="field-help">
              Vous apparaîtrez sous le nom « {profile.name} ». Aucune observation ne sera publiée en
              rejoignant le cercle.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary full-width" type="submit" disabled={busy}>
              {busy ? 'Un instant…' : mode === 'create' ? 'Créer le cercle' : 'Rejoindre le cercle'}
              <ArrowRight size={17} />
            </button>
          </form>
        </Dialog>
      )}
      {mode === 'invite' && feed && (
        <Dialog
          title="L’aventure se partage."
          subtitle="INVITER VOS PROCHES"
          onClose={() => setMode(null)}
          busy={busy}
        >
          <p>
            Envoyez ce code à un proche. Après connexion, il pourra rejoindre « {feed.circle.name} » dans
            l’onglet Cercle connecté.
          </p>
          <label className="field-label" htmlFor="invite-code">
            Code d’invitation
          </label>
          <div className="copy-field">
            <input
              id="invite-code"
              value={feed.circle.invite_code}
              readOnly
              onFocus={(event) => event.target.select()}
            />
            <button
              className="icon-button"
              aria-label="Copier le code"
              onClick={async () =>
                notify(
                  (await copyText(feed.circle.invite_code))
                    ? 'Code copié.'
                    : 'Sélectionnez le code pour le copier manuellement.',
                )
              }
            >
              <Copy size={19} />
            </button>
          </div>
          <p className="field-help">
            Toute personne disposant de ce code peut rejoindre le cercle. Partagez-le seulement avec vos
            proches.
          </p>
          {own && (
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await rotateInvite(circleId)
                  await refresh()
                }, 'Code renouvelé. L’ancien code ne fonctionne plus.')
              }
            >
              <RefreshCw size={16} />
              Renouveler le code
            </button>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </Dialog>
      )}
      {mode === 'publish' && (
        <Dialog
          title="Une rencontre pour votre cercle."
          subtitle="CHOISIR CE QUE VOUS PARTAGEZ"
          onClose={() => setMode(null)}
          busy={busy}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault()
              const observation = observations.find((item) => item.id === observationId)
              if (!observation) {
                setError('Choisissez une observation de votre carnet.')
                return
              }
              void run(async () => {
                await publishObservation(circleId, user.id, observation, caption, includePhoto)
                setMode(null)
                await refresh()
              }, 'Rencontre partagée avec votre cercle.')
            }}
          >
            <label className="field-label" htmlFor="publish-observation">
              Votre rencontre
            </label>
            <select
              id="publish-observation"
              className="input-field"
              value={observationId}
              onChange={(event) => {
                setObservationId(event.target.value)
                setIncludePhoto(false)
              }}
              required
            >
              {observations.map((item) => (
                <option key={item.id} value={item.id}>
                  {observationSpecies(item)?.name || 'Espèce à identifier'} · {item.date}
                </option>
              ))}
            </select>
            <p className="field-help">
              Seuls le nom de l’espèce et son nom scientifique sont repris. Les notes, lieux et dates
              d’observation restent privés.
            </p>
            <label className="field-label" htmlFor="post-caption">
              Un mot pour vos proches <span className="field-optional">(facultatif)</span>
            </label>
            <textarea
              id="post-caption"
              className="input-field"
              rows={3}
              maxLength={1000}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              placeholder="Ce qui vous a émerveillé…"
            />
            {!!observations.find((item) => item.id === observationId)?.photos.length && (
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={includePhoto}
                  onChange={(event) => setIncludePhoto(event.target.checked)}
                />
                Partager aussi ma première photo (copie réduite, sans métadonnées).
              </label>
            )}
            <div className="notice">
              <ShieldCheck size={18} />
              <p>
                La publication sera envoyée au service du cercle et visible par ses membres. Évitez les lieux
                sensibles dans votre légende. Sans photo personnelle, une illustration du guide sera affichée
                si disponible.
              </p>
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary full-width" type="submit" disabled={busy}>
              <Send size={17} />
              {busy ? 'Publication…' : 'Publier dans ce cercle'}
            </button>
          </form>
        </Dialog>
      )}
      {confirmation && (
        <Dialog title={confirmation.title} onClose={() => setConfirmation(null)} busy={busy}>
          <p>{confirmation.body}</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="share-actions">
            <button className="btn btn-secondary" onClick={() => setConfirmation(null)} disabled={busy}>
              Annuler
            </button>
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await confirmation.action()
                  setConfirmation(null)
                })
              }
            >
              Confirmer
            </button>
          </div>
        </Dialog>
      )}
      {snapshot && (
        <ReceivedCollection
          snapshot={snapshot}
          mine={snapshotOf(observations, profile)}
          onClose={() => setSnapshot(null)}
        />
      )}
    </>
  )
}

function FeedPost({
  post,
  userId,
  members,
  kudos,
  comments,
  owner,
  busy,
  onKudos,
  onComment,
  onDelete,
  onDeleteComment,
}: {
  post: Post
  userId: string
  members: Member[]
  kudos: Kudos[]
  comments: Comment[]
  owner: boolean
  busy: boolean
  onKudos: () => void
  onComment: (body: string) => Promise<boolean>
  onDelete: () => void
  onDeleteComment: (id: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [body, setBody] = useState('')
  const member = members.find((item) => item.user_id === post.user_id)
  const liked = kudos.some((item) => item.user_id === userId)
  const illustration = species.find((item) => item.id === post.species_id)?.cover
  return (
    <article className="feed-post panel">
      <header className="post-header">
        <span className="avatar" style={{ background: member?.color || '#245a46' }}>
          {member?.display_name.slice(0, 1).toUpperCase() || '?'}
        </span>
        <div>
          <strong>{member?.display_name || 'Membre du cercle'}</strong>
          <small>
            A partagé une rencontre ·{' '}
            {new Date(post.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </small>
        </div>
        {(owner || post.user_id === userId) && (
          <button
            className="icon-button"
            aria-label={`Supprimer la publication ${post.name}`}
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        )}
      </header>
      {(post.photo || illustration) && (
        <img
          className="post-photo"
          src={post.photo || illustration}
          alt={post.photo ? `Photo partagée : ${post.name}` : `Illustration du guide : ${post.name}`}
          loading="lazy"
        />
      )}
      <div className="post-body">
        <h3>{post.name}</h3>
        {post.scientific_name && <em>{post.scientific_name}</em>}
        {!post.photo && illustration && (
          <p className="field-help">Illustration du guide · pas une photo de cette rencontre</p>
        )}
        {post.caption && <p>{post.caption}</p>}
      </div>
      <div className="post-actions">
        <button className={liked ? 'active' : ''} aria-pressed={liked} disabled={busy} onClick={onKudos}>
          <Heart size={17} fill={liked ? 'currentColor' : 'none'} />
          {kudos.length} encouragement{kudos.length > 1 ? 's' : ''}
        </button>
        <button aria-expanded={showComments} onClick={() => setShowComments(!showComments)}>
          <MessageCircle size={17} />
          {comments.length} commentaire{comments.length > 1 ? 's' : ''}
        </button>
      </div>
      {showComments && (
        <div className="post-comments">
          {comments.map((comment) => (
            <div key={comment.id} className="post-comment">
              <div>
                <strong>
                  {members.find((item) => item.user_id === comment.user_id)?.display_name || 'Membre'}
                </strong>
                <p>{comment.body}</p>
              </div>
              {(owner || comment.user_id === userId) && (
                <button
                  className="icon-button"
                  aria-label="Supprimer ce commentaire"
                  disabled={busy}
                  onClick={() => onDeleteComment(comment.id)}
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
          <form
            className="comment-form"
            onSubmit={async (event) => {
              event.preventDefault()
              if (body.trim() && (await onComment(body))) setBody('')
            }}
          >
            <input
              className="input-field"
              aria-label={`Commenter ${post.name}`}
              placeholder="Un petit mot…"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={500}
              required
            />
            <button
              className="icon-button"
              type="submit"
              aria-label="Envoyer le commentaire"
              disabled={busy || !body.trim()}
            >
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </article>
  )
}
