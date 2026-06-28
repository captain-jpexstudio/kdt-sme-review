from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class AuthState(BaseModel):
    """spec §12: login·me 응답."""
    role: str
    is_agreed: bool
    is_batch_submitted: bool


class AgreementRequest(BaseModel):
    """spec §6 동의 게이트 + 듀얼 서명."""
    typed_name: str
    signature_png: str  # data:image/png;base64,...
    checkbox_states: dict  # {security, ip_rights, privacy, tax: bool}
