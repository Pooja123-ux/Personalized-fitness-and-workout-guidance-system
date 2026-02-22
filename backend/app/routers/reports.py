import os
import json
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Dict
from ..models import Report
from ..deps import get_db, get_current_user
from ..report_parser import extract_summary
from .. import logic

router = APIRouter()

UPLOAD_DIR = "backend/storage/reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)

def _invalidate_weekly_plan_cache(user_id: int) -> None:
    try:
        from .weekly_meal_plan import weekly_plans
        weekly_plans.pop(f"user:{user_id}", None)
        weekly_plans.pop("current", None)
    except Exception:
        pass


def _normalize_conditions(conditions):
    mapped = []
    for c in (conditions or []):
        cl = (c or "").strip().lower()
        if not cl:
            continue
        if cl in ["cardiac", "heart", "heart disease"]:
            mapped.append("heart")
        elif "diab" in cl:
            mapped.append("diabetes")
        elif "hyperten" in cl or cl == "bp":
            mapped.append("hypertension")
        elif "cholesterol" in cl:
            mapped.append("cholesterol")
        else:
            mapped.append(cl)
    # dedupe while preserving order
    out = []
    seen = set()
    for x in mapped:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out


@router.post("/upload", response_model=Dict[str, str])
async def upload_report(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """
    Upload a PDF report and extract its summary.
    """
    filename = file.filename
    path = os.path.join(UPLOAD_DIR, filename)
    
    content = await file.read()
    with open(path, "wb") as f:
        f.write(content)
    
    summary = ""
    try:
        summary = extract_summary(path)
    except Exception:
        summary = ""

    # Enrich summary with foods to consume/avoid based on detected diseases
    enriched_summary = summary
    try:
        if summary:
            data = json.loads(summary)
            conditions = _normalize_conditions(data.get("conditions") or [])
            if isinstance(conditions, list) and conditions:
                recs = logic.get_disease_recommendations(conditions)
                data["foods_to_consume"] = recs.get("consume", [])
                data["foods_to_avoid"] = recs.get("avoid", [])
                data["conditions"] = conditions
            enriched_summary = json.dumps(data)
    except Exception:
        enriched_summary = summary
    
    report = Report(user_id=user.id, filename=filename, path=path, summary=enriched_summary)
    db.add(report)
    db.commit()
    db.refresh(report)
    _invalidate_weekly_plan_cache(user.id)
    
    return {"id": str(report.id), "filename": filename, "path": path, "url": f"/reports/download/{report.id}"}


@router.get("/", response_model=List[Dict[str, str]])
def list_reports(
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    """
    List all reports uploaded by the current user.
    """
    reports = (
        db.query(Report)
        .filter(Report.user_id == user.id)
        .order_by(Report.created_at.desc())
        .all()
    )
    
    out = []
    for r in reports:
        s = r.summary or ""
        enriched = s
        try:
            data = json.loads(s) if s else {}
            conditions = _normalize_conditions(data.get("conditions") or [])
            consume = data.get("foods_to_consume") or []
            avoid = data.get("foods_to_avoid") or []
            if conditions and (not consume and not avoid):
                recs = logic.get_disease_recommendations(conditions)
                data["foods_to_consume"] = recs.get("consume", [])
                data["foods_to_avoid"] = recs.get("avoid", [])
                data["conditions"] = conditions
                enriched = json.dumps(data)
        except Exception:
            enriched = s
        out.append({
            "id": str(r.id),
            "filename": r.filename,
            "path": r.path,
            "summary": enriched,
            "url": f"/reports/download/{r.id}"
        })
    return out

@router.get("/download/{report_id}")
def download_report(
    report_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    if not os.path.exists(report.path):
        raise HTTPException(status_code=404, detail="File missing")
    return FileResponse(path=report.path, media_type="application/pdf", filename=report.filename)


@router.delete("/{report_id}", response_model=Dict[str, str])
def delete_report(
    report_id: int,
    db: Session = Depends(get_db),
    user=Depends(get_current_user)
):
    report = db.query(Report).filter(Report.id == report_id, Report.user_id == user.id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    file_path = report.path
    db.delete(report)
    db.commit()
    _invalidate_weekly_plan_cache(user.id)

    # Only remove the physical file when no other report references it.
    remaining_refs = db.query(Report).filter(Report.path == file_path).count()
    if remaining_refs == 0 and file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass

    return {"message": "Report deleted", "id": str(report_id)}
