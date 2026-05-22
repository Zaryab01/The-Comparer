"""
Unit tests for the similarity engine.

All tests call _score_all() directly with synthetic in-memory fixtures —
no database, no Django test runner required (though they work fine with it too).

Expected values are hand-computed and documented inline.
"""

import math
import unittest

from similarity.constants import idf_weight
from similarity.engine import LayerBreakdown, MatchResult, _score_all


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uniform_weights(*note_ids: str, freq: int = 1) -> dict[str, float]:
    """All notes get the same IDF weight (same frequency)."""
    return {n: idf_weight(freq) for n in note_ids}


def _meta(pk: int, perfume_id: str = "", name: str = "Perfume") -> tuple:
    return (perfume_id or f"P-{pk:06d}", name, None, None, None)


def _user(top=(), middle=(), base=()):
    return {
        "top": frozenset(top),
        "middle": frozenset(middle),
        "base": frozenset(base),
    }


def _perfume_notes(pk: int, top=(), middle=(), base=()):
    return {
        pk: {
            "top": frozenset(top),
            "middle": frozenset(middle),
            "base": frozenset(base),
        }
    }


# ---------------------------------------------------------------------------
# Test cases
# ---------------------------------------------------------------------------


class TestIdenticalSets(unittest.TestCase):
    """Submitting the exact notes of a perfume must yield 100%."""

    def test_identical_all_layers(self):
        notes = _uniform_weights("N1", "N2", "N3", "N4", "N5", "N6")
        perfume_notes = _perfume_notes(1, top=("N1", "N2"), middle=("N3", "N4"), base=("N5", "N6"))
        perfume_meta = {1: _meta(1, "P-000001", "Test Perfume")}

        results = _score_all(
            user_notes=_user(top=("N1", "N2"), middle=("N3", "N4"), base=("N5", "N6")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].overall_score, 100.0)
        self.assertEqual(results[0].top.score, 100.0)
        self.assertEqual(results[0].middle.score, 100.0)
        self.assertEqual(results[0].base.score, 100.0)

    def test_identical_single_layer(self):
        """Only top notes submitted; middle and base empty on both sides → excluded."""
        notes = _uniform_weights("N1", "N2")
        perfume_notes = _perfume_notes(1, top=("N1", "N2"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(results[0].overall_score, 100.0)
        self.assertIsNone(results[0].middle)
        self.assertIsNone(results[0].base)


class TestZeroOverlap(unittest.TestCase):
    """Completely disjoint note sets must yield 0%."""

    def test_no_shared_notes(self):
        notes = _uniform_weights("N1", "N2", "N3", "N4")
        perfume_notes = _perfume_notes(1, top=("N3", "N4"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(results[0].overall_score, 0.0)
        self.assertEqual(results[0].top.score, 0.0)

    def test_user_layer_missing_from_perfume(self):
        """User submits top notes; perfume has no top notes at all → J(top)=0."""
        notes = _uniform_weights("N1", "N2")
        perfume_notes = _perfume_notes(1, middle=("N1", "N2"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        # top: J=0 (user has notes, perfume doesn't)
        # middle: excluded (user has nothing, perfume has notes — wait: user has no
        #   middle notes, perfume has middle notes → NOT both empty → J=0)
        # base: both empty → excluded
        self.assertEqual(results[0].top.score, 0.0)
        self.assertEqual(results[0].middle.score, 0.0)
        self.assertIsNone(results[0].base)


class TestPartialOverlap(unittest.TestCase):
    """Partial overlap with uniform weights == standard Jaccard."""

    def test_one_of_three_notes_match_uniform(self):
        # user top: {N1, N2}, perfume top: {N2, N3}
        # intersection={N2}, union={N1,N2,N3}
        # J = 1/3  (all weights equal)
        # Only top layer active → renormalized weight = 1.0
        # overall = 1/3 = 33.3%
        notes = _uniform_weights("N1", "N2", "N3")
        perfume_notes = _perfume_notes(1, top=("N2", "N3"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(results[0].overall_score, 33.3)
        self.assertEqual(results[0].top.score, 33.3)
        self.assertEqual(results[0].top.matched_note_ids, ["N2"])

    def test_partial_overlap_idf_weights(self):
        # user top: {N1, N2}, perfume top: {N2, N3}
        # N1 freq=10, N2 freq=2, N3 freq=5
        # w(N1)=idf(10), w(N2)=idf(2), w(N3)=idf(5)
        # J = idf(2) / (idf(10) + idf(2) + idf(5))
        # = 48.3% (pre-computed above)
        notes = {"N1": idf_weight(10), "N2": idf_weight(2), "N3": idf_weight(5)}
        perfume_notes = _perfume_notes(1, top=("N2", "N3"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(results[0].overall_score, 48.3)

    def test_ranking_order(self):
        """Better-matching perfume must rank above worse-matching one."""
        notes = _uniform_weights("N1", "N2", "N3", "N4")
        # Perfume A shares 2/3 top notes with user
        # Perfume B shares 1/3 top notes with user
        perfume_notes = {
            1: {"top": frozenset(("N1", "N2")), "middle": frozenset(), "base": frozenset()},
            2: {"top": frozenset(("N1", "N3")), "middle": frozenset(), "base": frozenset()},
        }
        # user: {N1, N2}
        # vs perfume 1: intersection={N1,N2}, union={N1,N2} → J=1.0
        # vs perfume 2: intersection={N1}, union={N1,N2,N3} → J=1/3
        perfume_meta = {1: _meta(1, "P-001", "Best Match"), 2: _meta(2, "P-002", "Worse Match")}

        results = _score_all(
            user_notes=_user(top=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
            limit=2,
        )

        self.assertEqual(results[0].perfume_id, "P-001")
        self.assertEqual(results[1].perfume_id, "P-002")
        self.assertGreater(results[0].overall_score, results[1].overall_score)


class TestEmptyLayerRenormalization(unittest.TestCase):
    """Excluded layers must cause remaining weights to be renormalized."""

    def test_base_excluded_renormalizes_top_and_middle(self):
        # user top: {N1}, middle: {N2}, base: {}
        # perfume top: {N1} (exact), middle: {N3} (miss), base: {}
        # base excluded (both empty)
        # J(top)=1.0, J(middle)=0.0
        # active weights = 0.25 + 0.35 = 0.60
        # overall = (0.25*1.0 + 0.35*0.0) / 0.60 = 0.25/0.60 = 41.7%
        notes = _uniform_weights("N1", "N2", "N3")
        perfume_notes = _perfume_notes(1, top=("N1",), middle=("N3",))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(top=("N1",), middle=("N2",)),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        self.assertEqual(results[0].overall_score, 41.7)
        self.assertIsNone(results[0].base)
        self.assertEqual(results[0].top.score, 100.0)
        self.assertEqual(results[0].middle.score, 0.0)

    def test_all_layers_excluded_gives_zero(self):
        """If no layer has any notes on either side, score is 0."""
        perfume_notes = {1: {"top": frozenset(), "middle": frozenset(), "base": frozenset()}}
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights={},
        )

        self.assertEqual(results[0].overall_score, 0.0)
        self.assertIsNone(results[0].top)
        self.assertIsNone(results[0].middle)
        self.assertIsNone(results[0].base)

    def test_only_middle_layer_active(self):
        """Only middle layer present; its effective weight becomes 1.0."""
        notes = _uniform_weights("N1", "N2")
        perfume_notes = _perfume_notes(1, middle=("N1",))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(middle=("N1", "N2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
        )

        # J(middle): intersection={N1}, union={N1,N2} → J=0.5
        # Only middle active → overall = 0.5 = 50.0%
        self.assertEqual(results[0].overall_score, 50.0)
        self.assertIsNone(results[0].top)
        self.assertIsNone(results[0].base)


class TestGoldenCase(unittest.TestCase):
    """A perfume scored against its own exact notes must rank #1 at 100%."""

    def test_golden_perfume_ranks_first(self):
        # Three perfumes; golden perfume uses its own notes as input.
        notes = _uniform_weights("T1", "T2", "M1", "M2", "B1", "B2", "X1", "X2", "Y1")

        perfume_notes = {
            # Golden perfume
            1: {
                "top": frozenset(("T1", "T2")),
                "middle": frozenset(("M1", "M2")),
                "base": frozenset(("B1", "B2")),
            },
            # Partial overlap
            2: {
                "top": frozenset(("T1", "X1")),
                "middle": frozenset(("M1", "X2")),
                "base": frozenset(("Y1",)),
            },
            # No overlap
            3: {
                "top": frozenset(("X1", "X2")),
                "middle": frozenset(("X2",)),
                "base": frozenset(("Y1",)),
            },
        }
        perfume_meta = {
            1: _meta(1, "GOLDEN", "The Golden Perfume"),
            2: _meta(2, "PARTIAL", "Partial Match"),
            3: _meta(3, "NONE", "No Match"),
        }

        results = _score_all(
            user_notes=_user(top=("T1", "T2"), middle=("M1", "M2"), base=("B1", "B2")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
            limit=3,
        )

        self.assertEqual(len(results), 3)
        self.assertEqual(results[0].perfume_id, "GOLDEN")
        self.assertEqual(results[0].overall_score, 100.0)
        self.assertGreater(results[0].overall_score, results[1].overall_score)
        self.assertGreater(results[1].overall_score, results[2].overall_score)

    def test_limit_respected(self):
        perfume_notes = {
            i: {"top": frozenset((f"N{i}",)), "middle": frozenset(), "base": frozenset()}
            for i in range(1, 11)
        }
        perfume_meta = {i: _meta(i) for i in range(1, 11)}
        notes = _uniform_weights(*(f"N{i}" for i in range(1, 11)))

        results = _score_all(
            user_notes=_user(top=(f"N{i}" for i in range(1, 11))),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights=notes,
            limit=3,
        )

        self.assertEqual(len(results), 3)


class TestMatchedNoteIds(unittest.TestCase):
    """matched_note_ids must contain exactly the overlapping notes, sorted."""

    def test_matched_ids_are_sorted_and_correct(self):
        notes = _uniform_weights("AMBER", "MUSK", "ROSE", "OUD")
        perfume_notes = _perfume_notes(1, base=("AMBER", "OUD", "VANILLA"))
        perfume_meta = {1: _meta(1)}

        results = _score_all(
            user_notes=_user(base=("AMBER", "MUSK", "OUD")),
            perfume_notes=perfume_notes,
            perfume_meta=perfume_meta,
            note_weights={"AMBER": idf_weight(1), "MUSK": idf_weight(1),
                          "OUD": idf_weight(1), "VANILLA": idf_weight(1)},
        )

        self.assertEqual(results[0].base.matched_note_ids, ["AMBER", "OUD"])


if __name__ == "__main__":
    unittest.main()
