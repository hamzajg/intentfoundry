"""
Canvas API — save and load visual canvas layouts for projects.

The canvas stores node positions, edges, and viewport state as JSON
so that teams can collaboratively visualise specs, ADRs, contexts,
and agent relationships on an infinite canvas.
"""
from fastapi import APIRouter, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.deps import get_current_user, get_session
from app.models.domain import Project, User

router = APIRouter(prefix="/projects/{project_id}/canvas", tags=["canvas"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class Position(BaseModel):
    x: float
    y: float


class Viewport(BaseModel):
    x: float = 0.0
    y: float = 0.0
    zoom: float = 1.0


class CanvasNode(BaseModel):
    id: str
    type: str | None = None
    position: Position
    data: dict[str, Any] = Field(default_factory=dict)


class CanvasEdge(BaseModel):
    id: str
    source: str
    target: str
    type: str | None = None
    label: str | None = None
    animated: bool = False


class CanvasSaveIn(BaseModel):
    nodes: list[CanvasNode] = Field(default_factory=list)
    edges: list[CanvasEdge] = Field(default_factory=list)
    viewport: Viewport | None = None


class CanvasOut(BaseModel):
    project_id: str
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    edges: list[dict[str, Any]] = Field(default_factory=list)
    viewport: dict[str, float] | None = None
    updated_at: str | None = None


# ─── In-memory canvas store (Phase 1 — replace with DB table in Phase 2) ─────

_canvases: dict[str, dict[str, Any]] = {}


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("", response_model=CanvasOut)
async def get_canvas(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CanvasOut:
    project = await db.get(Project, project_id)
    if not project or project.deleted_at:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    layout = _canvases.get(project_id)
    if not layout:
        return CanvasOut(project_id=project_id)

    return CanvasOut(**layout)


@router.post("", response_model=CanvasOut)
async def save_canvas(
    project_id: str,
    data: CanvasSaveIn,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> CanvasOut:
    project = await db.get(Project, project_id)
    if not project or project.deleted_at:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    layout = {
        "project_id": project_id,
        "nodes": [n.model_dump() for n in data.nodes],
        "edges": [e.model_dump() for e in data.edges],
        "viewport": data.viewport.model_dump() if data.viewport else None,
        "updated_at": now,
    }
    _canvases[project_id] = layout

    return CanvasOut(**layout)


@router.delete("")
async def delete_canvas(
    project_id: str,
    db: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
) -> dict[str, str]:
    project = await db.get(Project, project_id)
    if not project or project.deleted_at:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.owner_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    _canvases.pop(project_id, None)
    return {"status": "deleted"}


# ─── WebSocket for real-time collaboration (Phase 2) ──────────────────────────

class ConnectionManager:
    def __init__(self) -> None:
        self.active_connections: dict[str, list[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str) -> None:
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str) -> None:
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast(self, project_id: str, message: dict[str, Any]) -> None:
        if project_id in self.active_connections:
            dead: list[WebSocket] = []
            for conn in self.active_connections[project_id]:
                try:
                    await conn.send_json(message)
                except Exception:
                    dead.append(conn)
            for d in dead:
                self.active_connections[project_id].remove(d)


manager = ConnectionManager()


@router.websocket("/ws/{project_id}")
async def canvas_websocket(
    websocket: WebSocket,
    project_id: str,
) -> None:
    """
    Real-time canvas collaboration channel.
    
    Clients send: { "type": "node_change" | "edge_change" | "cursor", ... }
    Server broadcasts to all other clients in the same project.
    
    Phase 2 — currently accepts connections and echoes messages.
    Full auth + Yjs integration to follow.
    """
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            await manager.broadcast(project_id, {
                "type": "broadcast",
                "payload": data,
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)
