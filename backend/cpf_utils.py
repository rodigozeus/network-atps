import hashlib
import hmac
import re

from cryptography.fernet import Fernet

from database import settings

_fernet = Fernet(settings.cpf_encryption_key.encode())


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
    """Hash determinístico (HMAC-SHA256) do CPF, usado para impedir cadastros
    duplicados sem precisar decifrar os CPFs guardados."""
    numeros = limpar_cpf(cpf)
    chave = settings.cpf_hash_secret.encode()
    return hmac.new(chave, numeros.encode(), hashlib.sha256).hexdigest()


def cifrar_cpf(cpf: str) -> str:
    """Criptografia reversível (Fernet: AES-128-CBC + HMAC), usada só para a
    reverificação periódica do vínculo no Portal da Transparência."""
    return _fernet.encrypt(limpar_cpf(cpf).encode()).decode()


def decifrar_cpf(cpf_cifrado: str) -> str:
    return _fernet.decrypt(cpf_cifrado.encode()).decode()
