from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthState(BaseModel):
    """spec §12: login·me 응답."""
    role: str
    is_agreed: bool
    is_batch_submitted: bool
