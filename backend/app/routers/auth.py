from fastapi import APIRouter, Depends
from app.deps import get_current_user, UserProfile

router = APIRouter()

@router.get("/me")
def me(user: UserProfile = Depends(get_current_user)):
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role,
        "is_active": user.is_active,
    }
