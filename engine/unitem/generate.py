"""Reconcile stage: apply accepted fixes and open PRs. Fully built in M7.

M3 placeholder behavior: accepting a ticket is a status flip only.
"""
from __future__ import annotations

from .config import Config
from .schema import Ticket


def apply_and_pr(ticket: Ticket, cfg: Config) -> None:
    """Apply the proposed fix and (for propagate) open the PR. M7 implements."""
    return None
