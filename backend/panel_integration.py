"""
GoldCast Streaming — Camada de integração com o painel administrativo (kOfficePanel).

>>> CONFIGURAÇÃO PENDENTE <<<
A API do painel ainda não foi fornecida. Este módulo define o contrato que o app
usará para validar usuários de forma centralizada. NÃO contém URL fictícia nem
resposta simulada: enquanto PANEL_API_URL não estiver definido no .env do backend,
`is_configured()` retorna False e o app segue validando somente via Xtream/XUI.

Quando a API for fornecida, preencher no backend/.env:
  PANEL_API_URL=<url base da API do painel>
  PANEL_API_KEY=<token/chave, se aplicável>
  PANEL_VALIDATE_ENDPOINT=<caminho do endpoint de validação, ex: /api/validate>
e implementar `validate_user` mapeando a resposta JSON real para `PanelAccountStatus`.
"""
import os
from dataclasses import dataclass, asdict
from typing import Optional, List


@dataclass
class PanelAccountStatus:
    status: str                      # active | expired | blocked | unknown
    expires_at: Optional[str]        # ISO-8601
    max_connections: Optional[int]
    active_connections: Optional[int]
    permissions: List[str]
    message: Optional[str] = None


class PanelNotConfigured(Exception):
    pass


class PanelClient:
    def __init__(self) -> None:
        self.base_url = os.environ.get("PANEL_API_URL")
        self.api_key = os.environ.get("PANEL_API_KEY")
        self.validate_endpoint = os.environ.get("PANEL_VALIDATE_ENDPOINT")

    def is_configured(self) -> bool:
        return bool(self.base_url and self.validate_endpoint)

    def describe(self) -> dict:
        return {
            "configured": self.is_configured(),
            "state": "CONFIGURAÇÃO PENDENTE" if not self.is_configured() else "ATIVO",
            "required_env": ["PANEL_API_URL", "PANEL_VALIDATE_ENDPOINT", "PANEL_API_KEY (opcional)"],
        }

    async def validate_user(self, server: str, username: str, password_or_token: str) -> PanelAccountStatus:
        """Valida o usuário no painel. Implementar quando a API for fornecida."""
        if not self.is_configured():
            raise PanelNotConfigured("Painel não configurado (CONFIGURAÇÃO PENDENTE).")
        # TODO(kOfficePanel): chamar f"{self.base_url}{self.validate_endpoint}" com os parâmetros
        # (server, username, password/token) e mapear a resposta real para PanelAccountStatus.
        raise NotImplementedError("Integração com o painel aguardando especificação da API.")


panel_client = PanelClient()

__all__ = ["panel_client", "PanelAccountStatus", "PanelNotConfigured", "asdict"]
