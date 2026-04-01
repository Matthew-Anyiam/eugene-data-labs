"""Tests for the ontology engine — entities, edges, signals, convergence."""

import os
import pytest

# Use a fresh test database
os.environ.setdefault("EUGENE_DB_PATH", "/tmp/eugene_test_ontology.db")

from eugene.ontology.schema import init_ontology_db
from eugene.ontology.entities import (
    create_entity, get_entity, resolve_entity, search_entities,
    update_entity, add_alias, get_entity_count,
)
from eugene.ontology.edges import create_edge, get_relationships, traverse
from eugene.ontology.signals import record_signal, get_entity_signals, get_convergence


@pytest.fixture(autouse=True)
def _clean_db():
    """Re-init ontology tables for each test."""
    from eugene.db import _get_conn
    with _get_conn() as conn:
        conn.executescript("""
            DELETE FROM signals;
            DELETE FROM edges;
            DELETE FROM entity_aliases;
            DELETE FROM entities;
        """)
    yield


class TestEntityCreation:
    def test_create_company(self):
        entity = create_entity(
            entity_type="company",
            canonical_name="Apple Inc.",
            attributes={"ticker": "AAPL", "sector": "Technology"},
            source="sec",
            source_id="AAPL",
        )
        assert entity["id"]
        assert entity["entity_type"] == "company"
        assert entity["canonical_name"] == "Apple Inc."
        assert entity["attributes"]["ticker"] == "AAPL"

    def test_create_with_aliases(self):
        entity = create_entity(
            entity_type="company",
            canonical_name="Microsoft Corp",
            source="sec",
            source_id="MSFT",
            aliases=[
                {"alias": "MSFT", "alias_type": "ticker"},
                {"alias": "Microsoft Corporation", "alias_type": "name"},
            ],
        )
        detail = get_entity(entity["id"])
        assert len(detail["aliases"]) == 2

    def test_duplicate_source_id_returns_existing(self):
        e1 = create_entity(entity_type="company", canonical_name="Test", source="sec", source_id="TST")
        e2 = create_entity(entity_type="company", canonical_name="Test Dup", source="sec", source_id="TST")
        assert e1["id"] == e2["id"]

    def test_invalid_entity_type_raises(self):
        with pytest.raises(ValueError, match="Invalid entity_type"):
            create_entity(entity_type="invalid_type", canonical_name="Bad")


class TestEntityResolution:
    def test_resolve_by_source_id(self):
        create_entity(entity_type="company", canonical_name="Tesla", source="sec", source_id="TSLA")
        matches = resolve_entity("TSLA")
        assert len(matches) >= 1
        assert matches[0]["canonical_name"] == "Tesla"

    def test_resolve_by_alias(self):
        create_entity(
            entity_type="company", canonical_name="Alphabet Inc.",
            source="sec", source_id="GOOGL",
            aliases=[{"alias": "Google", "alias_type": "name"}],
        )
        matches = resolve_entity("Google")
        assert len(matches) >= 1
        assert matches[0]["canonical_name"] == "Alphabet Inc."

    def test_resolve_fuzzy_name(self):
        create_entity(entity_type="company", canonical_name="NVIDIA Corporation")
        matches = resolve_entity("nvidia")
        assert len(matches) >= 1

    def test_resolve_with_type_filter(self):
        create_entity(entity_type="company", canonical_name="Test Co")
        create_entity(entity_type="person", canonical_name="Test Person")
        company_matches = resolve_entity("Test", entity_type="company")
        person_matches = resolve_entity("Test", entity_type="person")
        assert all(m["entity_type"] == "company" for m in company_matches)
        assert all(m["entity_type"] == "person" for m in person_matches)


class TestEntitySearch:
    def test_search_by_query(self):
        create_entity(entity_type="company", canonical_name="Amazon.com Inc.")
        results = search_entities(query="Amazon")
        assert results["total"] >= 1

    def test_search_by_type(self):
        create_entity(entity_type="company", canonical_name="Co A")
        create_entity(entity_type="person", canonical_name="Person B")
        results = search_entities(entity_type="company")
        assert all(e["entity_type"] == "company" for e in results["entities"])

    def test_search_by_attribute(self):
        create_entity(
            entity_type="company", canonical_name="Tech Corp",
            attributes={"sector": "Technology"},
        )
        results = search_entities(filters={"sector": "Technology"})
        assert results["total"] >= 1

    def test_search_pagination(self):
        for i in range(5):
            create_entity(entity_type="company", canonical_name=f"Company {i}")
        r1 = search_entities(entity_type="company", limit=2, offset=0)
        r2 = search_entities(entity_type="company", limit=2, offset=2)
        assert len(r1["entities"]) == 2
        assert len(r2["entities"]) == 2
        assert r1["entities"][0]["id"] != r2["entities"][0]["id"]


class TestEntityUpdate:
    def test_update_attributes(self):
        e = create_entity(entity_type="company", canonical_name="Test", attributes={"a": 1})
        updated = update_entity(e["id"], attributes={"b": 2})
        assert updated["attributes"]["a"] == 1
        assert updated["attributes"]["b"] == 2

    def test_update_name(self):
        e = create_entity(entity_type="company", canonical_name="Old Name")
        updated = update_entity(e["id"], canonical_name="New Name")
        assert updated["canonical_name"] == "New Name"

    def test_add_alias(self):
        e = create_entity(entity_type="company", canonical_name="Test")
        result = add_alias(e["id"], "TEST_ALIAS", "ticker")
        assert result["alias"] == "TEST_ALIAS"
        detail = get_entity(e["id"])
        assert any(a["alias"] == "TEST_ALIAS" for a in detail["aliases"])


class TestEdges:
    def test_create_edge(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p = create_entity(entity_type="person", canonical_name="CEO")
        edge = create_edge(p["id"], c["id"], "officer_of", attributes={"role": "CEO"})
        assert edge["relationship"] == "officer_of"

    def test_duplicate_edge_returns_existing(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p = create_entity(entity_type="person", canonical_name="CEO")
        e1 = create_edge(p["id"], c["id"], "officer_of")
        e2 = create_edge(p["id"], c["id"], "officer_of")
        assert e2.get("exists") is True

    def test_invalid_relationship_raises(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p = create_entity(entity_type="person", canonical_name="P")
        with pytest.raises(ValueError, match="Invalid relationship"):
            create_edge(p["id"], c["id"], "invalid_rel")

    def test_get_relationships(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p1 = create_entity(entity_type="person", canonical_name="CEO")
        p2 = create_entity(entity_type="person", canonical_name="CFO")
        create_edge(p1["id"], c["id"], "officer_of")
        create_edge(p2["id"], c["id"], "officer_of")
        rels = get_relationships(c["id"])
        assert len(rels["inbound"]) == 2

    def test_get_relationships_filtered(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p = create_entity(entity_type="person", canonical_name="CEO")
        inst = create_entity(entity_type="institution", canonical_name="Fund")
        create_edge(p["id"], c["id"], "officer_of")
        create_edge(inst["id"], c["id"], "holds")
        rels = get_relationships(c["id"], relationship="officer_of")
        assert len(rels["inbound"]) == 1
        assert rels["inbound"][0]["relationship"] == "officer_of"


class TestTraversal:
    def test_traverse_1_hop(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        p = create_entity(entity_type="person", canonical_name="CEO")
        create_edge(p["id"], c["id"], "officer_of")
        result = traverse(c["id"], max_depth=1)
        assert result["node_count"] == 2
        assert result["edge_count"] >= 1

    def test_traverse_2_hop(self):
        c1 = create_entity(entity_type="company", canonical_name="Co A")
        c2 = create_entity(entity_type="company", canonical_name="Co B")
        p = create_entity(entity_type="person", canonical_name="Shared CEO")
        create_edge(p["id"], c1["id"], "officer_of")
        create_edge(p["id"], c2["id"], "officer_of")
        result = traverse(c1["id"], max_depth=2)
        # Should find: c1 -> p -> c2
        assert result["node_count"] >= 3

    def test_traverse_capped_depth(self):
        result = traverse("nonexistent", max_depth=10)
        assert result.get("error") or result["max_depth"] <= 4


class TestSignals:
    def test_record_and_get(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        record_signal(c["id"], "insider_sell", 0.7)
        signals = get_entity_signals(c["id"], time_window="7d")
        assert signals["total_signals"] == 1
        assert signals["signals"][0]["signal_type"] == "insider_sell"

    def test_signal_summary(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        record_signal(c["id"], "insider_sell", 0.5)
        record_signal(c["id"], "insider_sell", 0.8)
        record_signal(c["id"], "filing_drop", 0.3)
        signals = get_entity_signals(c["id"], time_window="7d")
        assert len(signals["summary"]) == 2

    def test_signal_type_filter(self):
        c = create_entity(entity_type="company", canonical_name="Co")
        record_signal(c["id"], "insider_sell", 0.5)
        record_signal(c["id"], "filing_drop", 0.3)
        signals = get_entity_signals(c["id"], signal_type="insider_sell", time_window="7d")
        assert all(s["signal_type"] == "insider_sell" for s in signals["signals"])


class TestConvergence:
    def test_convergence_detection(self):
        c = create_entity(entity_type="company", canonical_name="Risky Corp")
        record_signal(c["id"], "insider_sell", 0.8)
        record_signal(c["id"], "filing_drop", 0.6)
        record_signal(c["id"], "price_drop", 0.7)
        conv = get_convergence(time_window="7d", min_signal_types=2)
        assert conv["total_alerts"] >= 1
        alert = conv["alerts"][0]
        assert alert["entity_name"] == "Risky Corp"
        assert alert["signal_type_count"] >= 2
        assert 0 <= alert["composite_risk"] <= 1

    def test_convergence_for_specific_entity(self):
        c1 = create_entity(entity_type="company", canonical_name="Co1")
        c2 = create_entity(entity_type="company", canonical_name="Co2")
        record_signal(c1["id"], "insider_sell", 0.5)
        record_signal(c1["id"], "filing_drop", 0.4)
        record_signal(c2["id"], "price_drop", 0.3)
        conv = get_convergence(entity_id=c1["id"], time_window="7d", min_signal_types=2)
        assert all(a["entity_id"] == c1["id"] for a in conv["alerts"])

    def test_no_convergence_below_threshold(self):
        c = create_entity(entity_type="company", canonical_name="Calm Corp")
        record_signal(c["id"], "insider_sell", 0.2)  # Only 1 type
        conv = get_convergence(time_window="7d", min_signal_types=2)
        assert conv["total_alerts"] == 0


class TestEntityCount:
    def test_count_all(self):
        create_entity(entity_type="company", canonical_name="A")
        create_entity(entity_type="person", canonical_name="B")
        assert get_entity_count() == 2

    def test_count_by_type(self):
        create_entity(entity_type="company", canonical_name="A")
        create_entity(entity_type="person", canonical_name="B")
        assert get_entity_count("company") == 1
        assert get_entity_count("person") == 1
