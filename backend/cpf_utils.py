import hashlib
import hmac
import re

from database import settings


def limpar_cpf(cpf: str) -> str:
    return re.sub(r"\D", "", cpf or "")


def cpf_valido(cpf: str) -> bool:
    """Valida o formato e os dígitos verificadores de um CPF."""
    numeros = limpar_cpf(cpf)
    if len(numeros) != 11 or numeros == numeros[0] * 11:
        return False

    def _digito_verificador(fatia: str) -> str:
        soma = sum(int(d) * peso for d, peso in zip(fatia, range(len(fatia) + 1, 1, -1)))
        resto = (soma * 10) % 11
        return "0" if resto == 10 else str(resto)

    dv1 = _digito_verificador(numeros[:9])
    dv2 = _digito_verificador(numeros[:9] + dv1)
    return numeros[-2:] == dv1 + dv2


def hash_cpf(cpf: str) -> str:
    """Hash determinístico (HMAC-SHA256) do CPF, usado apenas para impedir
    cadastros duplicados. O CPF original nunca é armazenado."""
    numeros = limpar_cpf(cpf)
    chave = settings.cpf_hash_secret.encode()
    return hmac.new(chave, numeros.encode(), hashlib.sha256).hexdigest()
