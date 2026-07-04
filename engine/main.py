"""FastAPI server for dashboard and cloud agent integration."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from engine.classify import build_ticket, classify_stub
from engine.detect import detect, load_screen_map

app = FastAPI(title="Design Diplomat Engine", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class DetectRequest(BaseModel):
    screen: str = "Settings"
    mode: str = "token"


class ClassifyRequest(BaseModel):
    change: dict[str, Any]


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "design-diplomat-engine"}


@app.get("/api/screen-map")
def screen_map() -> dict[str, Any]:
    return load_screen_map()


@app.post("/api/detect")
def api_detect(req: DetectRequest) -> dict[str, Any]:
    changes = detect(screen=req.screen, mode=req.mode)
    return {"atomic_changes": changes}


@app.post("/api/classify")
def api_classify(req: ClassifyRequest) -> dict[str, Any]:
    classification = classify_stub(req.change)
    ticket = build_ticket(req.change, classification)
    return ticket


@app.post("/api/pipeline")
def api_pipeline(req: DetectRequest) -> dict[str, Any]:
    changes = detect(screen=req.screen, mode=req.mode)
    tickets = [build_ticket(c, classify_stub(c)) for c in changes]
    return {"tickets": tickets, "screen": req.screen}
