import {
  Award,
  Binoculars,
  BookOpen,
  Camera,
  Compass,
  Eye,
  Leaf,
  Sun,
  TreePine,
  Check,
  ArrowUpRight,
} from 'lucide-react'
import { achievements, activityWeeks, collectionStats } from '../collection'
import type { Observation } from '../types'
import type { Profile } from '../preferences'

const icons = {
  leaf: Leaf,
  eye: Eye,
  binoculars: Binoculars,
  tree: TreePine,
  camera: Camera,
  book: BookOpen,
  sun: Sun,
  compass: Compass,
}

export default function ProgressView({
  observations,
  profile,
  onAdd,
  onShare,
}: {
  observations: Observation[]
  profile: Profile
  onAdd: () => void
  onShare: () => void
}) {
  const badges = achievements(observations)
  const stats = collectionStats(observations)
  const days = activityWeeks(observations)
  const unlocked = badges.filter((item) => item.unlocked).length
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">UN PEU PLUS CURIEUX CHAQUE JOUR</p>
          <h1>
            Votre aventure prend vie<span>.</span>
          </h1>
          <p className="page-description">Pas de course. Juste le plaisir de regarder autrement.</p>
        </div>
        <button className="btn btn-secondary" onClick={onShare}>
          Partager ma progression <ArrowUpRight size={16} />
        </button>
      </div>
      <section className="progress-overview">
        <div className="week-goal panel">
          <span className="section-kicker">
            <Sun size={17} /> CETTE SEMAINE
          </span>
          <h2>
            {stats.week >= profile.goal ? 'Objectif atteint. Bien joué !' : 'Un rendez-vous avec le vivant.'}
          </h2>
          <p>
            {stats.week} / {profile.goal} rencontre{profile.goal > 1 ? 's' : ''} · du lundi à aujourd’hui
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Objectif de la semaine"
            aria-valuenow={Math.min(stats.week, profile.goal)}
            aria-valuemin={0}
            aria-valuemax={profile.goal}
          >
            <span style={{ width: `${Math.min(100, (stats.week / profile.goal) * 100)}%` }} />
          </div>
          <button className="text-button" onClick={onAdd}>
            Garder une nouvelle rencontre <ArrowUpRight size={17} />
          </button>
        </div>
        <div className="badge-summary panel">
          <span className="award-emblem">
            <Award size={42} strokeWidth={1.4} />
          </span>
          <div>
            <strong>
              {unlocked}
              <small> / {badges.length}</small>
            </strong>
            <h2>souvenirs à célébrer</h2>
            <p>Vos badges se débloquent au fil de vos vraies observations.</p>
          </div>
        </div>
      </section>
      <section className="panel activity-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">VOTRE RYTHME, TOUT SIMPLEMENT</p>
            <h2>12 semaines au grand air</h2>
          </div>
          <span className="muted">
            {days.filter((item) => item.count && !item.future).length} jours d’observation
          </span>
        </div>
        <div className="activity-layout">
          <div className="activity-day-labels" aria-hidden="true">
            <span>L</span>
            <span>M</span>
            <span>M</span>
            <span>J</span>
            <span>V</span>
            <span>S</span>
            <span>D</span>
          </div>
          <div className="activity-grid" aria-label="Calendrier des observations sur douze semaines">
            {days.map((item) => (
              <span
                key={item.day}
                role="img"
                className={`activity-cell level-${Math.min(3, item.count)} ${item.future ? 'future' : ''}`}
                tabIndex={item.count ? 0 : undefined}
                title={`${new Date(`${item.day}T12:00:00`).toLocaleDateString('fr-FR')} : ${item.count} observation${item.count > 1 ? 's' : ''}`}
                aria-label={`${item.day} : ${item.count} observation${item.count > 1 ? 's' : ''}`}
              />
            ))}
          </div>
        </div>
        <div className="activity-legend">
          <span>Moins</span>
          {[0, 1, 2, 3].map((level) => (
            <span key={level} className={`activity-cell level-${level}`} />
          ))}
          <span>Plus</span>
          <span className="activity-period">
            {new Date(`${days[0].day}T12:00:00`).toLocaleDateString('fr-FR', {
              day: 'numeric',
              month: 'long',
            })}{' '}
            — aujourd’hui
          </span>
        </div>
      </section>
      <div className="section-heading">
        <h2>Les petites victoires</h2>
        <span className="muted">Chaque regard compte</span>
      </div>
      <div className="achievement-grid">
        {badges.map((badge) => {
          const Icon = icons[badge.icon as keyof typeof icons]
          return (
            <article key={badge.id} className={`achievement-card panel ${badge.unlocked ? 'unlocked' : ''}`}>
              <div className="achievement-icon">
                <Icon size={26} strokeWidth={1.6} />
                {badge.unlocked && (
                  <span>
                    <Check size={12} />
                  </span>
                )}
              </div>
              <h3>{badge.title}</h3>
              <p>{badge.description}</p>
              <div className="achievement-bottom">
                <span>
                  {badge.unlocked ? 'Débloqué' : `${Math.min(badge.value, badge.target)} / ${badge.target}`}
                </span>
                <div className="progress-track">
                  <span style={{ width: `${badge.percent}%` }} />
                </div>
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}
