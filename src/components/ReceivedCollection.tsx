import { Check, Plus } from 'lucide-react'
import { species } from '../data'
import { compareCollections } from '../sharing'
import type { CollectionSnapshot } from '../sharing'
import Dialog from './Dialog'

export default function ReceivedCollection({
  snapshot,
  mine,
  onSave,
  onClose,
  saved = false,
}: {
  snapshot: CollectionSnapshot
  mine: CollectionSnapshot
  onSave?: () => void
  onClose: () => void
  saved?: boolean
}) {
  const compare = compareCollections(mine, snapshot)
  return (
    <Dialog
      title={`La collection de ${snapshot.name}`}
      subtitle="LE VIVANT NOUS RAPPROCHE"
      onClose={onClose}
      wide
    >
      <div className="received-header">
        <span className="avatar avatar-large" style={{ background: snapshot.color }}>
          {snapshot.name.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h3>
            {snapshot.speciesCount} espèces, {snapshot.total} rencontres.
          </h3>
          <p>Instantané du {new Date(snapshot.updatedAt).toLocaleDateString('fr-FR')} · partagé par lien</p>
        </div>
      </div>
      <div className="comparison-stats">
        <div>
          <strong>{compare.shared.length}</strong>
          <span>espèces en commun</span>
        </div>
        <div>
          <strong>{compare.toDiscover.length}</strong>
          <span>à découvrir pour vous</span>
        </div>
        <div>
          <strong>{compare.together}</strong>
          <span>du guide à vous deux</span>
        </div>
      </div>
      <div className="friend-album">
        {snapshot.catalogIds.map((id) => {
          const item = species.find((animal) => animal.id === id)!
          const shared = compare.shared.includes(id)
          return (
            <div key={id} className="friend-species">
              <img src={item.cover} alt="" loading="lazy" />
              <div>
                <strong>{item.name}</strong>
                <span>
                  {shared ? (
                    <>
                      <Check size={13} />
                      En commun
                    </>
                  ) : (
                    'Une idée pour vos prochaines sorties'
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
      {!snapshot.catalogIds.length && (
        <p className="notice">
          Aucune espèce du guide partagée pour le moment. Les identifications manuelles sont comptées, mais
          leurs noms restent privés.
        </p>
      )}
      <p className="field-help">
        Une collection reçue ne modifie jamais vos propres observations. Pour actualiser cet instantané,
        demandez un nouveau lien à votre proche. Les identités partagées par lien ne sont pas vérifiées.
      </p>
      {onSave && (
        <button className="btn btn-primary full-width" onClick={onSave}>
          <Plus size={17} />
          {saved ? 'Actualiser cette collection' : 'Garder dans mes proches'}
        </button>
      )}
    </Dialog>
  )
}
