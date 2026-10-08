import { lazy, Suspense, useState } from 'react'
import { ArrowUpRight, Globe2, Link, Plus, RefreshCw, ShieldCheck, Sprout, Trash2, Users } from 'lucide-react'
import { species } from '../data'
import type { Observation } from '../types'
import type { Profile } from '../preferences'
import {
  compareCollections,
  readFriends,
  removeFriend,
  saveFriend,
  snapshotFromLink,
  snapshotOf,
} from '../sharing'
import type { CollectionSnapshot } from '../sharing'
import Dialog from './Dialog'
import ReceivedCollection from './ReceivedCollection'

const ConnectedCircle = lazy(() => import('./ConnectedCircle'))

export default function CircleView({
  observations,
  profile,
  onShare,
  onSpecies,
  notify,
}: {
  observations: Observation[]
  profile: Profile
  onShare: () => void
  onSpecies: (id: string) => void
  notify: (message: string) => void
}) {
  const [tab, setTab] = useState<'collections' | 'connected'>(() =>
    new URLSearchParams(location.search).has('auth') ? 'connected' : 'collections',
  )
  const [friends, setFriends] = useState(readFriends)
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<CollectionSnapshot | null>(null)
  const [removing, setRemoving] = useState<CollectionSnapshot | null>(null)
  const mine = snapshotOf(observations, profile)
  const suggestions = [...new Set(friends.flatMap((friend) => friend.catalogIds))]
    .filter((id) => !mine.catalogIds.includes(id))
    .slice(0, 4)
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">C’EST ENCORE MIEUX ENSEMBLE</p>
          <h1>
            Votre cercle de curieux<span>.</span>
          </h1>
          <p className="page-description">
            Vos rencontres, leurs découvertes. Une nouvelle raison de sortir.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onShare}>
          <ArrowUpRight size={17} />
          Partager ma collection
        </button>
      </div>
      <div className="page-tabs" role="group" aria-label="Mode de partage">
        <button
          className={tab === 'collections' ? 'active' : ''}
          aria-pressed={tab === 'collections'}
          onClick={() => setTab('collections')}
        >
          <Users size={17} />
          Collections de proches
        </button>
        <button
          className={tab === 'connected' ? 'active' : ''}
          aria-pressed={tab === 'connected'}
          onClick={() => setTab('connected')}
        >
          <Globe2 size={17} />
          Cercle connecté
        </button>
      </div>
      {tab === 'connected' ? (
        <Suspense fallback={<div className="loading-state">Ouverture du cercle…</div>}>
          <ConnectedCircle observations={observations} profile={profile} notify={notify} />
        </Suspense>
      ) : (
        <>
          <section className="circle-intro">
            <div>
              <span className="section-kicker">
                <Sprout size={17} /> LA CURIOSITÉ EST CONTAGIEUSE
              </span>
              <h2>
                Chacun son carnet.
                <br />
                Les découvertes en commun.
              </h2>
              <p>
                Envoyez votre collection. Ajoutez celles de vos proches.
                <br />
                Et trouvez votre prochaine aventure ensemble.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setAdding(true)
                  setError('')
                }}
              >
                <Plus size={17} />
                Ajouter un proche
              </button>
            </div>
            <div className="circle-orbits" aria-hidden="true">
              <div className="orbit-ring" />
              <div className="orbit-ring inner" />
              <span className="orbit-avatar a1">
                <Sprout size={33} />
              </span>
              <span className="orbit-avatar a2">
                <Users size={29} />
              </span>
              <span className="orbit-avatar a3">
                <Sprout size={25} />
              </span>
              <span className="orbit-center">
                <Link size={28} />
              </span>
            </div>
          </section>
          <div className="section-heading">
            <h2>
              Les collections reçues <span className="count-pill">{friends.length}</span>
            </h2>
            <span className="muted">
              <RefreshCw size={14} /> Actualisation par nouveau lien
            </span>
          </div>
          {friends.length ? (
            <div className="friends-grid">
              {friends.map((friend) => {
                const comparison = compareCollections(mine, friend)
                return (
                  <article className="friend-card panel" key={friend.id}>
                    <div className="friend-card-top">
                      <span className="avatar" style={{ background: friend.color }}>
                        {friend.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <h3>{friend.name}</h3>
                        <span>Reçue le {new Date(friend.updatedAt).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <button
                        className="icon-button muted"
                        aria-label={`Retirer ${friend.name}`}
                        onClick={() => setRemoving(friend)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="friend-stats">
                      <strong>
                        {friend.speciesCount} <span>espèces</span>
                      </strong>
                      <strong>
                        {comparison.shared.length} <span>en commun</span>
                      </strong>
                    </div>
                    <div className="friend-photo-strip">
                      {friend.catalogIds.slice(0, 4).map((id) => (
                        <img
                          key={id}
                          src={species.find((item) => item.id === id)!.cover}
                          alt={species.find((item) => item.id === id)!.name}
                          loading="lazy"
                        />
                      ))}
                      {!friend.catalogIds.length && <span>Les premières découvertes arrivent.</span>}
                    </div>
                    <button className="text-button" onClick={() => setSelected(friend)}>
                      Comparer nos collections <ArrowUpRight size={16} />
                    </button>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="empty-state circle-empty">
              <Users size={32} />
              <h3>La première invitation change tout.</h3>
              <p>
                Demandez à un proche son lien faune., puis ajoutez-le ici.
                <br />
                Aucun compte nécessaire pour comparer vos collections.
              </p>
              <button className="btn btn-secondary" onClick={() => setAdding(true)}>
                <Link size={17} />
                J’ai reçu un lien
              </button>
            </div>
          )}
          {suggestions.length > 0 && (
            <section className="circle-suggestions">
              <div className="section-heading">
                <h2>Inspiré par vos proches</h2>
                <span className="muted">À retrouver dans le guide</span>
              </div>
              <div className="suggestion-grid">
                {suggestions.map((id) => {
                  const animal = species.find((item) => item.id === id)!
                  return (
                    <button className="suggestion-card" key={id} onClick={() => onSpecies(id)}>
                      <img src={animal.cover} alt="" loading="lazy" />
                      <span>
                        <strong>{animal.name}</strong>
                        <small>{animal.category}</small>
                      </span>
                      <ArrowUpRight size={18} />
                    </button>
                  )
                })}
              </div>
            </section>
          )}
          <div className="notice">
            <ShieldCheck size={19} />
            <p>
              Ces collections sont des instantanés conservés sur cet appareil. Pour un fil d’activité partagé,
              des encouragements et des commentaires, utilisez le{' '}
              <button className="inline-link" onClick={() => setTab('connected')}>
                cercle connecté
              </button>
              .
            </p>
          </div>
        </>
      )}
      {adding && (
        <Dialog
          title="Une nouvelle curiosité à partager."
          subtitle="AJOUTER UN PROCHE"
          onClose={() => setAdding(false)}
        >
          <p>Collez le lien de collection que votre proche vous a envoyé.</p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              try {
                const snapshot = snapshotFromLink(link)
                if (snapshot.id === profile.id)
                  throw new Error('C’est votre propre collection. Demandez le lien d’un proche.')
                setSelected(snapshot)
                setAdding(false)
                setLink('')
                setError('')
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : 'Lien invalide.')
              }
            }}
          >
            <label className="field-label" htmlFor="friend-link">
              Lien de collection
            </label>
            <textarea
              id="friend-link"
              className="input-field"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="https://…/#collection=…"
              maxLength={7000}
              required
              rows={3}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="btn btn-primary full-width" type="submit">
              Découvrir sa collection <ArrowUpRight size={17} />
            </button>
          </form>
        </Dialog>
      )}
      {selected && (
        <ReceivedCollection
          snapshot={selected}
          mine={mine}
          saved={friends.some((item) => item.id === selected.id)}
          onClose={() => setSelected(null)}
          onSave={() => {
            try {
              setFriends(saveFriend(selected, profile.id))
              setSelected(null)
              notify('Collection ajoutée à vos proches.')
            } catch (caught) {
              notify(caught instanceof Error ? caught.message : 'Enregistrement impossible.')
            }
          }}
        />
      )}
      {removing && (
        <Dialog title={`Retirer ${removing.name} ?`} onClose={() => setRemoving(null)}>
          <p>
            Seule la collection reçue sur cet appareil sera retirée. Le carnet de votre proche reste intact.
          </p>
          <div className="share-actions">
            <button className="btn btn-secondary" onClick={() => setRemoving(null)}>
              Conserver
            </button>
            <button
              className="btn btn-danger"
              onClick={() => {
                try {
                  setFriends(removeFriend(removing.id))
                  setRemoving(null)
                } catch {
                  notify('Impossible de retirer cette collection.')
                }
              }}
            >
              Retirer la collection
            </button>
          </div>
        </Dialog>
      )}
    </>
  )
}
