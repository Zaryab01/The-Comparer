"""
Similarity engine — weighted Jaccard with IDF-style note weighting.

Public interface (stable — swap to embeddings in v2 without changing callers):

    compare(top_ids, middle_ids, base_ids, limit=3) -> list[MatchResult]

Inputs are lists of Note.note_id strings.
Output is a ranked list of MatchResult objects.

All heavy data is loaded from the DB once and kept in module-level memory.
Call load_cache() explicitly after import_data runs; otherwise it is loaded
lazily on the first compare() call.
"""

from __future__ import annotations

import threading
from collections import defaultdict
from dataclasses import dataclass

from .constants import DEFAULT_COMPARE_LIMIT, LAYER_WEIGHTS, LAYERS, idf_weight

# ---------------------------------------------------------------------------
# Result types
# ---------------------------------------------------------------------------


@dataclass
class LayerBreakdown:
    score: float          # 0–100, already rounded
    matched_note_ids: list[str]


@dataclass
class MatchResult:
    perfume_id: str
    perfume_name: str
    perfume_brand: str | None
    release_year: int | None
    url: str | None
    overall_score: float  # 0–100, already rounded
    top: LayerBreakdown | None
    middle: LayerBreakdown | None
    base: LayerBreakdown | None


# ---------------------------------------------------------------------------
# In-memory cache
# ---------------------------------------------------------------------------


class _Cache:
    # perfume DB pk → {layer → frozenset(note_id)}
    perfume_notes: dict[int, dict[str, frozenset[str]]]
    # perfume DB pk → (perfume_id, name, brand, release_year, url)
    perfume_meta: dict[int, tuple[str, str, str | None, int | None, str | None]]
    # note_id → IDF weight
    note_weights: dict[str, float]
    # fallback weight for notes absent from NoteFrequency (treated as freq=1)
    default_weight: float

    def __init__(self) -> None:
        self.perfume_notes = {}
        self.perfume_meta = {}
        self.note_weights = {}
        self.default_weight = idf_weight(1)


_cache: _Cache | None = None
_cache_lock = threading.Lock()


def _build_cache() -> _Cache:
    """Build a fresh _Cache from the database. Does NOT acquire any lock."""
    # Imported inside the function so this module remains importable without
    # Django being configured (unit tests call _score_all directly).
    from catalog.models import Perfume, PerfumeNote
    from similarity.models import NoteFrequency

    cache = _Cache()

    cache.note_weights = {
        nf.note_id: idf_weight(nf.frequency)
        for nf in NoteFrequency.objects.all()
    }

    tmp: dict[int, dict[str, set[str]]] = defaultdict(
        lambda: {layer: set() for layer in LAYERS}
    )
    for perfume_pk, note_id, layer in PerfumeNote.objects.values_list(
        "perfume_id", "note__note_id", "layer"
    ):
        tmp[perfume_pk][layer].add(note_id)

    cache.perfume_notes = {
        pk: {layer: frozenset(notes) for layer, notes in by_layer.items()}
        for pk, by_layer in tmp.items()
    }

    cache.perfume_meta = {
        pk: (perfume_id, name, brand, release_year, url)
        for pk, perfume_id, name, brand, release_year, url in Perfume.objects.values_list(
            "id", "perfume_id", "name", "brand", "release_year", "url"
        )
    }

    return cache


def load_cache() -> None:
    """Load (or reload) all engine data from the database into memory.

    Safe to call from a management command after import_data completes.
    Thread-safe: builds outside the lock, then swaps atomically.
    """
    global _cache
    new_cache = _build_cache()
    with _cache_lock:
        _cache = new_cache


def _get_cache() -> _Cache:
    global _cache
    if _cache is None:
        with _cache_lock:
            if _cache is None:
                # Call _build_cache directly — we already hold the lock,
                # so we cannot call load_cache() which also acquires it.
                _cache = _build_cache()
    return _cache


# ---------------------------------------------------------------------------
# Core algorithm  (framework-agnostic — unit-testable without a running server)
# ---------------------------------------------------------------------------


def _weighted_jaccard(
    user_set: frozenset[str],
    perfume_set: frozenset[str],
    note_weights: dict[str, float],
    default_weight: float,
) -> tuple[float, list[str]]:
    """Weighted Jaccard for one layer.

    Returns (score 0–1, sorted list of matched note_ids).
    Caller guarantees that at least one set is non-empty.
    """
    intersection = user_set & perfume_set
    union = user_set | perfume_set

    inter_w = sum(note_weights.get(n, default_weight) for n in intersection)
    union_w = sum(note_weights.get(n, default_weight) for n in union)

    if union_w == 0.0:
        return 0.0, []

    return inter_w / union_w, sorted(intersection)


def _score_all(
    user_notes: dict[str, frozenset[str]],
    perfume_notes: dict[int, dict[str, frozenset[str]]],
    perfume_meta: dict[int, tuple],
    note_weights: dict[str, float],
    default_weight: float | None = None,
    layer_weights: dict[str, float] | None = None,
    limit: int = DEFAULT_COMPARE_LIMIT,
) -> list[MatchResult]:
    """Score every perfume against user_notes and return the top `limit` matches.

    Designed to be called from tests with synthetic data (no DB required).

    Args:
        user_notes:    {layer: frozenset(note_id)} for the submitted fragrance.
        perfume_notes: {perfume_pk: {layer: frozenset(note_id)}} preloaded from DB.
        perfume_meta:  {perfume_pk: (perfume_id, name, brand, release_year, url)}.
        note_weights:  {note_id: float} IDF weights.
        default_weight: weight used for notes not in note_weights.
        layer_weights: override LAYER_WEIGHTS (used by tests with custom weights).
        limit:         number of top results to return.
    """
    if layer_weights is None:
        layer_weights = LAYER_WEIGHTS
    if default_weight is None:
        default_weight = idf_weight(1)

    ranked: list[tuple[float, int, dict]] = []

    for pk, p_notes in perfume_notes.items():
        active_weight_sum = 0.0
        weighted_score_sum = 0.0
        layer_results: dict[str, tuple[float, list[str]] | None] = {}

        for layer in LAYERS:
            u_set = user_notes.get(layer, frozenset())
            p_set = p_notes.get(layer, frozenset())

            # Both sides empty → exclude this layer from the average entirely
            if not u_set and not p_set:
                layer_results[layer] = None
                continue

            score, matched = _weighted_jaccard(
                u_set, p_set, note_weights, default_weight
            )
            layer_results[layer] = (score, matched)

            w = layer_weights[layer]
            active_weight_sum += w
            weighted_score_sum += w * score

        overall = weighted_score_sum / active_weight_sum if active_weight_sum else 0.0
        ranked.append((overall, pk, layer_results))

    ranked.sort(key=lambda t: t[0], reverse=True)

    results: list[MatchResult] = []
    for overall, pk, layer_results in ranked[:limit]:
        meta = perfume_meta.get(pk, ("", "", None, None, None))
        perfume_id, name, brand, release_year, url = meta

        results.append(
            MatchResult(
                perfume_id=perfume_id,
                perfume_name=name,
                perfume_brand=brand,
                release_year=release_year,
                url=url,
                overall_score=round(overall * 100, 1),
                top=_make_breakdown(layer_results, "top"),
                middle=_make_breakdown(layer_results, "middle"),
                base=_make_breakdown(layer_results, "base"),
            )
        )

    return results


def _make_breakdown(
    layer_results: dict[str, tuple[float, list[str]] | None],
    layer: str,
) -> LayerBreakdown | None:
    v = layer_results.get(layer)
    if v is None:
        return None
    score, matched = v
    return LayerBreakdown(score=round(score * 100, 1), matched_note_ids=matched)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compare(
    top_ids: list[str],
    middle_ids: list[str],
    base_ids: list[str],
    limit: int = DEFAULT_COMPARE_LIMIT,
) -> list[MatchResult]:
    """Return the top `limit` perfumes most similar to the submitted note combination.

    Args:
        top_ids:    List of Note.note_id strings for top notes.
        middle_ids: List of Note.note_id strings for middle notes.
        base_ids:   List of Note.note_id strings for base notes.
        limit:      How many results to return (default 3).
    """
    cache = _get_cache()

    user_notes: dict[str, frozenset[str]] = {
        "top": frozenset(top_ids),
        "middle": frozenset(middle_ids),
        "base": frozenset(base_ids),
    }

    return _score_all(
        user_notes=user_notes,
        perfume_notes=cache.perfume_notes,
        perfume_meta=cache.perfume_meta,
        note_weights=cache.note_weights,
        default_weight=cache.default_weight,
        limit=limit,
    )


def compare_against_group(
    top_ids: list[str],
    middle_ids: list[str],
    base_ids: list[str],
    group_id: int,
    limit: int = DEFAULT_COMPARE_LIMIT,
) -> list[MatchResult]:
    """Return the top `limit` profiles (from a group) most similar to the note combination.

    Profiles are small sets — no in-memory cache is used; queried fresh each call.
    Reuses the same IDF note weights and _score_all algorithm as the main compare().

    Args:
        top_ids, middle_ids, base_ids: Note.note_id strings per layer.
        group_id: PK of the ProfileGroup to compare against.
        limit:    How many results to return (default 3).
    """
    from profiles.models import Profile  # local import — avoids circular at module load

    user_notes: dict[str, frozenset[str]] = {
        "top": frozenset(top_ids),
        "middle": frozenset(middle_ids),
        "base": frozenset(base_ids),
    }

    profiles = list(
        Profile.objects
        .filter(group_id=group_id)
        .prefetch_related("profile_notes__note")
    )

    if not profiles:
        return []

    # Build the same data structures that _score_all expects
    profile_notes: dict[int, dict[str, frozenset[str]]] = {}
    profile_meta: dict[int, tuple] = {}

    for p in profiles:
        layers: dict[str, set[str]] = {"top": set(), "middle": set(), "base": set()}
        for pn in p.profile_notes.all():
            layers[pn.layer].add(pn.note.note_id)
        profile_notes[p.pk] = {layer: frozenset(ids) for layer, ids in layers.items()}
        # Match the (perfume_id, name, brand, release_year, url) tuple format
        profile_meta[p.pk] = (f"profile-{p.pk}", p.name, p.brand, None, p.link or "")

    cache = _get_cache()

    return _score_all(
        user_notes=user_notes,
        perfume_notes=profile_notes,
        perfume_meta=profile_meta,
        note_weights=cache.note_weights,
        default_weight=cache.default_weight,
        limit=limit,
    )
