export function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function cpfValido(value: string): boolean {
  const numeros = value.replace(/\D/g, '')
  if (numeros.length !== 11 || /^(\d)\1{10}$/.test(numeros)) return false

  const digitoVerificador = (fatia: string): string => {
    let soma = 0
    let peso = fatia.length + 1
    for (const d of fatia) {
      soma += Number(d) * peso
      peso -= 1
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? '0' : String(resto)
  }

  const dv1 = digitoVerificador(numeros.slice(0, 9))
  const dv2 = digitoVerificador(numeros.slice(0, 9) + dv1)
  return numeros.slice(9) === dv1 + dv2
}
