from django.contrib import admin
from django.utils.html import format_html, escape

from .models import ComparisonLog


@admin.register(ComparisonLog)
class ComparisonLogAdmin(admin.ModelAdmin):
    list_display         = ["created_at", "note_count", "top_result", "score_badge", "duration_ms", "ip_hash"]
    list_display_links   = ["created_at"]
    date_hierarchy       = "created_at"
    ordering             = ["-created_at"]
    list_per_page        = 50
    list_filter          = []

    # Everything is read-only — logs must never be edited
    readonly_fields = [
        "created_at",
        "duration_ms",
        "ip_hash",
        "submitted_notes_display",
        "results_table",
    ]

    fieldsets = [
        ("Request", {
            "fields": ["created_at", "duration_ms", "ip_hash"],
        }),
        ("Submitted notes", {
            "fields": ["submitted_notes_display"],
        }),
        ("Results", {
            "fields": ["results_table"],
        }),
    ]

    # ── List columns ──────────────────────────────────────────────────────────

    @admin.display(description="Notes submitted")
    def note_count(self, obj):
        t = len(obj.top_notes)
        m = len(obj.middle_notes)
        b = len(obj.base_notes)
        return format_html(
            '<span title="top={} mid={} base={}">{} note{}</span>',
            t, m, b,
            t + m + b,
            "" if (t + m + b) == 1 else "s",
        )

    @admin.display(description="Top match")
    def top_result(self, obj):
        if obj.results:
            r = obj.results[0]
            name  = escape(r.get("perfume_name", "?"))
            brand = escape(r.get("perfume_brand", "") or "")
            return format_html(
                "<strong>{}</strong>{}",
                name,
                format_html(" &mdash; {}", brand) if brand else "",
            )
        return "—"

    @admin.display(description="Score")
    def score_badge(self, obj):
        if obj.results:
            score = obj.results[0].get("overall_score", 0)
            # Colour: green ≥80, amber ≥50, red <50
            if score >= 80:
                colour = "#2d7a2d"
            elif score >= 50:
                colour = "#b07a00"
            else:
                colour = "#a02020"
            return format_html(
                '<span style="color:{};font-weight:bold">{:.1f}%</span>',
                colour,
                score,
            )
        return "—"

    # ── Detail fields ─────────────────────────────────────────────────────────

    @admin.display(description="Submitted notes")
    def submitted_notes_display(self, obj):
        def pill(label, notes, colour):
            if not notes:
                return ""
            ids = ", ".join(escape(n) for n in notes)
            return (
                f'<div style="margin-bottom:6px">'
                f'<span style="background:{colour};color:#fff;padding:2px 8px;'
                f'border-radius:3px;font-size:11px;font-weight:bold">{label}</span> '
                f'<span style="font-family:monospace;font-size:12px">{ids}</span></div>'
            )

        html = (
            pill("TOP",    obj.top_notes,    "#6B4423") +
            pill("MIDDLE", obj.middle_notes, "#7D5132") +
            pill("BASE",   obj.base_notes,   "#2D1507")
        )
        return format_html(html) if html else "—"

    @admin.display(description="Results breakdown")
    def results_table(self, obj):
        if not obj.results:
            return format_html('<em style="color:#888">No results recorded.</em>')

        rows = []
        for i, r in enumerate(obj.results, 1):
            name  = escape(r.get("perfume_name", "?"))
            brand = escape(r.get("perfume_brand", "") or "Unknown")
            score = r.get("overall_score", 0)
            url   = escape(r.get("url", "") or "")

            top_score = r.get("top",    {}).get("score", None)
            mid_score = r.get("middle", {}).get("score", None)
            base_score= r.get("base",   {}).get("score", None)

            def fmt_layer(s):
                if s is None:
                    return '<span style="color:#aaa">—</span>'
                return f"{s:.1f}%"

            name_cell = (
                f'<a href="{url}" target="_blank">{name}</a>'
                if url else str(name)
            )

            rows.append(
                f"<tr>"
                f'<td style="padding:6px 10px;font-weight:bold;color:#6B4423">#{i}</td>'
                f'<td style="padding:6px 10px">{name_cell}</td>'
                f'<td style="padding:6px 10px;color:#555">{brand}</td>'
                f'<td style="padding:6px 10px;font-weight:bold">{score:.1f}%</td>'
                f'<td style="padding:6px 10px;color:#555">{fmt_layer(top_score)}</td>'
                f'<td style="padding:6px 10px;color:#555">{fmt_layer(mid_score)}</td>'
                f'<td style="padding:6px 10px;color:#555">{fmt_layer(base_score)}</td>'
                f"</tr>"
            )

        header = (
            "<tr style='background:#6B4423;color:#fff'>"
            "<th style='padding:6px 10px'>#</th>"
            "<th style='padding:6px 10px'>Perfume</th>"
            "<th style='padding:6px 10px'>Brand</th>"
            "<th style='padding:6px 10px'>Overall</th>"
            "<th style='padding:6px 10px'>Top</th>"
            "<th style='padding:6px 10px'>Middle</th>"
            "<th style='padding:6px 10px'>Base</th>"
            "</tr>"
        )

        table = (
            f'<table style="border-collapse:collapse;width:100%;'
            f'border:1px solid #ddd;border-radius:4px;overflow:hidden">'
            f"<thead>{header}</thead>"
            f"<tbody>{''.join(rows)}</tbody>"
            f"</table>"
        )
        return format_html(table)

    # ── Permissions — read-only ───────────────────────────────────────────────

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
