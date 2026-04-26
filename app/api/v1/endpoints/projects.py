"""Projects endpoints — CRUD for project root aggregate."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.api.v1.deps import CurrentUser, DB, get_project_or_404
from app.models.domain import Project
from app.schemas.schemas import ProjectCreate, ProjectOut, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("", response_model=list[ProjectOut])
async def list_projects(db: DB, current_user: CurrentUser):
    result = await db.execute(
        select(Project).where(
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        ).order_by(Project.created_at.desc())
    )
    return [ProjectOut.model_validate(p) for p in result.scalars().all()]


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
async def create_project(data: ProjectCreate, db: DB, current_user: CurrentUser):
    existing = await db.execute(
        select(Project).where(
            Project.slug == data.slug,
            Project.owner_id == current_user.id,
            Project.deleted_at.is_(None),
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Project with slug '{data.slug}' already exists",
        )
    project = Project(
        name=data.name,
        slug=data.slug,
        description=data.description,
        domain=data.domain,
        metadata_=data.metadata,
        owner_id=current_user.id,
    )
    db.add(project)
    await db.flush()
    return ProjectOut.model_validate(project)


@router.get("/{project_id}", response_model=ProjectOut)
async def get_project(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    return ProjectOut.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectOut)
async def update_project(
    project_id: str,
    data: ProjectUpdate,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    if data.name is not None:
        project.name = data.name
    if data.description is not None:
        project.description = data.description
    if data.domain is not None:
        project.domain = data.domain
    if data.metadata is not None:
        project.metadata_ = data.metadata
    await db.flush()
    return ProjectOut.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: DB,
    current_user: CurrentUser,
    project: Project = Depends(get_project_or_404),
):
    project.soft_delete()
