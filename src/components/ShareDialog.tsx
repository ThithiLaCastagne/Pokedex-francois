import { useState } from 'react'
import { Copy, Download, Link, ShieldCheck, Share2 } from 'lucide-react'
import type { CollectionSnapshot } from '../sharing'
import { collectionLink, copyText, downloadCollectionCard } from '../sharing'
import Dialog from './Dialog'

export default function ShareDialog({
  snapshot,
  onClose,
}: {
  snapshot: CollectionSnapshot
  onClose: () => void
}) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const link = collectionLink(snapshot)
  async function share() {
    try {
      if (navigator.share)
        await navigator.share({
          title: `La collection de ${snapshot.name}`,
          text: `Découvrez mes ${snapshot.speciesCount} espèces dans faune.`,
          url: link,
        })
      else
        setMessage(
          (await copyText(link))
            ? 'Lien copié. Envoyez-le à vos proches.'
            : 'Sélectionnez le lien ci-dessous pour le copier.',
        )
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError'))
        setMessage('Le partage n’a pas abouti. Vous pouvez copier le lien ci-dessous.')
    }
  }
  return (
    <Dialog
      title="Les découvertes se partagent."
      subtitle="VOTRE COLLECTION EN UN LIEN"
      onClose={onClose}
      busy={busy}
    >
      <div className="share-card-preview">
        <span className="share-brand">faune.</span>
        <span className="avatar" style={{ background: snapshot.color }}>
          {snapshot.name.slice(0, 1).toUpperCase()}
        </span>
        <h3>{snapshot.name}</h3>
        <p>Curieux de nature.</p>
        <div className="share-numbers">
          <div>
            <strong>{snapshot.speciesCount}</strong>
            <span>espèces</span>
          </div>
          <div>
            <strong>{snapshot.total}</strong>
            <span>rencontres</span>
          </div>
        </div>
      </div>
      <p className="share-explainer">
        Vos proches pourront découvrir les espèces du guide que vous avez rencontrées et comparer vos
        collections.
      </p>
      <div className="privacy-note">
        <ShieldCheck size={20} />
        <p>
          Le lien contient votre pseudonyme, vos compteurs et les espèces du guide.{' '}
          <strong>Ni photos, ni notes, ni lieux.</strong> Toute personne possédant le lien peut le lire et le
          transférer. Il s’agit d’un instantané, sans mise à jour automatique et non révocable.
        </p>
      </div>
      <label className="field-label" htmlFor="collection-link">
        Votre lien de collection
      </label>
      <div className="copy-field">
        <Link size={17} />
        <input id="collection-link" readOnly value={link} onFocus={(event) => event.target.select()} />
        <button
          className="icon-button"
          aria-label="Copier le lien"
          onClick={async () =>
            setMessage(
              (await copyText(link)) ? 'Lien copié !' : 'Sélectionnez le lien et copiez-le manuellement.',
            )
          }
        >
          <Copy size={19} />
        </button>
      </div>
      <div className="share-actions">
        <button className="btn btn-primary" onClick={() => void share()}>
          <Share2 size={17} />
          Partager ma collection
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              await downloadCollectionCard(snapshot)
              setMessage('Votre carte a été téléchargée.')
            } catch (error) {
              setMessage(error instanceof Error ? error.message : 'Téléchargement impossible.')
            } finally {
              setBusy(false)
            }
          }}
        >
          <Download size={17} />
          Carte souvenir
        </button>
      </div>
      {message && (
        <p className="inline-message" role="status">
          {message}
        </p>
      )}
    </Dialog>
  )
}
